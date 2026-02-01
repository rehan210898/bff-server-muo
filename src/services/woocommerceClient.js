const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

class WooCommerceClient {
  constructor() {
    this.baseURL = process.env.WOOCOMMERCE_URL;
    this.consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
    this.consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
    this.apiKey = process.env.API_KEY;
    
    if (!this.baseURL || !this.consumerKey || !this.consumerSecret) {
      logger.warn('⚠️  WooCommerce credentials not fully configured');
    }

    this.isHttps = this.baseURL ? this.baseURL.startsWith('https://') : true;
    
    if (!this.isHttps && this.baseURL) {
      this.oauth = OAuth({
        consumer: {
          key: this.consumerKey,
          secret: this.consumerSecret
        },
        signature_method: 'HMAC-SHA256',
        hash_function(baseString, key) {
          return crypto
            .createHmac('sha256', key)
            .update(baseString)
            .digest('base64');
        }
      });
    }

    this.client = axios.create({
      baseURL: this.baseURL ? `${this.baseURL}/wp-json/wc/v3` : '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WooCommerce-BFF-Server/1.0.0',
      }
    });

    this.client.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        logger.info(`📤 WooCommerce API Request: ${config.method.toUpperCase()} ${config.url}`);
        
        // Debug: Log specific headers we are interested in
        if (config.headers['X-WC-Payment-Method'] || config.headers['x-wc-payment-method']) {
            logger.info(`🔍 Sending Payment Method: ${config.headers['X-WC-Payment-Method'] || config.headers['x-wc-payment-method']}`);
        }
        
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.info(`📥 WooCommerce API Response: ${response.status} (${duration}ms)`);
        return response;
      },
      (error) => {
        if (error.response) {
          const duration = Date.now() - error.config.metadata.startTime;
          logger.error(
            `❌ WooCommerce API Error: ${error.response.status} (${duration}ms) - ${error.response.data?.message || error.message}`
          );
        } else {
          logger.error(`❌ WooCommerce API Error: ${error.message}`);
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  buildConfig(method, endpoint, data = null, params = {}, namespace = 'wc/v3', auth = true, headers = {}) {
    const url = `${this.baseURL}/wp-json/${namespace}${endpoint}`;
    
    const config = {
      method,
      url: url, // Absolute URL overrides axios instance baseURL
      params: { ...params },
      headers: { ...headers }
    };

    if (data) {
      config.data = data;
    }

    if (auth) {
        if (this.isHttps) {
          // Use Query Params instead of Basic Auth to avoid server stripping Authorization headers
          config.params = {
            ...config.params,
            consumer_key: this.consumerKey,
            consumer_secret: this.consumerSecret
          };
        } else {
        const requestData = {
            url,
            method: method.toUpperCase(),
            data: params
        };
        const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData));
        config.headers = {
            ...config.headers,
            ...authHeader
        };
        }
    }

    return config;
  }

  async get(endpoint, params = {}, options = {}) {
    const { useCache = true, cacheTTL, namespace = 'wc/v3', auth = true, headers = {} } = options;
    const cacheKey = `${namespace}_${endpoint}_${JSON.stringify(params)}`;

    if (useCache) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        logger.info(`✅ Cache hit for: ${endpoint}`);
        return cachedData;
      }
    }

    try {
      const config = this.buildConfig('GET', endpoint, null, params, namespace, auth, headers);
      const response = await this.client.request(config);

      // Return headers if requested (e.g. for Nonce)
      if (options.returnHeaders) {
        return { data: response.data, headers: response.headers };
      }

      if (useCache) {
        await cache.set(cacheKey, response.data, cacheTTL);
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async post(endpoint, data = {}, params = {}, options = {}) {
    const { namespace = 'wc/v3', headers = {} } = options;
    try {
      const config = this.buildConfig('POST', endpoint, data, params, namespace, true, headers);
      const response = await this.client.request(config);
      await this.invalidateCache(endpoint);

      if (options.returnHeaders) {
        return { data: response.data, headers: response.headers };
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async put(endpoint, data = {}, params = {}) {
    try {
      const config = this.buildConfig('PUT', endpoint, data, params);
      const response = await this.client.request(config);
      await this.invalidateCache(endpoint);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async delete(endpoint, params = {}, options = {}) {
    const { namespace = 'wc/v3', headers = {} } = options;
    try {
      const config = this.buildConfig('DELETE', endpoint, null, params, namespace, true, headers);
      const response = await this.client.request(config);
      await this.invalidateCache(endpoint);

      if (options.returnHeaders) {
        return { data: response.data, headers: response.headers };
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async invalidateCache(endpoint) {
    try {
      const pattern = endpoint.split('/')[1] || '';
      if (pattern) {
        await cache.delPattern(`*${pattern}*`);
        logger.info(`🗑️ Cache invalidated for pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error.message);
    }
  }

  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || 'WooCommerce API error',
        code: error.response.data?.code || 'woocommerce_error',
        data: error.response.data?.data || null
      };
    } else if (error.request) {
      return {
        status: 503,
        message: 'WooCommerce service unavailable',
        code: 'service_unavailable',
        data: null
      };
    } else {
      return {
        status: 500,
        message: error.message || 'Internal server error',
        code: 'internal_error',
        data: null
      };
    }
  }

  async healthCheck() {
    try {
      await this.get('/system_status', {}, { useCache: false });
      return { status: 'connected', message: 'WooCommerce API is reachable' };
    } catch (error) {
      return { 
        status: 'disconnected', 
        message: 'Cannot reach WooCommerce API',
        error: error.message 
      };
    }
  }
}

module.exports = new WooCommerceClient();