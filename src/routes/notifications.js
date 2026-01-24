const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/v1/notifications/register
router.post('/register', asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  
  // Forward to WP Plugin Endpoint
  // Note: wooCommerceClient handles the base URL and auth
  // WP Endpoint: /wp-json/muo-push/v1/register
  
  // Since wooCommerceClient is designed for WC API, we might need to adjust the path
  // standard client might prefix /wc/v3. We need to override or use a generic request.
  // Looking at wooCommerceClient.js, it likely uses a base URL.
  // If it's flexible, we can pass the full path relative to wp-json.
  
  // Assuming we can pass a custom path
  const response = await wooCommerceClient.post('/muo-push/v1/register', { 
    token, 
    platform 
  });
  
  res.json(response);
}));

// POST /api/v1/notifications/remove
router.post('/remove', asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  const response = await wooCommerceClient.post('/muo-push/v1/remove', { 
    token 
  });
  
  res.json(response);
}));

module.exports = router;
