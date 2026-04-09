const axios = require('axios');
const tokenStore = require('./tokenStore');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications via Expo Push API
 */
async function sendViaExpoPush(tokens, { title, body, data, image }) {
  if (!tokens || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: ['No tokens to send to'] };
  }

  const messages = tokens.map(token => {
    const msg = {
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
      channelId: 'default',
    };

    if (image) {
      msg.richContent = { image };
    }

    return msg;
  });

  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let totalSent = 0;
  let totalFailed = 0;
  const errors = [];
  const invalidTokens = [];

  for (const chunk of chunks) {
    try {
      const response = await axios.post(EXPO_PUSH_URL, chunk, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      if (response.data && response.data.data) {
        response.data.data.forEach((ticket, idx) => {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            totalFailed++;
            errors.push({ token: chunk[idx].to, error: ticket.message });
            if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[idx].to);
            }
          }
        });
      }
    } catch (err) {
      logger.error('Expo Push API error:', err.message);
      totalFailed += chunk.length;
      errors.push({ error: err.message });
    }
  }

  if (invalidTokens.length > 0) {
    tokenStore.deleteTokens(invalidTokens);
    logger.info(`Removed ${invalidTokens.length} invalid tokens`);
  }

  return {
    sent: totalSent,
    failed: totalFailed,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  };
}

/**
 * Send push notification to a specific user by ID
 */
async function notifyUser(userId, { title, body, data, image }) {
  const tokens = tokenStore.getUserTokens(userId);
  if (tokens.length === 0) {
    logger.debug(`No push tokens found for user ${userId}`);
    return { sent: 0, failed: 0 };
  }
  return sendViaExpoPush(tokens, { title, body, data, image });
}

/**
 * Send push notification to all admin users
 */
async function notifyAdmins({ title, body, data, image }) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length === 0) {
    logger.debug('No admin emails configured');
    return { sent: 0, failed: 0 };
  }

  // Collect tokens for all admin user IDs
  const allTokenData = tokenStore.getAll();
  const adminTokens = [];

  for (const [token, info] of Object.entries(allTokenData)) {
    if (!info.active || !info.userId) continue;
    // We need to check if this userId belongs to an admin
    // Admin tokens are identified by having adminEmail stored, or we check all tokens
    // Since we can't reverse-lookup email from userId in tokenStore, we store adminUserIds
    adminTokens.push(token);
  }

  // Filter: we'll use a smarter approach - store admin user IDs when they register
  // For now, use the admin token registry
  const adminUserIds = getAdminUserIds();
  const tokens = [];
  for (const uid of adminUserIds) {
    tokens.push(...tokenStore.getUserTokens(uid));
  }

  if (tokens.length === 0) {
    logger.debug('No admin push tokens registered');
    return { sent: 0, failed: 0 };
  }

  return sendViaExpoPush(tokens, { title, body, data, image });
}

// In-memory registry of admin user IDs (populated when admin logs in and registers push token)
const adminUserIds = new Set();

function registerAdminUserId(userId) {
  adminUserIds.add(String(userId));
}

function getAdminUserIds() {
  return [...adminUserIds];
}

module.exports = {
  sendViaExpoPush,
  notifyUser,
  notifyAdmins,
  registerAdminUserId,
  getAdminUserIds,
};
