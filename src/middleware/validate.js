const { validationResult, body, param, query } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Middleware to check validation results and throw errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    throw new ValidationError('Validation failed', { errors: errorMessages });
  }
  next();
};

/**
 * Input sanitization - removes potential XSS/injection patterns
 */
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Common validation chains
 */
const validators = {
  // Email validation
  email: () => body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email too long'),

  // Password validation
  password: () => body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  // Username validation
  username: () => body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  // Name validation
  firstName: () => body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required (max 50 chars)')
    .customSanitizer(sanitizeInput),

  lastName: () => body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name too long (max 50 chars)')
    .customSanitizer(sanitizeInput),

  // Order ID validation
  orderId: (location = 'body') => {
    const validator = location === 'params' ? param : body;
    return validator('order_id')
      .notEmpty()
      .withMessage('Order ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid order ID');
  },

  // Pagination
  page: () => query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  perPage: () => query('per_page')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Per page must be between 1 and 100')
    .toInt(),

  // Amount validation for payments/refunds
  amount: () => body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),

  // General string sanitization
  sanitizedString: (field, maxLength = 500) => body(field)
    .optional()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`${field} too long (max ${maxLength} chars)`)
    .customSanitizer(sanitizeInput),
};

/**
 * Validation rule sets for common endpoints
 */
const validationRules = {
  register: [
    validators.email(),
    validators.password(),
    validators.firstName(),
    validators.lastName(),
    validators.username(),
    handleValidationErrors,
  ],

  login: [
    body('login')
      .trim()
      .notEmpty()
      .withMessage('Email or username is required')
      .customSanitizer(sanitizeInput),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors,
  ],

  checkEmail: [
    validators.email(),
    handleValidationErrors,
  ],

  checkUsername: [
    validators.username(),
    handleValidationErrors,
  ],

  razorpayOrder: [
    body('order_id')
      .notEmpty()
      .withMessage('Order ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid order ID'),
    handleValidationErrors,
  ],

  paymentVerify: [
    body('razorpay_order_id')
      .notEmpty()
      .withMessage('Razorpay order ID is required'),
    body('razorpay_payment_id')
      .notEmpty()
      .withMessage('Razorpay payment ID is required'),
    body('razorpay_signature')
      .notEmpty()
      .withMessage('Razorpay signature is required'),
    body('wc_order_id')
      .notEmpty()
      .withMessage('WooCommerce order ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid WooCommerce order ID'),
    handleValidationErrors,
  ],

  refund: [
    body('wc_order_id')
      .notEmpty()
      .withMessage('Order ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid order ID'),
    validators.amount(),
    validators.sanitizedString('reason', 500),
    handleValidationErrors,
  ],

  pagination: [
    validators.page(),
    validators.perPage(),
    handleValidationErrors,
  ],
};

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  validators,
  validationRules,
};
