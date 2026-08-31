require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const initSockets = require('./sockets');
const ioRegistry = require('./sockets/ioRegistry');

const PORT = process.env.PORT || 5000;

// If the server restarts mid-round (a Render redeploy, a crash, the free
// tier waking from sleep, etc.), any in-memory scheduled timer is lost.
// Without this, an event could be stuck forever waiting for a bidding or
// answer window that will never auto-close. On boot, find any LIVE event
// sitting in BIDDING or QUESTION_ACTIVE and reschedule its auto-action for
// whatever time is left (or immediately, if the deadline already passed
// while the server was down).
async function recoverScheduledTimers() {
  const Event = require('./models/Event');
  const { scheduleAutoCloseAndReveal, scheduleAutoResolveTimeout } = require('./controllers/competitionController');

  const liveEvents = await Event.find({
    status: 'LIVE',
    competitionState: { $in: ['BIDDING', 'QUESTION_ACTIVE'] },
  });

  for (const event of liveEvents) {
    if (event.competitionState === 'BIDDING' && event.biddingEndsAt) {
      const delay = event.biddingEndsAt.getTime() - Date.now();
      scheduleAutoCloseAndReveal(event._id, delay);
      console.log(`[recovery] rescheduled bidding-close for event ${event._id} (${Math.round(delay / 1000)}s)`);
    } else if (event.competitionState === 'QUESTION_ACTIVE' && event.answerEndsAt) {
      const delay = event.answerEndsAt.getTime() - Date.now();
      scheduleAutoResolveTimeout(event._id, delay);
      console.log(`[recovery] rescheduled answer-timeout for event ${event._id} (${Math.round(delay / 1000)}s)`);
    }
  }
}

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
  });

  app.set('io', io); // kept for any code still reading req.app.get('io')
  ioRegistry.setIo(io);
  initSockets(io);

  await recoverScheduledTimers();

  server.listen(PORT, () => {
    console.log(`[server] CodeBid API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
