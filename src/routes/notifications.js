const express = require('express');
const router = express.Router();
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { optionalJWT } = require('../middleware/auth');
const campaignConfig = require('../config/notificationCampaign');
const tokenStore = require('../services/tokenStore');
const { sendViaExpoPush } = require('../services/pushService');
const logger = require('../utils/logger');

// ──────────────────────────────────────────────────────────────
// POST /api/v1/notifications/register
// Called by the mobile app on launch to register the Expo push token
// Body: { token: string, platform: 'ios' | 'android' }
// ──────────────────────────────────────────────────────────────
router.post('/register', optionalJWT, asyncHandler(async (req, res) => {
  const { token, platform } = req.body;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('Device token is required');
  }

  const cleanToken = token.trim();

  // Validate Expo push token format
  if (!cleanToken.startsWith('ExponentPushToken[') && !cleanToken.startsWith('ExpoPushToken[')) {
    throw new ValidationError('Invalid Expo push token format');
  }

  // Get user ID from JWT if authenticated (optional)
  const userId = req.user ? req.user.id : null;

  // Save to persistent store (survives server restart)
  tokenStore.register(cleanToken, platform || 'android', userId);

  logger.info(`Push token registered: ${cleanToken.substring(0, 30)}... (platform: ${platform || 'android'}) userId: ${userId}`);

  res.json({
    success: true,
    message: 'Push token registered',
  });
}));

// ──────────────────────────────────────────────────────────────
// POST /api/v1/notifications/remove
// Called by the mobile app on logout
// Body: { token: string }
// ──────────────────────────────────────────────────────────────
router.post('/remove', optionalJWT, asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('Device token is required');
  }

  tokenStore.remove(token.trim());

  logger.info(`Push token removed: ${token.trim().substring(0, 30)}...`);

  res.json({ success: true, message: 'Token removed' });
}));

// ──────────────────────────────────────────────────────────────
// POST /api/v1/notifications/send
// Send notification to specific tokens or all devices
// Body: { title, body, data?, tokens?, userId?, platform? }
// ──────────────────────────────────────────────────────────────
router.post('/send', asyncHandler(async (req, res) => {
  const { tokens: specificTokens, title, body, data, image, userId, platform } = req.body;

  if (!title || !body) {
    throw new ValidationError('title and body are required');
  }

  let targetTokens;

  if (specificTokens && Array.isArray(specificTokens) && specificTokens.length > 0) {
    // Send to specific tokens
    targetTokens = specificTokens;
  } else if (userId) {
    // Send to a specific user's devices
    targetTokens = tokenStore.getUserTokens(userId);
  } else {
    // Send to all active tokens (optionally filtered by platform)
    targetTokens = tokenStore.getActiveTokens(platform || null);
  }

  const result = await sendViaExpoPush(targetTokens, { title, body, data, image });

  logger.info(`Notification sent: "${title}" - ${result.sent} delivered, ${result.failed} failed`);

  res.json({
    success: true,
    ...result,
    total_targeted: targetTokens.length,
    tokens_used: targetTokens.map(t => t.substring(0, 30) + '...'),
  });
}));

// ──────────────────────────────────────────────────────────────
// POST /api/v1/notifications/broadcast
// Send the campaign notification defined in notificationCampaign.js
// ──────────────────────────────────────────────────────────────
router.post('/broadcast', asyncHandler(async (req, res) => {
  if (!campaignConfig.enabled) {
    return res.status(400).json({
      success: false,
      message: 'Campaign is disabled in src/config/notificationCampaign.js',
    });
  }

  logger.info(`Broadcasting: "${campaignConfig.title}"`);

  const allTokens = tokenStore.getActiveTokens();

  const result = await sendViaExpoPush(allTokens, {
    title: campaignConfig.title,
    body: campaignConfig.body,
    image: campaignConfig.image,
    data: campaignConfig.data,
  });

  res.json({
    success: true,
    message: 'Broadcast sent',
    config_used: {
      title: campaignConfig.title,
      body: campaignConfig.body,
    },
    ...result,
    total_tokens: allTokens.length,
  });
}));

// ──────────────────────────────────────────────────────────────
// GET /api/v1/notifications/stats
// Get registered token stats
// ──────────────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    active_tokens: tokenStore.getActiveCount(),
    all_tokens: tokenStore.getAll(),
  });
}));

module.exports = router;
