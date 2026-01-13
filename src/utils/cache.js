const NodeCache = require('node-cache');
const logger = require('./logger');

class CacheManager {
  constructor() {
    const ttl = parseInt(process.env.CACHE_TTL_SECONDS) || 300;
    const checkPeriod = parseInt(process.env.CACHE_CHECK_PERIOD_SECONDS) || 600;

    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: checkPeriod,
      useClones: false,
      deleteOnExpire: true
    });

    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key, value) => {
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    this.cache.on('flush', () => {
      logger.info('Cache FLUSHED');
    });

    logger.info(`✅ Cache initialized (TTL: ${ttl}s, Check: ${checkPeriod}s)`);
  }

  get(key) {
    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        logger.debug(`Cache HIT: ${key}`);
        return value;
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  set(key, value, ttl = null) {
    try {
      const success = ttl 
        ? this.cache.set(key, value, ttl)
        : this.cache.set(key, value);
      
      if (success) {
        logger.debug(`Cache SET success: ${key} (TTL: ${ttl || 'default'}s)`);
      }
      return success;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  del(key) {
    try {
      const count = this.cache.del(key);
      logger.debug(`Cache DEL: ${key} (${count} deleted)`);
      return count;
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
      return 0;
    }
  }

  keys() {
    try {
      return this.cache.keys();
    } catch (error) {
      logger.error('Cache KEYS error:', error);
      return [];
    }
  }

  flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
      return false;
    }
  }

  getStats() {
    try {
      const stats = this.cache.getStats();
      return {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        ksize: stats.ksize,
        vsize: stats.vsize
      };
    } catch (error) {
      logger.error('Cache STATS error:', error);
      return null;
    }
  }
}

module.exports = new CacheManager();