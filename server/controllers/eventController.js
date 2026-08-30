const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Event = require('../models/Event');
const Team = require('../models/Team');
const EventQuestion = require('../models/EventQuestion');
const AuditLog = require('../models/AuditLog');

async function logAction(req, eventId, action, metadata = {}) {
  await AuditLog.create({ userId: req.auth.userId, eventId, action, metadata });
}

exports.createEvent = asyncHandler(async (req, res) => {
  const payload = req.body;
  const event = await Event.create({ ...payload, organizerId: req.auth.userId, status: 'DRAFT' });
  await logAction(req, event._id, 'Event Created', { name: event.name });
  res.status(201).json({ success: true, event });
});

exports.listMyEvents = asyncHandler(async (req, res) => {
  const filter = req.auth.role === 'SUPER_ADMIN' ? {} : { organizerId: req.auth.userId };
  const events = await Event.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, events });
});

// Public: for the landing page / event list. Only safe, non-sensitive fields.
exports.listPublicEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: { $in: ['SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED'] } })
    .select('name description venue eventDate maxTeams status')
    .sort({ eventDate: 1 });

  const withCounts = await Promise.all(
    events.map(async (e) => {
      const teamCount = await Team.countDocuments({ eventId: e._id });
      const questionCount = await EventQuestion.countDocuments({ eventId: e._id });
      return { ...e.toObject(), teamCount, questionCount };
    })
  );
  res.json({ success: true, events: withCounts });
});

exports.getEvent = asyncHandler(async (req, res) => {
  res.json({ success: true, event: req.event });
});

exports.updateEvent = asyncHandler(async (req, res) => {
  if (req.event.isLocked) {
    throw new ApiError(409, 'This event is locked. Pause the event to make changes.');
  }
  Object.assign(req.event, req.body);
  await req.event.save();
  await logAction(req, req.event._id, 'Event Updated', { fields: Object.keys(req.body) });
  res.json({ success: true, event: req.event });
});

// Section 6 - pre-launch readiness checklist.
exports.getLaunchChecklist = asyncHandler(async (req, res) => {
  const event = req.event;
  const teamCount = await Team.countDocuments({ eventId: event._id });
  const questionCount = await EventQuestion.countDocuments({ eventId: event._id });

  const checklist = [
    { key: 'details', label: 'Event details configured', ok: Boolean(event.name && event.startingBalance) },
    { key: 'teams', label: 'Teams added', ok: teamCount >= 2, detail: `${teamCount} team(s) added` },
    { key: 'questions', label: 'Questions added', ok: questionCount >= 1, detail: `${questionCount} question(s) added` },
    { key: 'balance', label: 'Starting balance configured', ok: event.startingBalance > 0 },
    { key: 'bidding', label: 'Bidding settings configured', ok: event.minimumBid > 0 && event.bidIncrement > 0 },
    { key: 'answerTimer', label: 'Answer timer configured', ok: event.answerDurationSec > 0 },
    { key: 'rules', label: 'Eligibility rules configured', ok: event.minimumBidsRequired >= 0 },
  ];

  const ready = checklist.every((c) => c.ok);
  res.json({ success: true, ready, checklist });
});

exports.launchEvent = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.status === 'LIVE') throw new ApiError(409, 'Event is already live.');

  const teamCount = await Team.countDocuments({ eventId: event._id });
  const questions = await EventQuestion.find({ eventId: event._id }).sort({ order: 1 });
  if (teamCount < 2) throw new ApiError(400, 'At least 2 teams are required to launch.');
  if (questions.length < 1) throw new ApiError(400, 'At least 1 question is required to launch.');

  let order = questions.map((q) => q._id);
  if (event.questionOrderMode === 'RANDOM') {
    order = [...order].sort(() => Math.random() - 0.5);
  }

  event.resolvedQuestionOrder = order;
  event.status = 'LIVE';
  event.competitionState = 'LIVE';
  event.isLocked = true;
  event.currentRoundIndex = -1;
  await event.save();

  await logAction(req, event._id, 'Event Started', {});
  res.json({ success: true, event });
});

exports.pauseEvent = asyncHandler(async (req, res) => {
  const event = req.event;
  const { canPause } = require('../services/stateMachineService');
  if (!canPause(event.competitionState)) throw new ApiError(409, 'Event cannot be paused right now.');
  event.status = 'PAUSED';
  await event.save();
  await logAction(req, event._id, 'Event Paused', {});
  res.json({ success: true, event });
});

exports.resumeEvent = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.status !== 'PAUSED') throw new ApiError(409, 'Event is not paused.');
  event.status = 'LIVE';
  await event.save();
  await logAction(req, event._id, 'Event Resumed', {});
  res.json({ success: true, event });
});

exports.endEvent = asyncHandler(async (req, res) => {
  const event = req.event;
  event.status = 'COMPLETED';
  event.competitionState = 'COMPLETED';
  await event.save();
  await logAction(req, event._id, 'Event Completed', {});
  res.json({ success: true, event });
});
