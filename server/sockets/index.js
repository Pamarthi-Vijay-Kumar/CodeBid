const { verifyToken } = require('../utils/token');
const Event = require('../models/Event');

// All real-time state flows server -> client only. Clients never emit
// competition-state-changing events directly to sockets; they call the REST
// API, which validates + persists, and the API handler broadcasts the result.
// This keeps a single source of truth and avoids "trust the socket" bugs.
module.exports = function initSockets(io) {
  io.use((socket, next) => {
    // Optional auth: spectators can connect without a token.
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.data.auth = verifyToken(token);
      } catch (err) {
        // Invalid token -> treat as anonymous spectator rather than rejecting.
        socket.data.auth = null;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.on('event:join', async ({ eventId }) => {
      if (!eventId) return;
      const event = await Event.findById(eventId).select('_id');
      if (!event) return socket.emit('error', { message: 'Event not found.' });

      socket.join(`event:${eventId}`);
      socket.emit('event:joined', { eventId });
    });

    socket.on('event:leave', ({ eventId }) => {
      if (eventId) socket.leave(`event:${eventId}`);
    });

    socket.on('disconnect', () => {
      // No server-side state tied to socket lifetime - competition state
      // lives in MongoDB (Section 59), so disconnects are harmless.
    });
  });
};
