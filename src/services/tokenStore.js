const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const TOKENS_FILE = path.join(__dirname, '..', '..', 'data', 'push_tokens.json');

/**
 * Persistent token store using JSON file
 * Tokens survive server restarts
 */
class TokenStore {
  constructor() {
    this.tokens = new Map();
    this._ensureDataDir();
    this._load();
  }

  _ensureDataDir() {
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _load() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        for (const [token, info] of Object.entries(data)) {
          this.tokens.set(token, info);
        }
        logger.info(`Loaded ${this.tokens.size} push tokens from disk`);
      }
    } catch (err) {
      logger.error('Failed to load push tokens:', err.message);
    }
  }

  _save() {
    try {
      const obj = Object.fromEntries(this.tokens);
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
      logger.error('Failed to save push tokens:', err.message);
    }
  }

  /**
   * Register a push token
   */
  register(token, platform = 'android', userId = null) {
    this.tokens.set(token, {
      platform,
      userId,
      active: true,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this._save();
  }

  /**
   * Remove (deactivate) a push token
   */
  remove(token) {
    const existing = this.tokens.get(token);
    if (existing) {
      existing.active = false;
      existing.updatedAt = new Date().toISOString();
      this.tokens.set(token, existing);
      this._save();
    }
  }

  /**
   * Permanently delete invalid tokens
   */
  deleteTokens(tokensToDelete) {
    for (const token of tokensToDelete) {
      this.tokens.delete(token);
    }
    if (tokensToDelete.length > 0) {
      this._save();
    }
  }

  /**
   * Get all active tokens
   */
  getActiveTokens(platform = null) {
    const result = [];
    for (const [token, info] of this.tokens) {
      if (!info.active) continue;
      if (platform && info.platform !== platform) continue;
      result.push(token);
    }
    return result;
  }

  /**
   * Get tokens for a specific user
   */
  getUserTokens(userId) {
    const result = [];
    for (const [token, info] of this.tokens) {
      if (info.active && info.userId && String(info.userId) === String(userId)) {
        result.push(token);
      }
    }
    return result;
  }

  /**
   * Get token count
   */
  getActiveCount() {
    let count = 0;
    for (const info of this.tokens.values()) {
      if (info.active) count++;
    }
    return count;
  }

  /**
   * Get all token data (for admin/debug)
   */
  getAll() {
    return Object.fromEntries(this.tokens);
  }
}

module.exports = new TokenStore();
