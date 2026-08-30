const ApiError = require('../utils/ApiError');

// Section 32 — strict server-side competition state machine.
// Only the transitions listed here are legal; everything else is rejected.
//
// NOTE: an earlier version of this map had a LEADERBOARD -> NEXT_ROUND ->
// QUESTION_INFO chain, but no controller ever actually produced the
// NEXT_ROUND state - nothing set competitionState to it. That meant every
// event would work for exactly one question and then dead-end: clicking
// "Start / Next question" from LEADERBOARD was rejected because LEADERBOARD
// could only go to NEXT_ROUND or COMPLETED, and nothing could ever reach
// NEXT_ROUND to continue from. Collapsed here into a direct transition.
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
  LEADERBOARD: ['QUESTION_INFO', 'COMPLETED'],
  COMPLETED: [],
};

// PAUSED can be entered from any "live" state and resumed back to it.
const PAUSABLE_STATES = new Set([
  'LIVE', 'QUESTION_INFO', 'BIDDING', 'BID_CLOSED', 'QUESTION_ACTIVE',
  'ANSWER_SUBMITTED', 'RESULT', 'LEADERBOARD',
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
