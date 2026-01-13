const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const layoutService = require('../services/layoutService');

/**
 * @route   GET /api/v1/layout/home
 * @desc    Get dynamic home screen layout
 * @access  Public
 */
router.get('/home', asyncHandler(async (req, res) => {
  const layout = await layoutService.getHomeLayout();
  
  res.json({
    success: true,
    data: layout
  });
}));

module.exports = router;