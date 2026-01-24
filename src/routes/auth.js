const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const wooCommerceClient = require('../services/woocommerceClient');
const verificationService = require('../services/verificationService');
const usernameService = require('../services/usernameService');
const { asyncHandler, ValidationError, UnauthorizedError: AuthenticationError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

let googleClient;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI) {
  googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
} else {
  logger.warn('⚠️ Google OAuth credentials missing. Google Auth will fail.');
}

// Helper to generate token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// --- VALIDATION ENDPOINTS ---

// POST /api/v1/auth/check-email
router.post('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Check WooCommerce
  const customers = await wooCommerceClient.get('/customers', { email }, { useCache: false });
  if (customers.length > 0) {
    return res.json({ available: false, message: 'Email already registered' });
  }

  // Check Pending Registrations (Optional but good UX)
  // Note: verificationService doesn't expose a quick lookup by email without iteration, skipping for performance or implementing later.
  
  res.json({ available: true });
}));

// POST /api/v1/auth/generate-username
router.post('/generate-username', asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;
  if (!firstName || !email) throw new ValidationError('Missing fields');

  const suggestions = await usernameService.generateSuggestions(firstName, lastName || '', email);
  res.json({ suggestions });
}));

// POST /api/v1/auth/check-username
router.post('/check-username', asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username) throw new ValidationError('Username required');

  const available = await usernameService.isUsernameAvailable(username);
  res.json({ available });
}));


// --- REGISTRATION FLOW ---

// POST /api/v1/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, username } = req.body;

  // Basic Validation
  if (!email || !password || !firstName || !username) {
    throw new ValidationError('All fields are required');
  }

  // 1. Verify Uniqueness again (Race condition check)
  const customers = await wooCommerceClient.get('/customers', { email }, { useCache: false });
  if (customers.length > 0) {
    throw new ValidationError('User already exists');
  }

  // 2. Create Pending Registration
  const token = await verificationService.createPendingRegistration({
    email,
    password, 
    firstName,
    lastName,
    username
  });

  res.status(201).json({
    success: true,
    message: 'Verification email sent',
    expiresIn: '24h'
  });
}));

// GET /api/v1/auth/verify-email/:token (Used by Mobile Deep Link to confirm validity or Browser Fallback)
// Actually, for Mobile: Mobile receives Deep Link -> Calls this endpoint to finalize.
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const pendingUser = verificationService.getPendingRegistration(token);
  
  if (!pendingUser) {
    throw new AuthenticationError('Invalid or expired verification link');
  }

  try {
    // 1. Create Customer in WooCommerce
    // Note: Password handling. WC usually hashes. We send plain, it hashes.
    const newCustomer = await wooCommerceClient.post('/customers', {
      email: pendingUser.email,
      first_name: pendingUser.firstName,
      last_name: pendingUser.lastName,
      username: pendingUser.username,
      password: pendingUser.password
    });

    // 2. Remove from pending
    verificationService.removePendingRegistration(token);

    // 3. Login (Generate Token)
    const jwtToken = generateToken({
      id: newCustomer.id,
      email: newCustomer.email,
      role: newCustomer.role
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: newCustomer.id,
        email: newCustomer.email,
        username: newCustomer.username,
        firstName: newCustomer.first_name,
        lastName: newCustomer.last_name,
        avatar: newCustomer.avatar_url
      }
    });

  } catch (error) {
    logger.error('WC Creation Failed:', error);
    throw new ValidationError(error.message || 'Failed to create account');
  }
}));

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', asyncHandler(async (req, res) => {
  const { email } = req.body;
  const sent = await verificationService.resendVerification(email);
  
  if (sent) {
    res.json({ success: true, message: 'Verification email resent' });
  } else {
    // Don't reveal if email not found for security, or send generic msg
    res.status(404).json({ success: false, message: 'Pending registration not found' });
  }
}));


// --- AUTHENTICATION ---

// --- MOBILE OTP FLOW --- (Removed)

// POST /api/v1/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ValidationError('Credentials required');

  // 1. Find customer
  const customers = await wooCommerceClient.get('/customers', { email, role: 'all' }, { useCache: false });
  
  if (customers.length === 0) {
    throw new AuthenticationError('Invalid credentials');
  }

  const user = customers[0];

  // 2. Verify Password - MOCK / WARNING
  // As established, we cannot verify WP hashes.
  // In production, you would hit a custom WP endpoint or use a JWT plugin on WP.
  // For this exercise, we proceed if user exists.
  logger.warn(`⚠️  Bypassing password verification for ${email}`);

  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar_url
    }
  });
}));

