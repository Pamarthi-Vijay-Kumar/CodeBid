const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Event = require('../models/Event');
const EventQuestion = require('../models/EventQuestion');
const Question = require('../models/Question');
const Bid = require('../models/Bid');
const Team = require('../models/Team');
const CompetitionRound = require('../models/CompetitionRound');
const AuditLog = require('../models/AuditLog');
const { assertTransition, canPause } = require('../services/stateMachineService');
const { getIo: getIoInstance } = require('../sockets/ioRegistry');
const scheduler = require('../services/schedulerService');

function getIo() {
  return getIoInstance();
}
function room(eventId) {
  return `event:${eventId}`;
}

async function log(userId, eventId, action, metadata = {}) {
  await AuditLog.create({ userId, eventId, action, metadata });
}

// ---------------------------------------------------------------------
// Core actions, independent of any HTTP request - reused by both the
// manual HTTP handlers below (organizer clicks a button) and the
// scheduler (automatic progression when a timer expires).
// ---------------------------------------------------------------------

// BIDDING -> BID_CLOSED. Determines the highest valid bid (blind auction reveal).
async function performCloseBidding(event, actorUserId) {
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

  getIo().to(room(event._id)).emit('bidding:closed', {
    bids: revealedBids,
    winner: winner ? { teamId: winner.teamId._id, teamName: winner.teamId.teamName, amount: winner.amount } : null,
  });

  const meta = {};
  if (winner) { meta.winningTeamId = winner.teamId._id; meta.amount = winner.amount; }
  await log(actorUserId, event._id, 'Bidding Closed', meta);

  return { event, bids: revealedBids, winner };
}

// BID_CLOSED -> QUESTION_ACTIVE. Reveals full question text/options to
// everyone; only the winning team's frontend enables answer controls.
// Also schedules the automatic timeout for the answer window, so if the
// winning team never answers, the round still resolves on its own.
async function performRevealQuestion(event, actorUserId) {
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
  getIo().to(room(event._id)).emit('question:revealed', {
    questionText: q.questionText,
    options: q.options,
    questionType: q.questionType,
    answerStartedAt: now,
    answerEndsAt: endsAt,
    winningTeamId: event.currentWinningTeamId,
  });
  await log(actorUserId, event._id, 'Question Text Revealed', {});

  scheduleAutoResolveTimeout(event._id, duration * 1000);

  return event;
}

// Mirrors answerController's skipNoBidsRound, kept as a local copy rather
// than requiring answerController here - answerController already requires
// this file, so requiring it back at module-load time would deadlock.
async function performSkipNoBids(event, actorUserId) {
  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  await EventQuestion.updateOne({ _id: eqId }, { status: 'COMPLETED' });
  await CompetitionRound.updateOne(
    { eventId: event._id, eventQuestionId: eqId },
    { result: 'NO_BIDS', completedAt: new Date() }
  );
  event.competitionState = 'RESULT';
  await event.save();

  getIo().to(room(event._id)).emit('answer:result', { result: 'NO_BIDS' });
  await log(actorUserId, event._id, 'Round Auto-Skipped (No Bids)', {});
}

// ---------------------------------------------------------------------
// Scheduler entry points
// ---------------------------------------------------------------------

function scheduleAutoCloseAndReveal(eventId, delayMs) {
  scheduler.schedule(eventId, delayMs, () => autoCloseAndReveal(eventId));
}

function scheduleAutoResolveTimeout(eventId, delayMs) {
  scheduler.schedule(eventId, delayMs, () => autoResolveTimeout(eventId));
}

// Fires automatically when the bidding timer expires. Closes bidding, then
// either reveals the question to the winner or auto-skips a round nobody
// bid on. Re-checks state after every DB round-trip so a manual click that
// raced with the timer never causes a double-action.
async function autoCloseAndReveal(eventId) {
  let event = await Event.findById(eventId);
  if (!event || event.status !== 'LIVE' || event.competitionState !== 'BIDDING') return;

  const result = await performCloseBidding(event, event.organizerId);
  event = result.event;

  // Give everyone a moment to see the revealed bids before the question appears.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  event = await Event.findById(eventId);
  if (!event || event.status !== 'LIVE' || event.competitionState !== 'BID_CLOSED') return;

  if (!event.currentWinningBidId) {
    await performSkipNoBids(event, event.organizerId);
    return;
  }

  await performRevealQuestion(event, event.organizerId);
}

