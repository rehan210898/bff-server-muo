const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validateJWT, validateAdmin, validateApiKey } = require('../middleware/auth');
const botpressMonitor = require('../services/botpressMonitor');

// GET /api/v1/chat/status
// Returns whether Botpress is available or user should use live chat
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    botpressAvailable: botpressMonitor.isAvailable(),
    botpressBotId: process.env.BOTPRESS_BOT_ID || null,
  });
}));

// GET /api/v1/chat/admin/sessions
// Returns list of active live chat sessions (admin only)
router.get('/admin/sessions', validateJWT, validateAdmin, asyncHandler(async (req, res) => {
  const getSessionList = req.app.get('getSessionList');
  if (!getSessionList) {
    return res.json({ success: true, sessions: [] });
  }

  res.json({
    success: true,
    sessions: getSessionList(),
  });
}));

// POST /api/v1/chat/admin/auth
// WP plugin auth: validates admin email against ADMIN_EMAILS, returns short-lived JWT for Socket.io
router.post('/admin/auth', validateApiKey, asyncHandler(async (req, res) => {
  const { email } = req.body;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (!email || !adminEmails.includes(email.toLowerCase())) {
    return res.status(403).json({ success: false, message: 'Not an admin email' });
  }

  const token = jwt.sign(
    { email: email.toLowerCase(), role: 'admin', source: 'wp-plugin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ success: true, token });
}));

module.exports = router;
