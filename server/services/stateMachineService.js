const ApiError = require('../utils/ApiError');

// Section 32 — strict server-side competition state machine.
// Only the transitions listed here are legal; everything else is rejected.
const TRANSITIONS = {
  DRAFT: ['READY'],
  READY: ['LIVE'],
  LIVE: ['QUESTION_INFO'],
  QUESTION_INFO: ['BIDDING'],
  BIDDING: ['BID_CLOSED'],
  BID_CLOSED: ['QUESTION_ACTIVE'],
  QUESTION_ACTIVE: ['ANSWER_SUBMITTED', 'RESULT'], // RESULT directly on timeout
  ANSWER_SUBMITTED: ['RESULT'],
  RESULT: ['LEADERBOARD'],
  LEADERBOARD: ['NEXT_ROUND', 'COMPLETED'],
  NEXT_ROUND: ['QUESTION_INFO', 'COMPLETED'],
  COMPLETED: [],
};

// PAUSED can be entered from any "live" state and resumed back to it.
const PAUSABLE_STATES = new Set([
  'LIVE', 'QUESTION_INFO', 'BIDDING', 'BID_CLOSED', 'QUESTION_ACTIVE',
  'ANSWER_SUBMITTED', 'RESULT', 'LEADERBOARD', 'NEXT_ROUND',
]);

function assertTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ApiError(409, `Cannot move from ${from} to ${to}.`);
  }
}

function canPause(state) {
  return PAUSABLE_STATES.has(state);
}

module.exports = { TRANSITIONS, assertTransition, canPause };
