const express = require('express');
const router = express.Router();
const axios = require('axios');
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const campaignConfig = require('../config/notificationCampaign');
const logger = require('../utils/logger');

// In-memory token store (fallback if WP plugin is unavailable)
// In production, use Redis or a database
const tokenStore = new Map();

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications directly via Expo Push API
 * This is the reliable method for Expo push tokens
 */
async function sendViaExpoPush(tokens, { title, body, data, image }) {
  if (!tokens || tokens.length === 0) return { sent: 0 };

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data || {},
    ...(image ? { image } : {}),
    priority: 'high',
    channelId: 'default',
  }));

  // Expo API accepts batches of up to 100
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let totalSent = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const response = await axios.post(EXPO_PUSH_URL, chunk, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.data && response.data.data) {
        response.data.data.forEach((ticket, idx) => {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            errors.push({ token: chunk[idx].to, error: ticket.message });
            // Remove invalid tokens
            if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
              tokenStore.delete(chunk[idx].to);
            }
          }
        });
      }
    } catch (err) {
      logger.error('Expo Push API error:', err.message);
      errors.push({ error: err.message });
    }
  }

  return { sent: totalSent, errors: errors.length > 0 ? errors : undefined };
}

// POST /api/v1/notifications/register
router.post('/register', asyncHandler(async (req, res) => {
  const { token, platform } = req.body;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('Device token is required');
  }

  const cleanToken = token.trim();

  // Store token locally as fallback
  tokenStore.set(cleanToken, {
    platform: platform || 'unknown',
    registeredAt: new Date().toISOString(),
  });

  // Try to forward to WP Plugin (non-blocking, don't fail if WP is unavailable)
  let wpResponse = null;
  try {
    wpResponse = await wooCommerceClient.post('/register', {
      token: cleanToken,
      platform: platform || 'unknown'
    }, {}, { namespace: 'muo-push/v1', auth: false });
  } catch (wpError) {
    logger.warn('WP plugin registration failed (token stored locally):', wpError.message || wpError);
  }

  res.json({
    success: true,
    message: 'Push token registered',
    wp_synced: !!wpResponse,
  });
}));

// POST /api/v1/notifications/broadcast
// Triggers the campaign defined in src/config/notificationCampaign.js
router.post('/broadcast', asyncHandler(async (req, res) => {
  if (!campaignConfig.enabled) {
    return res.status(400).json({
      success: false,
      message: 'Campaign is disabled in src/config/notificationCampaign.js'
    });
  }

  logger.info(`Broadcasting Notification: ${campaignConfig.title}`);

  // Collect all registered tokens
  const allTokens = Array.from(tokenStore.keys());

  // Send directly via Expo Push API (reliable path)
  const expoResult = await sendViaExpoPush(allTokens, {
    title: campaignConfig.title,
    body: campaignConfig.body,
    image: campaignConfig.image,
    data: campaignConfig.data,
  });

  // Also try WP plugin broadcast (non-blocking)
  let wpResponse = null;
  try {
    wpResponse = await wooCommerceClient.post('/broadcast', {
      title: campaignConfig.title,
      body: campaignConfig.body,
      image: campaignConfig.image,
      data: campaignConfig.data
    }, {}, { namespace: 'muo-push/v1', auth: false });
  } catch (wpError) {
    logger.warn('WP plugin broadcast failed:', wpError.message || wpError);
  }

  res.json({
    success: true,
    message: 'Broadcast triggered successfully',
    config_used: {
      title: campaignConfig.title,
      body: campaignConfig.body,
    },
    expo_result: expoResult,
    wp_response: wpResponse,
    total_tokens: allTokens.length,
  });
}));

// POST /api/v1/notifications/send
// Send notification to specific tokens (for order updates, etc.)
router.post('/send', asyncHandler(async (req, res) => {
  const { tokens, title, body, data, image } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    throw new ValidationError('tokens array is required');
  }
  if (!title || !body) {
    throw new ValidationError('title and body are required');
  }

  const result = await sendViaExpoPush(tokens, { title, body, data, image });

  res.json({
    success: true,
    ...result,
  });
}));

// POST /api/v1/notifications/remove
router.post('/remove', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('Device token is required');
  }

  const cleanToken = token.trim();

  // Remove from local store
  tokenStore.delete(cleanToken);

  // Try WP plugin removal (non-blocking)
  try {
    await wooCommerceClient.post('/remove', {
      token: cleanToken
    }, {}, { namespace: 'muo-push/v1', auth: false });
  } catch (wpError) {
    logger.warn('WP plugin token removal failed:', wpError.message || wpError);
  }

  res.json({ success: true, message: 'Token removed' });
}));

module.exports = router;
