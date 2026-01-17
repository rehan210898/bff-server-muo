const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Simple in-memory store for user rate limiting (Use Redis in production)
const userRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per user

/**
 * Validate API Key middleware
 * Simple but effective API key authentication for mobile app
 */
const validateApiKey = (req, res, next) => {
  // Public paths that don't require API Key (Browser callbacks, etc.)
  const publicPaths = [
    '/auth/google',
    '/auth/google/callback',
    '/auth/verify-email-redirect',
    '/health'
  ];

  // Check if current path starts with any public path
  // We use req.path or req.originalUrl. req.originalUrl is safer as it's the full URL.
  const isPublic = publicPaths.some(path => req.originalUrl.includes(path));

  if (isPublic) {
    return next();
  }

  // BYPASS AUTH IN DEVELOPMENT for easier browser testing
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required',
      code: 'missing_api_key'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key',
      code: 'invalid_api_key'
    });
  }

  next();
};

/**
 * Optional: JWT validation middleware for user-specific operations
 * Implement this when you add user authentication
 */
const validateJWT = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required',
      code: 'missing_token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT validation error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'invalid_token'
    });
  }
};

/**
 * Rate limit per user (for authenticated routes)
 */
const userRateLimit = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  const now = Date.now();
  
  const userLimit = userRateLimits.get(userId) || { count: 0, startTime: now };

  // Reset window if time passed
  if (now - userLimit.startTime > RATE_LIMIT_WINDOW) {
    userLimit.count = 0;
    userLimit.startTime = now;
  }

  userLimit.count++;
  userRateLimits.set(userId, userLimit);

  if (userLimit.count > MAX_REQUESTS) {
    logger.warn(`User rate limit exceeded for user: ${userId}`);
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil((userLimit.startTime + RATE_LIMIT_WINDOW - now) / 1000)
    });
  }

  next();
};

module.exports = {
  validateApiKey,
  validateJWT,
  userRateLimit
};