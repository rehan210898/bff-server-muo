const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const layoutService = require('../services/layoutService');
const cache = require('../utils/cache');

const LAYOUT_CACHE_KEY = 'home_layout';
const LAYOUT_CACHE_TTL = 300; // 5 minutes

const CATEGORY_LAYOUT_CACHE_KEY = 'category_layout';
const CATEGORY_LAYOUT_CACHE_TTL = 300; // 5 minutes

const CATEGORY_TREE_CACHE_KEY = 'category_tree';
const CATEGORY_TREE_CACHE_TTL = 300; // 5 minutes

/**
 * @route   GET /api/v1/layout/home
 * @desc    Get dynamic home screen layout
 * @access  Public
 */
router.get('/home', asyncHandler(async (req, res) => {
  const cached = await cache.get(LAYOUT_CACHE_KEY);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: cached
    });
  }

  const layout = await layoutService.getHomeLayout();

  await cache.set(LAYOUT_CACHE_KEY, layout, LAYOUT_CACHE_TTL);

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    data: layout
  });
}));

/**
 * @route   GET /api/v1/layout/categories
 * @desc    Get managed category list (id + image from WordPress)
 * @access  Public
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const cached = await cache.get(CATEGORY_LAYOUT_CACHE_KEY);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: cached
    });
  }

  const categories = await layoutService.getCategoryLayout();

  await cache.set(CATEGORY_LAYOUT_CACHE_KEY, categories, CATEGORY_LAYOUT_CACHE_TTL);

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    data: categories
  });
}));

/**
 * @route   GET /api/v1/layout/categories-tree
 * @desc    Get category tree (main categories with nested subcategories)
 * @access  Public
 */
router.get('/categories-tree', asyncHandler(async (req, res) => {
  const cached = await cache.get(CATEGORY_TREE_CACHE_KEY);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: cached
    });
  }

  const tree = await layoutService.getCategoryTree();

  await cache.set(CATEGORY_TREE_CACHE_KEY, tree, CATEGORY_TREE_CACHE_TTL);

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    data: tree
  });
}));

module.exports = router;