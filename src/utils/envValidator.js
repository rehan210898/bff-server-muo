const Joi = require('joi');
const logger = require('./logger');

/**
 * Environment variable validation schema
 */
const envSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_VERSION: Joi.string().default('v1'),

  // WooCommerce (Required)
  WOOCOMMERCE_URL: Joi.string().uri().required()
    .messages({ 'any.required': 'WOOCOMMERCE_URL is required' }),
  WOOCOMMERCE_CONSUMER_KEY: Joi.string().min(10).required()
    .messages({ 'any.required': 'WOOCOMMERCE_CONSUMER_KEY is required' }),
  WOOCOMMERCE_CONSUMER_SECRET: Joi.string().min(10).required()
    .messages({ 'any.required': 'WOOCOMMERCE_CONSUMER_SECRET is required' }),

  // Security (Required)
  API_KEY: Joi.string().min(16).required()
    .messages({ 'any.required': 'API_KEY is required (min 16 chars)' }),
  JWT_SECRET: Joi.string().min(32).required()
    .messages({ 'any.required': 'JWT_SECRET is required (min 32 chars)' }),

  // Rate Limiting (Optional)
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // CORS (Optional)
  ALLOWED_ORIGINS: Joi.string().default(''),

  // Email (Optional but recommended)
  EMAIL_USER: Joi.string().email().optional(),
  EMAIL_PASS: Joi.string().optional(),

  // Google OAuth (Optional)
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().optional(),

  // Razorpay (Optional but recommended for payments)
  RAZORPAY_KEY_ID: Joi.string().optional(),
  RAZORPAY_KEY_SECRET: Joi.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().optional(),

  // Redis (Optional)
  UPSTASH_REDIS_URL: Joi.string().uri().optional(),
  UPSTASH_REDIS_TOKEN: Joi.string().optional(),

  // Cache (Optional)
  CACHE_TTL_SECONDS: Joi.number().default(300),
  CACHE_CHECK_PERIOD_SECONDS: Joi.number().default(600),

  // Deep Link
  APP_DEEP_LINK_SCHEME: Joi.string().default('muoapp'),
  API_URL: Joi.string().uri().optional(),
}).unknown(true); // Allow other env vars

/**
 * Validate environment variables on startup
 * @returns {boolean} True if validation passes
 */
function validateEnv() {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    logger.error('❌ Environment validation failed:');
    error.details.forEach((detail) => {
      logger.error(`  - ${detail.message}`);
    });
    return false;
  }

  // Log warnings for recommended but missing variables
  const warnings = [];

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    warnings.push('Email service not configured (EMAIL_USER, EMAIL_PASS)');
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    warnings.push('Razorpay not configured (payment features disabled)');
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    warnings.push('Google OAuth not configured (Google login disabled)');
  }

  if (!process.env.UPSTASH_REDIS_URL) {
    warnings.push('Redis not configured (using in-memory cache)');
  }

  if (warnings.length > 0) {
    logger.warn('⚠️ Environment warnings:');
    warnings.forEach((w) => logger.warn(`  - ${w}`));
  }

  logger.info('✅ Environment validation passed');
  return true;
}

/**
 * Get validated environment variable with type coercion
 */
function getEnv(key, defaultValue) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;

  // Try to parse as number
  if (!isNaN(Number(value))) {
    return Number(value);
  }

  // Try to parse as boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  return value;
}

module.exports = {
  validateEnv,
  getEnv,
  envSchema,
};
