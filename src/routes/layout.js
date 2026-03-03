const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const layoutService = require('../services/layoutService');
const cache = require('../utils/cache');

const LAYOUT_CACHE_KEY = 'home_layout';
const LAYOUT_CACHE_TTL = 300; // 5 minutes

/**
 * @route   GET /api/v1/layout/home
 * @desc    Get dynamic home screen layout
 * @access  Public
 */
router.get('/home', asyncHandler(async (req, res) => {
  // Check cache first for faster response
  const cached = await cache.get(LAYOUT_CACHE_KEY);
  if (cached) {
    // Set cache-control header for client-side caching
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: cached
    });
  }

  const layout = await layoutService.getHomeLayout();

  // Cache the layout
  await cache.set(LAYOUT_CACHE_KEY, layout, LAYOUT_CACHE_TTL);

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    data: layout
  });
}));

module.exports = router;