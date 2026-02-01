const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const cache = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/', asyncHandler(async (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    environment: process.env.NODE_ENV
  });
}));

router.get('/detailed', asyncHandler(async (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  const wooCommerceHealth = await wooCommerceClient.healthCheck();
  const cacheStats = await cache.getStats();

  const health = {
    success: true,
    status: wooCommerceHealth.status === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      formatted: `${Math.floor(uptime / 60)} minutes`
    },
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    },
    services: {
      woocommerce: wooCommerceHealth
    },
    cache: {
      enabled: true,
      type: cache.isUsingRedis() ? 'redis' : 'node-cache',
      stats: cacheStats
    },
    environment: process.env.NODE_ENV,
    nodeVersion: process.version
  };

  res.json(health);
}));

router.get('/cache/stats', asyncHandler(async (req, res) => {
  const stats = await cache.getStats();

  res.json({
    success: true,
    type: cache.isUsingRedis() ? 'redis' : 'node-cache',
    cache: stats
  });
}));

router.post('/cache/clear', asyncHandler(async (req, res) => {
  const cleared = await cache.flush();

  res.json({
    success: cleared,
    message: cleared ? 'Cache cleared successfully' : 'Failed to clear cache'
  });
}));

module.exports = router;