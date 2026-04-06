const jwt = require('jsonwebtoken');
const aiService = require('./aiService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * In-memory chat session store.
 * In production, replace with Redis for multi-instance support.
 */
const sessions = new Map();
const adminSockets = new Map(); // socketId -> admin info

/**
 * Chat session structure
 */
function createSession(userId, userName, customerId, socketId) {
  return {
    id: uuidv4(),
    userId,
    userName: userName || 'Guest',
    customerId: customerId || null,
    socketId,
    mode: 'AI',           // 'AI' | 'HUMAN' | 'PENDING_HUMAN'
    history: [],           // [{role, content, timestamp, products?}]
    createdAt: Date.now(),
    updatedAt: Date.now(),
    assignedAdmin: null    // admin socketId handling this chat
  };
}

/**
 * Initialize Socket.io chat handler
 */
function initChatHandler(io) {
  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const apiKey = socket.handshake.auth?.apiKey;

    // Validate API key
    if (process.env.NODE_ENV !== 'development') {
      if (apiKey !== process.env.API_KEY) {
        return next(new Error('Invalid API key'));
      }
    }

    // Parse JWT if provided (authenticated user)
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
      } catch (err) {
        // Allow guest connections (unauthenticated)
        socket.user = null;
      }
    }

    next();
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} | User: ${socket.user?.email || 'Guest'}`);

    // ─── Client Events ───────────────────────────────────────────────

    /**
     * Client joins chat — creates or resumes session
     */
    socket.on('chat:join', (data = {}) => {
      const userId = socket.user?.id || socket.id;
      const userName = data.userName || socket.user?.firstName || 'Guest';
      const customerId = socket.user?.customerId || null;

      // Check for existing session
      let session = null;
      for (const [, s] of sessions) {
        if (s.userId === userId) {
          session = s;
          session.socketId = socket.id; // Update socket reference
          break;
        }
      }

      if (!session) {
        session = createSession(userId, userName, customerId, socket.id);
        sessions.set(session.id, session);
      }

      socket.sessionId = session.id;
      socket.join(`chat:${session.id}`);

      socket.emit('chat:joined', {
        sessionId: session.id,
        mode: session.mode,
        history: session.history.map(h => ({
          id: h.id,
          role: h.role,
          content: h.content,
          timestamp: h.timestamp,
          products: h.products || []
        }))
      });

      logger.info(`Chat session ${session.id} | Mode: ${session.mode} | User: ${userName}`);
    });

    /**
     * Client sends a message
     */
    socket.on('chat:message', async (data) => {
      const session = sessions.get(socket.sessionId);
      if (!session) {
        socket.emit('chat:error', { message: 'No active chat session. Please reconnect.' });
        return;
      }

      const { message } = data;
      if (!message || typeof message !== 'string' || message.trim().length === 0) return;
      if (message.length > 2000) {
        socket.emit('chat:error', { message: 'Message too long (max 2000 characters).' });
        return;
      }

      const userMsg = {
        id: uuidv4(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now()
      };
      session.history.push(userMsg);
      session.updatedAt = Date.now();

      // Broadcast to admins watching this chat
      io.to(`admin:${session.id}`).emit('chat:user_message', {
        sessionId: session.id,
        message: userMsg
      });

      if (session.mode === 'AI') {
        await handleAIResponse(io, socket, session, message.trim());
      } else if (session.mode === 'HUMAN') {
        // Message already broadcasted to admin room above
        // Just acknowledge to client
        socket.emit('chat:message_ack', { id: userMsg.id });
      } else if (session.mode === 'PENDING_HUMAN') {
        socket.emit('chat:status', {
          message: 'Waiting for a support agent to connect. Your message has been queued.'
        });
      }
    });

    /**
     * Client requests human support
     */
    socket.on('chat:request_human', (data = {}) => {
      const session = sessions.get(socket.sessionId);
      if (!session) return;

      switchToHuman(io, socket, session, data.reason || 'User requested human support');
    });

    /**
     * Client typing indicator
     */
    socket.on('chat:typing', () => {
      const session = sessions.get(socket.sessionId);
      if (session) {
        io.to(`admin:${session.id}`).emit('chat:user_typing', {
          sessionId: session.id,
          userName: session.userName
        });
      }
    });

    /**
     * Client disconnects
     */
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} | Reason: ${reason}`);

      // Notify admins if this was a customer
      const session = sessions.get(socket.sessionId);
      if (session) {
        io.to(`admin:${session.id}`).emit('chat:user_disconnected', {
          sessionId: session.id,
          userName: session.userName
        });
      }

      // Clean up admin tracking
      adminSockets.delete(socket.id);
    });

    // ─── Admin Events ────────────────────────────────────────────────

    /**
     * Admin joins the admin room to see all pending chats
     */
    socket.on('admin:join', (data = {}) => {
      // Verify admin (in production, check admin JWT claim)
      const adminName = data.name || 'Support Agent';
      adminSockets.set(socket.id, { name: adminName, joinedAt: Date.now() });
      socket.join('admin:lobby');

      // Send list of active sessions needing human support
      const pendingChats = [];
      for (const [, session] of sessions) {
        if (session.mode === 'PENDING_HUMAN' || session.mode === 'HUMAN') {
          pendingChats.push({
            sessionId: session.id,
            userName: session.userName,
            mode: session.mode,
            assignedAdmin: session.assignedAdmin,
            lastMessage: session.history[session.history.length - 1]?.content || '',
            createdAt: session.createdAt
          });
        }
      }

      socket.emit('admin:chat_list', { chats: pendingChats });
      logger.info(`Admin joined: ${adminName} (${socket.id})`);
    });

    /**
     * Admin picks up a chat
     */
    socket.on('admin:accept_chat', (data) => {
      const { sessionId } = data;
      const session = sessions.get(sessionId);
      if (!session) {
        socket.emit('admin:error', { message: 'Chat session not found' });
        return;
      }

      session.mode = 'HUMAN';
      session.assignedAdmin = socket.id;
      session.updatedAt = Date.now();

      // Admin joins the chat room
      socket.join(`admin:${sessionId}`);

      // Send full history to admin
      socket.emit('admin:chat_history', {
        sessionId,
        userName: session.userName,
        history: session.history
      });

      // Notify the customer
      io.to(`chat:${sessionId}`).emit('chat:human_connected', {
        message: 'A support agent has joined the chat. How can we help?'
      });

      // Notify admin lobby
      io.to('admin:lobby').emit('admin:chat_accepted', {
        sessionId,
        adminName: adminSockets.get(socket.id)?.name
      });

      logger.info(`Admin ${socket.id} accepted chat ${sessionId}`);
    });

    /**
     * Admin sends a message to a customer
     */
    socket.on('admin:message', (data) => {
      const { sessionId, message } = data;
      const session = sessions.get(sessionId);
      if (!session) return;

      const adminMsg = {
        id: uuidv4(),
        role: 'assistant',
        content: message,
        timestamp: Date.now(),
        isHuman: true
      };
      session.history.push(adminMsg);
      session.updatedAt = Date.now();

      // Send to customer
      io.to(`chat:${sessionId}`).emit('chat:message', {
        ...adminMsg,
        sessionId
      });
    });

    /**
     * Admin transfers chat back to AI
     */
    socket.on('admin:transfer_to_ai', (data) => {
      const { sessionId } = data;
      const session = sessions.get(sessionId);
      if (!session) return;

      session.mode = 'AI';
      session.assignedAdmin = null;
      session.updatedAt = Date.now();

      socket.leave(`admin:${sessionId}`);

      io.to(`chat:${sessionId}`).emit('chat:mode_changed', {
        mode: 'AI',
        message: "You're now chatting with Mia, our AI assistant."
      });

      logger.info(`Chat ${sessionId} transferred back to AI`);
    });

    /**
     * Admin typing indicator
     */
    socket.on('admin:typing', (data) => {
      const { sessionId } = data;
      io.to(`chat:${sessionId}`).emit('chat:agent_typing');
    });
  });

  // Clean up stale sessions every 30 minutes
  setInterval(() => {
    const staleThreshold = Date.now() - (60 * 60 * 1000); // 1 hour
    for (const [id, session] of sessions) {
      if (session.updatedAt < staleThreshold) {
        sessions.delete(id);
        logger.info(`Cleaned up stale session: ${id}`);
      }
    }
  }, 30 * 60 * 1000);

  return { sessions, adminSockets };
}

