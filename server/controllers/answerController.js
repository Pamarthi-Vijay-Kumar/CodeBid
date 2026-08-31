const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Bid = require('../models/Bid');
const Answer = require('../models/Answer');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');
const EventQuestion = require('../models/EventQuestion');
const Question = require('../models/Question');
const CompetitionRound = require('../models/CompetitionRound');
const { resolveOutcome } = require('../services/scoringService');
const { assertTransition } = require('../services/stateMachineService');
const { getIo, room } = require('./competitionController');
const scheduler = require('../services/schedulerService');

// Shared resolver used by explicit submission, the organizer's manual
// "Force timeout" button, and the automatic timeout fired by the scheduler
// when the answer window expires with nobody answering.
async function resolveAnswer({ event, submittedAnswer, isTimeout }) {
  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  const eq = await EventQuestion.findById(eqId);
  const question = await Question.findById(eq.questionId).select('+correctAnswer');

  const winningBid = await Bid.findById(event.currentWinningBidId);
  if (!winningBid) throw new ApiError(409, 'There is no winning bid for this round.');

  const existing = await Answer.findOne({ eventQuestionId: eqId, teamId: winningBid.teamId });
  if (existing) throw new ApiError(409, 'An answer has already been submitted for this question.');

  const isCorrect = !isTimeout && submittedAnswer != null &&
    String(submittedAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();

  const outcome = resolveOutcome({
    isCorrect,
    isTimeout,
    bidAmount: winningBid.amount,
    difficulty: question.difficulty,
    event,
  });

  const team = await Team.findById(winningBid.teamId);
  const newBalance = team.currentBalance + outcome.delta - outcome.penalty;
  team.currentBalance = newBalance;

  if (outcome.result === 'CORRECT') team.stats.correctAnswers += 1;
  if (outcome.result === 'WRONG') team.stats.wrongAnswers += 1;
  if (outcome.result === 'TIMEOUT') team.stats.timeouts += 1;
  team.stats.totalRewards += outcome.reward || 0;
  team.stats.totalLosses += outcome.penalty || 0;
  await team.save();

  const answer = await Answer.create({
    eventId: event._id,
    eventQuestionId: eqId,
    teamId: team._id,
    bidId: winningBid._id,
    submittedAnswer: isTimeout ? null : submittedAnswer,
    isCorrect: isTimeout ? null : isCorrect,
    result: outcome.result,
    submittedAt: isTimeout ? null : new Date(),
    rewardAmount: outcome.reward || 0,
    penaltyAmount: outcome.penalty || 0,
  });

  const txType = outcome.result === 'CORRECT' ? 'CORRECT_REWARD'
    : outcome.result === 'WRONG' ? 'WRONG_PENALTY' : 'TIMEOUT_PENALTY';
  const txAmount = outcome.result === 'CORRECT' ? outcome.reward : -outcome.penalty;

  await Transaction.create({
    eventId: event._id,
    teamId: team._id,
    eventQuestionId: eqId,
    type: txType,
    amount: txAmount,
    balanceAfter: team.currentBalance,
    note: `Bid ${winningBid.amount} on question - ${outcome.result}`,
  });

  eq.status = 'COMPLETED';
  await eq.save();

  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    { result: outcome.result, completedAt: new Date() }
  );

  event.competitionState = 'RESULT';
  await event.save();

  const io = getIo();
  io.to(room(event._id)).emit('answer:result', {
    teamId: team._id,
    teamName: team.teamName,
    result: outcome.result,
    correctAnswer: question.correctAnswer,
    bidAmount: winningBid.amount,
    rewardAmount: outcome.reward || 0,
    penaltyAmount: outcome.penalty || 0,
    newBalance: team.currentBalance,
  });
  io.to(room(event._id)).emit('balance:updated', { teamId: team._id, newBalance: team.currentBalance });

  return { answer, team, outcome, question };
}

// Called by the scheduler when the answer window expires with no
// submission - the automatic version of "Force timeout".
async function resolveTimeoutInternal(event) {
  return resolveAnswer({ event, submittedAnswer: null, isTimeout: true });
}
module.exports.resolveTimeoutInternal = resolveTimeoutInternal;

// Only the winning team may call this, and only once.
exports.submitAnswer = asyncHandler(async (req, res) => {
  const event = req.event;
  const team = req.auth.team;

  if (event.competitionState !== 'QUESTION_ACTIVE') {
    throw new ApiError(409, 'Answering is not currently open.');
  }
  if (!event.currentWinningTeamId || String(event.currentWinningTeamId) !== String(team._id)) {
    throw new ApiError(403, 'You are not the winning team for this question.');
  }
  if (event.answerEndsAt && new Date() > event.answerEndsAt) {
    throw new ApiError(409, 'The answer time has expired.');
  }

  const { answer } = req.body;
  if (answer == null || answer === '') throw new ApiError(400, 'An answer is required.');

  assertTransition(event.competitionState, 'ANSWER_SUBMITTED');
  // The team beat the auto-timeout - cancel it so it doesn't fire on top
  // of this (harmless either way, since the state guard below would make
  // it a no-op, but this avoids the wasted DB round-trip).
  scheduler.cancel(event._id);

  const result = await resolveAnswer({ event, submittedAnswer: answer, isTimeout: false });

  res.json({
    success: true,
    result: result.outcome.result,
    rewardAmount: result.outcome.reward || 0,
    penaltyAmount: result.outcome.penalty || 0,
    newBalance: result.team.currentBalance,
  });
});

// Manual "Force timeout" button - same effect as the automatic timeout,
// just triggered early by the organizer.
exports.forceTimeout = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.competitionState !== 'QUESTION_ACTIVE') {
    throw new ApiError(409, 'No active question to time out.');
  }
  if (event.answerEndsAt && new Date() < event.answerEndsAt) {
    throw new ApiError(409, 'Answer time has not expired yet.');
  }
  scheduler.cancel(event._id);
  const result = await resolveAnswer({ event, submittedAnswer: null, isTimeout: true });
  res.json({ success: true, result: result.outcome.result });
});

// BID_CLOSED with zero bids -> skip straight to RESULT/leaderboard without an answer phase.
exports.skipNoBidsRound = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.competitionState !== 'BID_CLOSED') throw new ApiError(409, 'Not in bid-closed state.');
  if (event.currentWinningTeamId) throw new ApiError(409, 'This round has a winning bidder.');

  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  await EventQuestion.updateOne({ _id: eqId }, { status: 'COMPLETED' });
  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    { result: 'NO_BIDS', completedAt: new Date() }
  );
  event.competitionState = 'RESULT';
  await event.save();

  getIo().to(room(event._id)).emit('answer:result', { result: 'NO_BIDS' });
  res.json({ success: true });
});

// RESULT -> LEADERBOARD (organizer advances after reviewing the outcome).
exports.showLeaderboard = asyncHandler(async (req, res) => {
  const event = req.event;
  assertTransition(event.competitionState, 'LEADERBOARD');
  event.competitionState = 'LEADERBOARD';
  await event.save();
  getIo().to(room(event._id)).emit('leaderboard:updated', {});
  res.json({ success: true, event });
});
