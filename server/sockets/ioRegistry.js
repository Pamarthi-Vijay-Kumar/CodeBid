// Holds the live Socket.IO server instance so code with no HTTP `req`
// object - specifically the scheduled timers that drive automatic round
// progression (auto-close bidding, auto-reveal the question, auto-resolve
// a timeout) - can still broadcast to clients. Set once in server.js at boot.
let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet.');
  }
  return ioInstance;
}

module.exports = { setIo, getIo };
