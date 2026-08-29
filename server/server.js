require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const initSockets = require('./sockets');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
  });

  app.set('io', io); // controllers broadcast via req.app.get('io')
  initSockets(io);

  server.listen(PORT, () => {
    console.log(`[server] CodeBid API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
