const jwt = require('jsonwebtoken');
const { notifyUser, notifyAdmins, registerAdminUserId } = require('./pushService');
const logger = require('../utils/logger');

const ADMIN_EMAILS = () => (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function initLiveChatHandler(io) {
  const sessions = new Map();     // sessionId -> session data
  const adminSockets = new Map(); // socketId -> { socket, email, userName }

  // Socket.io authentication middleware
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth?.apiKey;
    const token = socket.handshake.auth?.token;
    const origin = socket.handshake.headers?.origin || 'no-origin';

    logger.info(`Socket auth attempt from origin: ${origin}, apiKey: ${apiKey ? 'present' : 'missing'}, token: ${token ? 'present' : 'missing'}`);

    // Validate API key
    if (process.env.NODE_ENV !== 'development') {
      if (!apiKey || apiKey !== process.env.API_KEY) {
        logger.warn(`Socket auth rejected: invalid API key from origin ${origin}`);
        return next(new Error('Invalid API key'));
      }
    }

    // Parse JWT if present (optional for guest chat)
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        logger.info(`Socket auth: JWT verified for ${decoded.email || 'unknown'} (role: ${decoded.role || 'user'})`);
      } catch (err) {
        logger.warn(`Socket auth: JWT verification failed - ${err.message}`);
      }
    }

    next();
  });

  io.on('connection', (socket) => {
    const userEmail = socket.user?.email?.toLowerCase() || '';
    const isAdmin = ADMIN_EMAILS().includes(userEmail);

    // ─── Admin Events ──────────────────────────────────────────
    if (isAdmin) {
      logger.info(`Admin connected: ${userEmail} (${socket.id})`);
      adminSockets.set(socket.id, {
        socket,
        email: userEmail,
        userName: socket.user?.email || 'Admin',
        userId: socket.user?.id,
      });

      // Register admin userId for push notifications
      if (socket.user?.id) {
        registerAdminUserId(socket.user.id);
      }

      // Send current session list to admin
      socket.emit('admin:chat_list', getSessionList());

      socket.on('admin:accept_chat', ({ sessionId }) => {
        const session = sessions.get(sessionId);
        if (!session) return;

        session.agentId = socket.id;
        session.agentName = userEmail;
        session.agentUserId = socket.user?.id;

        // Join the session room
        socket.join(`session:${sessionId}`);

        // Send chat history to admin
        socket.emit('admin:chat_history', {
          sessionId,
          userName: session.userName,
          userId: session.userId,
          history: session.history,
        });

        // Notify user that agent connected
        const userSocket = io.sockets.sockets.get(session.socketId);
        if (userSocket) {
          userSocket.emit('livechat:agent_connected', {
            agentName: 'Support Agent',
          });
        }

        // Broadcast updated session list to all admins
        broadcastSessionList();
      });

      socket.on('admin:message', ({ sessionId, message }) => {
        const session = sessions.get(sessionId);
        if (!session || !message?.trim()) return;

        const msg = {
          id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          role: 'agent',
          content: message.trim(),
          timestamp: new Date().toISOString(),
          agentName: userEmail,
        };

        session.history.push(msg);
        session.updatedAt = new Date().toISOString();

        // Send to user
        const userSocket = io.sockets.sockets.get(session.socketId);
        if (userSocket) {
          userSocket.emit('livechat:message', msg);
        }

        // Broadcast to other admins in this session room
        socket.to(`session:${sessionId}`).emit('admin:user_message', {
          sessionId,
          message: msg,
        });

        // Push notify user (if app is backgrounded)
        if (session.userId) {
          notifyUser(session.userId, {
            title: 'MakeupOcean Support',
            body: message.trim().substring(0, 100),
            data: {
              type: 'LIVE_CHAT_MESSAGE',
              screen: 'Chat',
            },
          }).catch(err => logger.error('Failed to push notify user:', err.message));
        }
      });

      socket.on('admin:typing', ({ sessionId }) => {
        const session = sessions.get(sessionId);
        if (!session) return;

        const userSocket = io.sockets.sockets.get(session.socketId);
        if (userSocket) {
          userSocket.emit('livechat:agent_typing');
        }
      });

      socket.on('disconnect', () => {
        adminSockets.delete(socket.id);
        logger.info(`Admin disconnected: ${userEmail}`);
      });

      return; // Don't process user events for admin sockets
    }

    // ─── User Events ───────────────────────────────────────────
    socket.on('livechat:join', ({ userName, userId }) => {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      const session = {
        id: sessionId,
        userId: userId || socket.user?.id || null,
        userName: userName || 'Guest',
        socketId: socket.id,
        agentId: null,
        agentName: null,
        agentUserId: null,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      sessions.set(sessionId, session);
      socket.join(`session:${sessionId}`);

      // Confirm join to user
      socket.emit('livechat:joined', {
        sessionId,
        message: 'Connected to live support. An agent will be with you shortly.',
      });

      // Add system message
      const systemMsg = {
        id: `sys_${Date.now()}`,
        role: 'system',
        content: 'You are now connected to live support. An agent will be with you shortly.',
        timestamp: new Date().toISOString(),
      };
      session.history.push(systemMsg);

      // Notify all connected admins about new chat
      broadcastSessionList();
      for (const [, admin] of adminSockets) {
        admin.socket.emit('admin:new_chat', {
          sessionId,
          userName: session.userName,
          userId: session.userId,
          createdAt: session.createdAt,
        });
      }

      // Push notify admins
      notifyAdmins({
        title: 'New Chat Request',
        body: `${session.userName} needs support`,
        data: {
          type: 'LIVE_CHAT_MESSAGE',
          screen: 'AdminConversation',
          params: { sessionId, userName: session.userName },
        },
      }).catch(err => logger.error('Failed to push notify admins:', err.message));

      logger.info(`Live chat session created: ${sessionId} by ${session.userName}`);
    });

    // Reconnect to existing session (prevents duplicates on network drops)
    socket.on('livechat:reconnect', ({ sessionId }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        socket.emit('livechat:error', { message: 'Session expired' });
        return;
      }

      // Update socket reference
      session.socketId = socket.id;
      session.disconnectedAt = null;
      socket.join(`session:${sessionId}`);

      socket.emit('livechat:reconnected', {
        sessionId,
        history: session.history,
        agentConnected: !!session.agentId,
      });

      broadcastSessionList();
      logger.info(`Session reconnected: ${sessionId}`);
    });

    socket.on('livechat:message', ({ sessionId, message }) => {
      const session = sessions.get(sessionId);
      if (!session || !message?.trim()) return;

      const msg = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };

      session.history.push(msg);
      session.updatedAt = new Date().toISOString();

      // Send to assigned agent + all admins in the session room
      socket.to(`session:${sessionId}`).emit('admin:user_message', {
        sessionId,
        message: msg,
      });

      // Also notify all connected admins (for session list updates)
      for (const [, admin] of adminSockets) {
        admin.socket.emit('admin:session_updated', {
          sessionId,
          lastMessage: msg.content,
          updatedAt: session.updatedAt,
        });
      }

      // Push notify admins if no admin is actively connected to this session
      const agentSocket = session.agentId ? io.sockets.sockets.get(session.agentId) : null;
      if (!agentSocket) {
        notifyAdmins({
          title: `Message from ${session.userName}`,
          body: message.trim().substring(0, 100),
          data: {
            type: 'LIVE_CHAT_MESSAGE',
            screen: 'AdminConversation',
            params: { sessionId, userName: session.userName },
          },
        }).catch(err => logger.error('Failed to push notify admins:', err.message));
      }
    });

    socket.on('livechat:typing', ({ sessionId }) => {
      const session = sessions.get(sessionId);
      if (!session) return;

      // Notify admins in the session room
      socket.to(`session:${sessionId}`).emit('admin:user_typing', { sessionId });
    });

    socket.on('disconnect', () => {
      // Find and clean up user's session
      for (const [sessionId, session] of sessions) {
        if (session.socketId === socket.id) {
          // Notify admins of user disconnect
          for (const [, admin] of adminSockets) {
            admin.socket.emit('admin:user_disconnected', { sessionId });
          }

          // Keep session for 30 minutes in case user reconnects
          session.disconnectedAt = new Date().toISOString();
          setTimeout(() => {
            const s = sessions.get(sessionId);
            if (s && s.disconnectedAt) {
              sessions.delete(sessionId);
              broadcastSessionList();
              logger.info(`Stale session cleaned up: ${sessionId}`);
            }
          }, 30 * 60 * 1000);

          break;
        }
      }
    });
  });

  function getSessionList() {
    const list = [];
    for (const [sessionId, session] of sessions) {
      const lastMsg = session.history[session.history.length - 1];
      list.push({
        sessionId,
        userName: session.userName,
        userId: session.userId,
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.timestamp || session.createdAt,
        hasAgent: !!session.agentId,
        agentName: session.agentName,
        messageCount: session.history.filter(m => m.role === 'user').length,
        createdAt: session.createdAt,
        disconnected: !!session.disconnectedAt,
      });
    }
    return list.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  }

  function broadcastSessionList() {
    const list = getSessionList();
    for (const [, admin] of adminSockets) {
      admin.socket.emit('admin:chat_list', list);
    }
  }

  // Clean up stale sessions every 30 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      const age = now - new Date(session.updatedAt).getTime();
      if (age > 2 * 60 * 60 * 1000) { // 2 hours idle
        sessions.delete(sessionId);
        logger.info(`Session expired: ${sessionId}`);
      }
    }
    broadcastSessionList();
  }, 30 * 60 * 1000);

  return { sessions, getSessionList };
}

module.exports = { initLiveChatHandler };
