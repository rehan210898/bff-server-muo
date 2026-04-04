require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { validateApiKey } = require('./middleware/auth');
const logger = require('./utils/logger');
const { validateEnv } = require('./utils/envValidator');
const { initChatHandler } = require('./services/chatHandler');

// Validate environment variables on startup
if (!validateEnv()) {
  logger.error('Server startup aborted due to environment validation failure');
  process.exit(1);
}

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
const notificationRoutes = require('./routes/notifications');
const wooWebhookRoutes = require('./routes/woowebhook');
const adminChatRoutes = require('./routes/admin-chat');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// ─── Socket.io Setup ─────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:19006'];

const io = new SocketIO(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6  // 1MB max message size
});

// Initialize chat handler & store sessions on app for REST access
const { sessions: chatSessions } = initChatHandler(io);
app.set('chatSessions', chatSessions);

// Trust proxy - important for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// URL Normalization Middleware
app.use((req, res, next) => {
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  next();
});

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

// CORS Configuration (allowedOrigins defined above with Socket.io)
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

// Step 19: Compression Middleware with level & threshold
app.use(compression({ level: 6, threshold: 1024 }));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Step 14: Request timing middleware (APM)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(1)}ms`);
  });
  next();
});

// Step 7: Per-request timeout middleware (30s)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timeout' });
    }
  });
  next();
});

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

// Step 6: Cache-Control header middleware factory
const cacheControl = (maxAge, swr = 0) => (req, res, next) => {
  if (req.method === 'GET') {
    let value = `public, max-age=${maxAge}`;
    if (swr) value += `, stale-while-revalidate=${swr}`;
    res.set('Cache-Control', value);
  }
  next();
};
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache');
  next();
};

// Public routes (no auth required)
app.use(`/api/${API_VERSION}/health`, healthRoutes);
app.use(`/api/${API_VERSION}/woowebhook`, noCache, wooWebhookRoutes);

// API Key Validation Middleware (for all other routes)
app.use(`/api/${API_VERSION}`, validateApiKey);

// API Routes with per-route Cache-Control headers
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/products`, cacheControl(120, 300), productRoutes);
app.use(`/api/${API_VERSION}/categories`, cacheControl(3600), categoryRoutes);
app.use(`/api/${API_VERSION}/orders`, noCache, orderRoutes);
app.use(`/api/${API_VERSION}/customers`, noCache, customerRoutes);
app.use(`/api/${API_VERSION}/cart`, noCache, cartRoutes);
app.use(`/api/${API_VERSION}/attributes`, cacheControl(3600), attributeRoutes);
app.use(`/api/${API_VERSION}/tags`, cacheControl(3600), tagRoutes);
app.use(`/api/${API_VERSION}/layout`, cacheControl(300), layoutRoutes);
app.use(`/api/${API_VERSION}/payment`, noCache, paymentRoutes);
app.use(`/api/${API_VERSION}/store`, noCache, storeRoutes);
app.use(`/api/${API_VERSION}/config`, cacheControl(1800), configRoutes);
app.use(`/api/${API_VERSION}/notifications`, noCache, notificationRoutes);
app.use(`/api/${API_VERSION}/admin-chat`, noCache, adminChatRoutes);

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

// Graceful Shutdown — use httpServer (Socket.io + Express)
const server = httpServer.listen(PORT, () => {
  logger.info(`🚀 BFF Server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
  logger.info(`💬 Socket.io chat server ready`);
  logger.info(`🖥️  Admin dashboard: http://localhost:${PORT}/api/${API_VERSION}/admin-chat`);
});

// Step 7: Server keep-alive & request timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.timeout = 60000;

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  io.close();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  io.close();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;