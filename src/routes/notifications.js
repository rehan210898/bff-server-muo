const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');
const campaignConfig = require('../config/notificationCampaign');

// POST /api/v1/notifications/register
router.post('/register', asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  
  // Forward to WP Plugin Endpoint
  // Passing namespace 'muo-push/v1' explicitly to override default 'wc/v3'
  const response = await wooCommerceClient.post('/register', { 
    token, 
    platform 
  }, {}, { namespace: 'muo-push/v1' });
  
  res.json(response);
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

  console.log('📢 Broadcasting Notification:', campaignConfig.title);

  // Send to WordPress to handle the actual blasting to all tokens
  const response = await wooCommerceClient.post('/broadcast', {
    title: campaignConfig.title,
    body: campaignConfig.body,
    image: campaignConfig.image,
    data: campaignConfig.data
  }, {}, { namespace: 'muo-push/v1' });
  
  res.json({
    success: true,
    message: 'Broadcast triggered successfully',
    config_used: {
        title: campaignConfig.title,
        body: campaignConfig.body
    },
    wp_response: response
  });
}));

// POST /api/v1/notifications/remove
router.post('/remove', asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  const response = await wooCommerceClient.post('/remove', { 
    token 
  }, {}, { namespace: 'muo-push/v1' });
  
  res.json(response);
}));

module.exports = router;