// --- GOOGLE OAUTH ---

// GET /api/v1/auth/google
// Initiates the flow - usually redirects the user's browser
router.get('/google', (req, res) => {
  if (!googleClient) {
    return res.status(503).send('Google OAuth not configured');
  }
  
  // Capture dynamic redirect scheme (e.g. from Expo Go)
  const state = req.query.redirect_scheme ? Buffer.from(JSON.stringify({ scheme: req.query.redirect_scheme })).toString('base64') : undefined;
  
  let redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=email%20profile`;

  if (state) {
    redirectUrl += `&state=${state}`;
  }
  
  res.redirect(redirectUrl);
});

// GET /api/v1/auth/google/callback
router.get('/google/callback', asyncHandler(async (req, res) => {
  if (!googleClient) {
    throw new ValidationError('Google OAuth not configured');
  }
  const { code, state } = req.query;

  if (!code) {
    throw new ValidationError('Authorization code is missing. Do not access this URL directly.');
  }

  // Determine Redirect Scheme
  let scheme = process.env.APP_DEEP_LINK_SCHEME || 'muoapp';

  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      if (decodedState.scheme) {
        scheme = decodedState.scheme;
      }
    } catch (e) {
      logger.warn('Failed to decode OAuth state:', e);
    }
  }
  
  // 1. Exchange code for tokens
  const { tokens } = await googleClient.getToken({
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI
  });
  
  // 2. Verify Id Token
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  const { email, given_name, family_name, sub } = payload; // sub is Google ID

  // 3. Check if user exists in WC
  let customers = await wooCommerceClient.get('/customers', { email, role: 'all' }, { useCache: false });
  let user;

  if (customers.length === 0) {
    // Create new user automatically
    // Generate unique username
    const username = `g_${email.split('@')[0]}_${Math.floor(Math.random() * 1000)}`;
    const password = `G!${Math.random().toString(36).slice(-10)}`; // Random password

    user = await wooCommerceClient.post('/customers', {
      email,
      first_name: given_name,
      last_name: family_name,
      username,
      password,
      meta_data: [{ key: 'google_id', value: sub }]
    });
  } else {
    user = customers[0];
  }

  // 4. Generate JWT
  const jwtToken = generateToken(user);
  
  // 5. Redirect back to Mobile App via Deep Link
  // App scheme: muoapp://auth-callback?token=...
  const appRedirect = `${scheme}://auth-callback?token=${jwtToken}&uId=${user.id}`;
  
  // Return HTML page to handle the deep link
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login Successful</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 40px 20px; background: #f9eceb; color: #4A1615; }
        .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
        .btn { display: inline-block; background: #661F1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="success-icon">✅</div>
        <h2>Authentication Successful</h2>
        <p>You have successfully logged in with Google.</p>
        <p>Opening the app...</p>
        <a href="${appRedirect}" class="btn">Open App</a>
      </div>
      <script>
        // Attempt to open the app automatically
        setTimeout(function() {
          window.location.href = "${appRedirect}";
        }, 1000);
      </script>
    </body>
    </html>
  `);
}));

// GET /api/v1/auth/verify-email-redirect/:token
// Browser fallback for email verification
router.get('/verify-email-redirect/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const pendingUser = verificationService.getPendingRegistration(token);

  if (!pendingUser) {
    return res.status(400).send('<h1>Invalid or Expired Link</h1><p>Please try registering again.</p>');
  }

  try {
    // 1. Create Customer
    const newCustomer = await wooCommerceClient.post('/customers', {
      email: pendingUser.email,
      first_name: pendingUser.firstName,
      last_name: pendingUser.lastName,
      username: pendingUser.username,
      password: pendingUser.password
    });

    // 2. Remove from pending
    verificationService.removePendingRegistration(token);

    // 3. Show Success Page
    res.send(`
      <div style="font-family: Arial; text-align: center; margin-top: 50px;">
        <h1 style="color: green;">Email Verified!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now return to the app and login.</p>
      </div>
    `);

  } catch (error) {
    logger.error('Fallback Verification Failed:', error);
    res.status(500).send(`<h1>Verification Failed</h1><p>${error.message}</p>`);
  }
}));

module.exports = router;