// In-memory per-event timer registry driving automatic round progression:
// bidding auto-closes (and the question auto-reveals to the winner) the
// moment the bidding timer expires, and a round auto-resolves as a timeout
// if nobody answers before the answer timer expires - so the organizer
// never has to click "Close bidding" / "Reveal question" / "Force timeout"
// at the exact right second.
//
// Assumes a single Node process (this app isn't horizontally scaled), so an
// in-memory Map is safe without a distributed lock. Every manual action
// that could race with a scheduled timer (closing bidding early, revealing
// early, an answer being submitted, pausing) cancels any pending timer for
// that event first, so nothing ever double-fires.
const timers = new Map(); // eventId (string) -> NodeJS.Timeout

function schedule(eventId, delayMs, fn) {
  cancel(eventId);
  const handle = setTimeout(async () => {
    timers.delete(String(eventId));
    try {
      await fn();
    } catch (err) {
      console.error(`[scheduler] auto-action failed for event ${eventId}:`, err.message);
    }
  }, Math.max(0, delayMs));
  // Don't let a pending timer keep the Node process alive by itself.
  if (handle.unref) handle.unref();
  timers.set(String(eventId), handle);
}

function cancel(eventId) {
  const existing = timers.get(String(eventId));
  if (existing) {
    clearTimeout(existing);
    timers.delete(String(eventId));
  }
}

function isPending(eventId) {
  return timers.has(String(eventId));
}

module.exports = { schedule, cancel, isPending };
