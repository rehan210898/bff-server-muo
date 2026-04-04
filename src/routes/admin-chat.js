const express = require('express');
const router = express.Router();
const path = require('path');

/**
 * GET /admin-chat
 * Serve the admin support dashboard HTML page
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'admin-chat.html'));
});

/**
 * GET /admin-chat/sessions
 * Get all active chat sessions (REST fallback for dashboard)
 */
router.get('/sessions', (req, res) => {
  // chatHandler's sessions are injected via middleware
  const sessions = req.app.get('chatSessions');
  if (!sessions) {
    return res.json({ success: true, sessions: [] });
  }

  const list = [];
  for (const [, session] of sessions) {
    list.push({
      id: session.id,
      userName: session.userName,
      mode: session.mode,
      messageCount: session.history.length,
      lastMessage: session.history[session.history.length - 1]?.content || '',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
  }

  res.json({ success: true, sessions: list });
});

module.exports = router;
