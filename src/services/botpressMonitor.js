const axios = require('axios');
const logger = require('../utils/logger');

class BotpressMonitor {
  constructor() {
    this.available = true;
    this.lastCheck = 0;
    this.intervalId = null;
  }

  async check() {
    const botId = process.env.BOTPRESS_BOT_ID;
    if (!botId) {
      this.available = false;
      logger.debug('BOTPRESS_BOT_ID not configured, marking as unavailable');
      return;
    }

    try {
      const res = await axios.get(`https://chat.botpress.cloud/${botId}`, {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });

      if (res.status === 429 || res.status === 402) {
        if (this.available) {
          logger.warn(`Botpress quota exhausted (HTTP ${res.status}), switching to live chat`);
        }
        this.available = false;
      } else {
        if (!this.available) {
          logger.info('Botpress is available again');
        }
        this.available = true;
      }
    } catch (err) {
      // Network error or timeout — keep current state, don't flip on transient errors
      logger.debug(`Botpress health check failed: ${err.message}`);
    }

    this.lastCheck = Date.now();
  }

  isAvailable() {
    return this.available;
  }

  startPolling() {
    const interval = parseInt(process.env.BOTPRESS_CHECK_INTERVAL_MS) || 60000;
    this.check(); // immediate first check
    this.intervalId = setInterval(() => this.check(), interval);
    logger.info(`Botpress monitor started (polling every ${interval / 1000}s)`);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new BotpressMonitor();