// Fires automatically when the answer timer expires with no submission.
async function autoResolveTimeout(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.status !== 'LIVE' || event.competitionState !== 'QUESTION_ACTIVE') return;

  // Lazy require: answerController requires this file at load time, so
  // requiring it back here at the top of the module would deadlock. By the
  // time this function actually runs, both modules are fully loaded.
  const { resolveTimeoutInternal } = require('./answerController');
  await resolveTimeoutInternal(event);
}

// ---------------------------------------------------------------------
// HTTP handlers (organizer control panel)
// ---------------------------------------------------------------------

// Advance to the next question and enter QUESTION_INFO (Section 12/13).
exports.nextRound = asyncHandler(async (req, res) => {
  const event = req.event;
  scheduler.cancel(event._id);
  assertTransition(event.competitionState, 'QUESTION_INFO');

  const nextIndex = event.currentRoundIndex + 1;
  if (nextIndex >= event.resolvedQuestionOrder.length) {
    event.competitionState = 'COMPLETED';
    event.status = 'COMPLETED';
    await event.save();
    getIo().to(room(event._id)).emit('event:completed', { eventId: event._id });
    await log(req.auth.userId, event._id, 'Event Completed', {});
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

  getIo().to(room(event._id)).emit('round:started', preview);
  await log(req.auth.userId, event._id, 'Question Revealed (Preview)', { eventQuestionId: eq._id });
  res.json({ success: true, event, preview });
});

// QUESTION_INFO -> BIDDING. Starts the server-authoritative bidding timer
// and schedules it to auto-close (and auto-reveal the question to the
// winner) the instant the timer runs out - the organizer doesn't have to
// click anything for the round to keep moving.
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

  getIo().to(room(event._id)).emit('bidding:started', {
    biddingStartedAt: now,
    biddingEndsAt: endsAt,
  });
  await log(req.auth.userId, event._id, 'Bidding Started', {});

  scheduleAutoCloseAndReveal(event._id, event.biddingDurationSec * 1000);

  res.json({ success: true, event });
});

// Manual "Close bidding" button - same effect as the automatic version,
// just triggered early by the organizer. Cancels the pending auto-timer.
exports.closeBidding = asyncHandler(async (req, res) => {
  scheduler.cancel(req.event._id);
  const result = await performCloseBidding(req.event, req.auth.userId);
  res.json({ success: true, event: result.event, bids: result.bids });
});

// Manual "Reveal question" button.
exports.revealQuestion = asyncHandler(async (req, res) => {
  scheduler.cancel(req.event._id);
  const event = await performRevealQuestion(req.event, req.auth.userId);
  res.json({ success: true, event });
});

module.exports.getIo = getIo;
module.exports.room = room;
module.exports.scheduleAutoCloseAndReveal = scheduleAutoCloseAndReveal;
module.exports.scheduleAutoResolveTimeout = scheduleAutoResolveTimeout;

// Manual control (Section 45): pause / resume.
exports.pauseCompetition = asyncHandler(async (req, res) => {
  const event = req.event;
  if (!canPause(event.competitionState)) throw new ApiError(409, 'Cannot pause from the current state.');
  scheduler.cancel(event._id);
  event.status = 'PAUSED';
  await event.save();
  getIo().to(room(event._id)).emit('event:paused', {});
  await log(req.auth.userId, event._id, 'Event Paused', {});
  res.json({ success: true, event });
});

// Resuming does not auto-restart a bidding/answer timer (pausing already
// cancelled it) - the organizer manually clicks the next control button
// when ready to continue, same as if they were one step behind.
exports.resumeCompetition = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.status !== 'PAUSED') throw new ApiError(409, 'Event is not paused.');
  event.status = 'LIVE';
  await event.save();
  getIo().to(room(event._id)).emit('event:resumed', {});
  await log(req.auth.userId, event._id, 'Event Resumed', {});
  res.json({ success: true, event });
});
