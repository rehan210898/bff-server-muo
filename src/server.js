require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { validateApiKey } = require('./middleware/auth');
const logger = require('./utils/logger');

// Import Routes
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const cartRoutes = require('./routes/cart');
const attributeRoutes = require('./routes/attributes');
const tagRoutes = require('./routes/tags');
const layoutRoutes = require('./routes/layout');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const storeRoutes = require('./routes/store');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Trust proxy - important for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:19006'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Compression Middleware
app.use(compression());

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.NODE_ENV === 'development',
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000)
    });
  }
});

app.use(`/api/${API_VERSION}`, limiter);

// Health Check Route (no auth required)
app.use(`/api/${API_VERSION}/health`, healthRoutes);

// API Key Validation Middleware (for all other routes)
app.use(`/api/${API_VERSION}`, validateApiKey);

// API Routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/products`, productRoutes);
app.use(`/api/${API_VERSION}/categories`, categoryRoutes);
app.use(`/api/${API_VERSION}/orders`, orderRoutes);
app.use(`/api/${API_VERSION}/customers`, customerRoutes);
app.use(`/api/${API_VERSION}/cart`, cartRoutes);
app.use(`/api/${API_VERSION}/attributes`, attributeRoutes);
app.use(`/api/${API_VERSION}/tags`, tagRoutes);
app.use(`/api/${API_VERSION}/layout`, layoutRoutes);
app.use(`/api/${API_VERSION}/payment`, paymentRoutes);
app.use(`/api/${API_VERSION}/store`, storeRoutes);
app.use(`/api/${API_VERSION}/config`, configRoutes);

// Root Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WooCommerce BFF Server',
    version: API_VERSION,
    endpoints: {
      health: `/api/${API_VERSION}/health`,
      auth: `/api/${API_VERSION}/auth`,
      products: `/api/${API_VERSION}/products`,
      categories: `/api/${API_VERSION}/categories`,
      orders: `/api/${API_VERSION}/orders`,
      customers: `/api/${API_VERSION}/customers`,
      cart: `/api/${API_VERSION}/cart`,
      attributes: `/api/${API_VERSION}/attributes`,
      tags: `/api/${API_VERSION}/tags`
    }
  });
});

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful Shutdown
const server = app.listen(PORT, () => {
  logger.info(`🚀 BFF Server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;