/**
 * Handle AI response with streaming
 */
async function handleAIResponse(io, socket, session, message) {
  // Notify client that AI is "typing"
  socket.emit('chat:ai_typing', { typing: true });

  const msgId = uuidv4();
  let streamedText = '';

  try {
    const userContext = {
      userId: session.userId,
      userName: session.userName,
      customerId: session.customerId
    };

    const history = session.history.slice(0, -1).map(h => ({
      role: h.role,
      content: h.content
    }));

    const result = await aiService.processMessage(
      message,
      history,
      userContext,
      // Stream callback
      (chunk) => {
        streamedText += chunk;
        socket.emit('chat:stream', {
          id: msgId,
          chunk,
          done: false
        });
      }
    );

    // If no streaming happened (mock mode or non-streaming path)
    if (!streamedText && result.text) {
      socket.emit('chat:stream', {
        id: msgId,
        chunk: result.text,
        done: false
      });
    }

    // Send final complete message
    const aiMsg = {
      id: msgId,
      role: 'assistant',
      content: result.text,
      timestamp: Date.now(),
      products: result.products || []
    };

    session.history.push(aiMsg);
    session.updatedAt = Date.now();

    socket.emit('chat:stream', { id: msgId, chunk: '', done: true });
    socket.emit('chat:message', aiMsg);
    socket.emit('chat:ai_typing', { typing: false });

    // Handle escalation to human
    if (result.escalateHuman) {
      switchToHuman(io, socket, session, 'AI escalation');
    }
  } catch (error) {
    logger.error('AI response error:', error.message);
    socket.emit('chat:ai_typing', { typing: false });

    // Auto-escalate to human support on API limit errors
    const status = error.status || error.httpStatusCode || error.code;
    const isLimitError = status === 429 || status === 'RESOURCE_EXHAUSTED' ||
      /rate.limit|quota|too.many.requests/i.test(error.message);

    if (isLimitError) {
      logger.warn(`AI API limit reached for session ${session.id} — auto-escalating to human support`);
      const limitMsg = {
        id: msgId,
        role: 'assistant',
        content: "Our AI assistant is temporarily unavailable due to high demand. I'm connecting you with our support team right away!",
        timestamp: Date.now(),
        products: []
      };
      session.history.push(limitMsg);
      socket.emit('chat:message', limitMsg);
      switchToHuman(io, socket, session, 'AI API limit reached — auto-escalation');
      return;
    }

    const errorMsg = {
      id: msgId,
      role: 'assistant',
      content: "I'm sorry, I'm having a moment. Could you try again, or would you like to speak with our support team?",
      timestamp: Date.now(),
      products: []
    };
    session.history.push(errorMsg);
    socket.emit('chat:message', errorMsg);
  }
}

/**
 * Switch session to human support mode
 */
function switchToHuman(io, socket, session, reason) {
  session.mode = 'PENDING_HUMAN';
  session.updatedAt = Date.now();

  // Notify client
  socket.emit('chat:mode_changed', {
    mode: 'PENDING_HUMAN',
    message: "I'm connecting you with a support agent. Please hold on..."
  });

  // Notify admin lobby
  io.to('admin:lobby').emit('admin:new_chat', {
    sessionId: session.id,
    userName: session.userName,
    reason,
    lastMessage: session.history[session.history.length - 1]?.content || '',
    createdAt: session.createdAt
  });

  logger.info(`Chat ${session.id} requesting human support: ${reason}`);
}

module.exports = { initChatHandler };
