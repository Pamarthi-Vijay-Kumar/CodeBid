const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Event = require('../models/Event');
const EventQuestion = require('../models/EventQuestion');
const Question = require('../models/Question');
const Bid = require('../models/Bid');
const Team = require('../models/Team');
const CompetitionRound = require('../models/CompetitionRound');
const AuditLog = require('../models/AuditLog');
const { assertTransition } = require('../services/stateMachineService');

function getIo(req) {
  return req.app.get('io');
}
function room(eventId) {
  return `event:${eventId}`;
}

async function log(req, action, metadata = {}) {
  await AuditLog.create({ userId: req.auth.userId, eventId: req.event._id, action, metadata });
}

// Advance to the next question and enter QUESTION_INFO (Section 12/13).
exports.nextRound = asyncHandler(async (req, res) => {
  const event = req.event;
  assertTransition(event.competitionState, 'QUESTION_INFO');

  const nextIndex = event.currentRoundIndex + 1;
  if (nextIndex >= event.resolvedQuestionOrder.length) {
    event.competitionState = 'COMPLETED';
    event.status = 'COMPLETED';
    await event.save();
    getIo(req).to(room(event._id)).emit('event:completed', { eventId: event._id });
    await log(req, 'Event Completed', {});
    return res.json({ success: true, completed: true, event });
  }

  const eqId = event.resolvedQuestionOrder[nextIndex];
  const eq = await EventQuestion.findById(eqId).populate({ path: 'questionId', select: '-correctAnswer' });
  if (!eq) throw new ApiError(500, 'Question data is missing for this round.');

  eq.status = 'ACTIVE';
  await eq.save();

  event.currentRoundIndex = nextIndex;
  event.competitionState = 'QUESTION_INFO';
  event.currentWinningTeamId = undefined;
  event.currentWinningBidId = undefined;
  await event.save();

  await CompetitionRound.create({ eventId: event._id, eventQuestionId: eq._id, roundIndex: nextIndex });

  const q = eq.questionId;
  const multiplier =
    eq.rewardMultiplierOverride ?? event.difficultyMultipliers[q.difficulty] ?? 1;

  const preview = {
    roundIndex: nextIndex,
    totalRounds: event.resolvedQuestionOrder.length,
    questionNumber: nextIndex + 1,
    category: q.category,
    topic: q.topic,
    difficulty: q.difficulty,
    potentialRewardMultiplier: multiplier,
    biddingDurationSec: event.biddingDurationSec,
    isChampionshipQuestion: eq.isChampionshipQuestion,
  };

  getIo(req).to(room(event._id)).emit('round:started', preview);
  await log(req, 'Question Revealed (Preview)', { eventQuestionId: eq._id });
  res.json({ success: true, event, preview });
});

// QUESTION_INFO -> BIDDING. Starts the server-authoritative bidding timer.
exports.startBidding = asyncHandler(async (req, res) => {
  const event = req.event;
  assertTransition(event.competitionState, 'BIDDING');

  const now = new Date();
  const endsAt = new Date(now.getTime() + event.biddingDurationSec * 1000);
  event.competitionState = 'BIDDING';
  event.biddingStartedAt = now;
  event.biddingEndsAt = endsAt;
  await event.save();

  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    { biddingStartedAt: now, biddingEndsAt: endsAt }
  );

  getIo(req).to(room(event._id)).emit('bidding:started', {
    biddingStartedAt: now,
    biddingEndsAt: endsAt,
  });
  await log(req, 'Bidding Started', {});
  res.json({ success: true, event });
});

// BIDDING -> BID_CLOSED. Determines the highest valid bid (blind auction reveal).
exports.closeBidding = asyncHandler(async (req, res) => {
  const event = req.event;
  assertTransition(event.competitionState, 'BID_CLOSED');

  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  const bids = await Bid.find({ eventQuestionId: eqId }).populate('teamId', 'teamName').sort({ amount: -1, submittedAt: 1 });

  event.competitionState = 'BID_CLOSED';

  let winner = null;
  if (bids.length > 0) {
    winner = bids[0];
    winner.isWinning = true;
    await winner.save();
    event.currentWinningTeamId = winner.teamId._id;
    event.currentWinningBidId = winner._id;

    await Team.updateOne({ _id: winner.teamId._id }, { $inc: { 'stats.winningBids': 1 } });
  }
  await event.save();

  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    winner
      ? { winningTeamId: winner.teamId._id, winningBidAmount: winner.amount }
      : { result: 'NO_BIDS' }
  );

  const revealedBids = bids.map((b) => ({
    teamId: b.teamId._id,
    teamName: b.teamId.teamName,
    amount: b.amount,
    submittedAt: b.submittedAt,
  }));

  getIo(req).to(room(event._id)).emit('bidding:closed', {
    bids: revealedBids,
    winner: winner ? { teamId: winner.teamId._id, teamName: winner.teamId.teamName, amount: winner.amount } : null,
  });
  await log(req, 'Bidding Closed', { winningTeamId: winner?.teamId?._id, amount: winner?.amount });
  res.json({ success: true, event, bids: revealedBids });
});

// BID_CLOSED -> QUESTION_ACTIVE. Reveals full question text/options to everyone;
// only the winning team's frontend should enable answer controls.
exports.revealQuestion = asyncHandler(async (req, res) => {
  const event = req.event;
  assertTransition(event.competitionState, 'QUESTION_ACTIVE');

  if (!event.currentWinningBidId) {
    throw new ApiError(409, 'No team won this round\'s bidding - use "Skip (no bids)" instead of "Reveal question".');
  }

  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  const eq = await EventQuestion.findById(eqId).populate({ path: 'questionId', select: '-correctAnswer' });

  const now = new Date();
  const duration = eq.answerDurationOverrideSec ?? event.answerDurationSec;
  const endsAt = new Date(now.getTime() + duration * 1000);

  event.competitionState = 'QUESTION_ACTIVE';
  event.answerStartedAt = now;
  event.answerEndsAt = endsAt;
  await event.save();

  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    { answerStartedAt: now, answerEndsAt: endsAt }
  );

  const q = eq.questionId;
  getIo(req).to(room(event._id)).emit('question:revealed', {
    questionText: q.questionText,
    options: q.options,
    questionType: q.questionType,
    answerStartedAt: now,
    answerEndsAt: endsAt,
    winningTeamId: event.currentWinningTeamId,
  });
  await log(req, 'Question Text Revealed', {});
  res.json({ success: true, event });
});

module.exports.getIo = getIo;
module.exports.room = room;

// Manual control (Section 45): pause / resume / cancel round / reopen round.
exports.pauseCompetition = asyncHandler(async (req, res) => {
  const event = req.event;
  const { canPause } = require('../services/stateMachineService');
  if (!canPause(event.competitionState)) throw new ApiError(409, 'Cannot pause from the current state.');
  event.status = 'PAUSED';
  await event.save();
  getIo(req).to(room(event._id)).emit('event:paused', {});
  await log(req, 'Event Paused', {});
  res.json({ success: true, event });
});

exports.resumeCompetition = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.status !== 'PAUSED') throw new ApiError(409, 'Event is not paused.');
  event.status = 'LIVE';
  await event.save();
  getIo(req).to(room(event._id)).emit('event:resumed', {});
  await log(req, 'Event Resumed', {});
  res.json({ success: true, event });
});
