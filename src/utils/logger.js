const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m'
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;
    this.useColors = process.env.NODE_ENV !== 'production';
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    
    let formatted = `[${timestamp}] ${levelStr}`;
    
    if (this.useColors) {
      formatted = `${COLORS[level]}${formatted}${COLORS.reset}`;
    }

    formatted += ` ${message}`;

    if (Object.keys(meta).length > 0) {
      formatted += ` ${JSON.stringify(meta)}`;
    }

    return formatted;
  }

  shouldLog(level) {
    return LOG_LEVELS[level] >= this.level;
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  http(method, url, status, duration) {
    const message = `${method} ${url} ${status} - ${duration}ms`;
    
    if (status >= 500) {
      this.error(message);
    } else if (status >= 400) {
      this.warn(message);
    } else {
      this.info(message);
    }
  }
}

module.exports = new Logger();