const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const emailService = require('./emailService');
const logger = require('../utils/logger');

// Store pending registrations for 24 hours
const pendingCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

class VerificationService {
  
  async createPendingRegistration(userData) {
    const token = uuidv4();
    
    // Store user data mapped to token
    pendingCache.set(token, {
      ...userData,
      createdAt: Date.now()
    });

    // Send email
    await emailService.sendVerificationEmail(userData.email, token, userData.firstName);
    
    return token;
  }

  getPendingRegistration(token) {
    return pendingCache.get(token);
  }

  removePendingRegistration(token) {
    pendingCache.del(token);
  }

  async resendVerification(email) {
    // This is expensive: we have to search the cache.
    // In a real DB, this is a query. With NodeCache, we iterate keys.
    const keys = pendingCache.keys();
    for (const key of keys) {
      const data = pendingCache.get(key);
      if (data && data.email === email) {
        // Found it, resend
        await emailService.sendVerificationEmail(data.email, key, data.firstName);
        return true;
      }
    }
    return false;
  }
}

module.exports = new VerificationService();