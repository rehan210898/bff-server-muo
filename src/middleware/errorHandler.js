const logger = require('../utils/logger');

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = {
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'route_not_found',
    path: req.originalUrl,
    method: req.method
  };

  logger.warn(`404 - ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
  
  res.status(404).json(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  
  logger.error('Error Handler:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error',
    code: err.code || 'internal_error'
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.code = 'validation_error';
    errorResponse.errors = err.errors;
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorResponse.code = 'unauthorized';
  }

  if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorResponse.code = 'forbidden';
  }

  if (err.status && err.code && err.data) {
    statusCode = err.status;
    errorResponse.code = err.code;
    errorResponse.woocommerce_error = err.data;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async handler wrapper to catch promise rejections
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'validation_error');
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'forbidden');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found');
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
};