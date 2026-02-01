const NodeCache = require('node-cache');
const { Redis } = require('@upstash/redis');
const logger = require('./logger');

/**
 * Cache Manager with Upstash Redis and NodeCache fallback
 *
 * Configuration:
 * - UPSTASH_REDIS_URL: Upstash Redis REST URL
 * - UPSTASH_REDIS_TOKEN: Upstash Redis REST token
 * - CACHE_TTL_SECONDS: Default TTL (default: 300)
 * - CACHE_CHECK_PERIOD_SECONDS: Cleanup interval for NodeCache (default: 600)
 */
class CacheManager {
  constructor() {
    this.defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS) || 300;
    this.redis = null;
    this.nodeCache = null;
    this.useRedis = false;

    this._initialize();
  }

  _initialize() {
    // Try to initialize Upstash Redis
    if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_URL,
          token: process.env.UPSTASH_REDIS_TOKEN,
        });
        this.useRedis = true;
        logger.info('✅ Cache initialized with Upstash Redis');
      } catch (error) {
        logger.error('Failed to initialize Upstash Redis:', error.message);
        this._initNodeCache();
      }
    } else {
      this._initNodeCache();
    }
  }

  _initNodeCache() {
    const checkPeriod = parseInt(process.env.CACHE_CHECK_PERIOD_SECONDS) || 600;

    this.nodeCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: checkPeriod,
      useClones: false,
      deleteOnExpire: true
    });

    this.nodeCache.on('expired', (key) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    this.nodeCache.on('flush', () => {
      logger.info('Cache FLUSHED');
    });

    this.useRedis = false;
    logger.info(`✅ Cache initialized with NodeCache (TTL: ${this.defaultTTL}s)`);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      if (this.useRedis) {
        const value = await this.redis.get(key);
        if (value !== null) {
          logger.debug(`Cache HIT (Redis): ${key}`);
          return value;
        }
        logger.debug(`Cache MISS (Redis): ${key}`);
        return null;
      } else {
        const value = this.nodeCache.get(key);
        if (value !== undefined) {
          logger.debug(`Cache HIT (NodeCache): ${key}`);
          return value;
        }
        logger.debug(`Cache MISS (NodeCache): ${key}`);
        return null;
      }
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Synchronous get for NodeCache (backward compatibility)
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  getSync(key) {
    if (this.useRedis) {
      // Redis requires async, return null for sync calls
      logger.warn('getSync() called but Redis is enabled - use async get() instead');
      return null;
    }

    try {
      const value = this.nodeCache.get(key);
      if (value !== undefined) {
        logger.debug(`Cache HIT: ${key}`);
        return value;
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    const actualTTL = ttl || this.defaultTTL;

    try {
      if (this.useRedis) {
        await this.redis.set(key, value, { ex: actualTTL });
        logger.debug(`Cache SET (Redis): ${key} (TTL: ${actualTTL}s)`);
        return true;
      } else {
        const success = ttl
          ? this.nodeCache.set(key, value, ttl)
          : this.nodeCache.set(key, value);
        logger.debug(`Cache SET (NodeCache): ${key} (TTL: ${actualTTL}s)`);
        return success;
      }
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Synchronous set for NodeCache (backward compatibility)
   */
  setSync(key, value, ttl = null) {
    if (this.useRedis) {
      logger.warn('setSync() called but Redis is enabled - use async set() instead');
      return false;
    }

    try {
      const success = ttl
        ? this.nodeCache.set(key, value, ttl)
        : this.nodeCache.set(key, value);
      logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'}s)`);
      return success;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of deleted keys
   */
  async del(key) {
    try {
      if (this.useRedis) {
        const count = await this.redis.del(key);
        logger.debug(`Cache DEL (Redis): ${key}`);
        return count;
      } else {
        const count = this.nodeCache.del(key);
        logger.debug(`Cache DEL (NodeCache): ${key} (${count} deleted)`);
        return count;
      }
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error.message);
      return 0;
    }
  }

  /**
   * Delete keys matching a pattern (Redis only, NodeCache uses prefix matching)
   * @param {string} pattern - Key pattern (e.g., "products_*")
   * @returns {Promise<number>} Number of deleted keys
   */
  async delPattern(pattern) {
    try {
      if (this.useRedis) {
        // Upstash doesn't support SCAN, so we use KEYS (use sparingly)
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        logger.debug(`Cache DEL pattern (Redis): ${pattern} (${keys.length} deleted)`);
        return keys.length;
      } else {
        // For NodeCache, match keys that start with the prefix (before *)
        const prefix = pattern.replace('*', '');
        const allKeys = this.nodeCache.keys();
        const matchingKeys = allKeys.filter(k => k.startsWith(prefix));
        matchingKeys.forEach(k => this.nodeCache.del(k));
        logger.debug(`Cache DEL pattern (NodeCache): ${pattern} (${matchingKeys.length} deleted)`);
        return matchingKeys.length;
      }
    } catch (error) {
      logger.error(`Cache DEL pattern error for ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Get all cache keys
   * @returns {Promise<string[]>} Array of keys
   */
  async keys() {
    try {
      if (this.useRedis) {
        return await this.redis.keys('*');
      } else {
        return this.nodeCache.keys();
      }
    } catch (error) {
      logger.error('Cache KEYS error:', error.message);
      return [];
    }
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    try {
      if (this.useRedis) {
        await this.redis.flushall();
        logger.info('Cache flushed (Redis)');
      } else {
        this.nodeCache.flushAll();
        logger.info('Cache flushed (NodeCache)');
      }
      return true;
    } catch (error) {
      logger.error('Cache FLUSH error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache stats
   */
  async getStats() {
    try {
      if (this.useRedis) {
        const info = await this.redis.info();
        const keys = await this.redis.dbsize();
        return {
          type: 'redis',
          keys: keys,
          info: info
        };
      } else {
        const stats = this.nodeCache.getStats();
        return {
          type: 'node-cache',
          keys: stats.keys,
          hits: stats.hits,
          misses: stats.misses,
          ksize: stats.ksize,
          vsize: stats.vsize
        };
      }
    } catch (error) {
      logger.error('Cache STATS error:', error.message);
      return null;
    }
  }

  /**
   * Check if Redis is being used
   * @returns {boolean}
   */
  isUsingRedis() {
    return this.useRedis;
  }
}

module.exports = new CacheManager();
