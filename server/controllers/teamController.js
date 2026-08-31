const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Event = require('../models/Event');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const { buildLiveLeaderboard } = require('../services/eligibilityService');

// Shared by both the organizer-managed "add team" flow and the public
// self-registration flow, so validation and bookkeeping never drift apart.
async function createTeamRecord(event, payload, { auditUserId, auditAction }) {
  const { teamName, members, captainName, captainEmail, password, customBalance } = payload;
  if (!teamName || !captainName || !captainEmail || !password) {
    throw new ApiError(400, 'teamName, captainName, captainEmail and password are required.');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters.');
  }

  const teamCount = await Team.countDocuments({ eventId: event._id });
  if (teamCount >= event.maxTeams) {
    throw new ApiError(400, `This event is full (${event.maxTeams} team limit reached).`);
  }

  const startingBalance = typeof customBalance === 'number' ? customBalance : event.startingBalance;

  let team;
  try {
    team = await Team.create({
      eventId: event._id,
      teamName,
      members: members || [],
      captainName,
      captainEmail,
      password,
      startingBalance,
      currentBalance: startingBalance,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'That team name or captain email is already registered for this event.');
    }
    throw err;
  }

  await Transaction.create({
    eventId: event._id,
    teamId: team._id,
    type: 'INITIAL_BALANCE',
    amount: startingBalance,
    balanceAfter: startingBalance,
    note: 'Starting balance',
  });

  await AuditLog.create({ userId: auditUserId, eventId: event._id, action: auditAction, metadata: { teamName } });

  const safeTeam = team.toObject();
  delete safeTeam.password;
  return safeTeam;
}

// Organizer adds a team directly.
exports.addTeam = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.isLocked) throw new ApiError(409, 'Event is locked. Pause it to add teams.');

  const team = await createTeamRecord(event, req.body, {
    auditUserId: req.auth.userId,
    auditAction: 'Team Added',
  });

  res.status(201).json({ success: true, team });
});

// Public: a team registers itself via the shareable registration link.
// No auth required - anyone with the link can sign their team up, right up
// until the organizer launches the event (which locks it) or the event
// reaches its team cap.
exports.selfRegisterTeam = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, 'Event not found.');

  if (event.isLocked) {
    throw new ApiError(409, 'Registration is closed - this event has already launched.');
  }
  if (!event.selfRegistrationEnabled) {
    throw new ApiError(403, 'This event is not accepting self-registration. Ask the organizer to add your team.');
  }

  const team = await createTeamRecord(event, req.body, {
    // No authenticated actor performed this - attribute it to the event's
    // organizer (AuditLog.userId is required) with a clearly distinct action name.
    auditUserId: event.organizerId,
    auditAction: 'Team Self-Registered',
  });

  res.status(201).json({
    success: true,
    team,
    message: 'Registration successful. Use the event ID, your team name (or captain email), and your password to log in on the event day.',
  });
});

// Public: lightweight status for the registration page - team count / cap /
// whether registration is currently open - without requiring a login.
exports.registrationStatus = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, 'Event not found.');

  const teamCount = await Team.countDocuments({ eventId: event._id });
  const open = !event.isLocked && event.selfRegistrationEnabled && teamCount < event.maxTeams;

  let reason = null;
  if (event.isLocked) reason = 'This event has already launched and is no longer accepting registrations.';
  else if (!event.selfRegistrationEnabled) reason = 'Self-registration is turned off for this event.';
  else if (teamCount >= event.maxTeams) reason = 'This event has reached its maximum number of teams.';

  res.json({
    success: true,
    eventName: event.name,
    eventDate: event.eventDate,
    status: event.status,
    teamCount,
    maxTeams: event.maxTeams,
    slotsRemaining: Math.max(0, event.maxTeams - teamCount),
    open,
    reason,
  });
});

exports.listTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ eventId: req.event._id }).sort({ teamName: 1 });
  res.json({ success: true, teams });
});

exports.getMyTeamProfile = asyncHandler(async (req, res) => {
  const team = req.auth.team;
  res.json({ success: true, team });
});

exports.disqualifyTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const team = await Team.findOne({ _id: teamId, eventId: req.event._id });
  if (!team) throw new ApiError(404, 'Team not found in this event.');
  team.status = 'DISQUALIFIED';
  await team.save();
  await AuditLog.create({
    userId: req.auth.userId, eventId: req.event._id, action: 'Team Disqualified', metadata: { teamId },
  });
  res.json({ success: true, team });
});

// Section 45 - manual bonus balance adjustment, always audited.
exports.adjustBalance = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { amount, note } = req.body;
  if (typeof amount !== 'number' || amount === 0) throw new ApiError(400, 'A non-zero amount is required.');

  const team = await Team.findOne({ _id: teamId, eventId: req.event._id });
  if (!team) throw new ApiError(404, 'Team not found in this event.');

  team.currentBalance += amount;
  await team.save();

  await Transaction.create({
    eventId: req.event._id,
    teamId: team._id,
    type: 'ADJUSTMENT',
    amount,
    balanceAfter: team.currentBalance,
    note: note || 'Manual admin adjustment',
  });

  await AuditLog.create({
    userId: req.auth.userId, eventId: req.event._id, action: 'Manual Balance Adjustment',
    metadata: { teamId, amount, note },
  });

  res.json({ success: true, team });
});

exports.eventLeaderboard = asyncHandler(async (req, res) => {
  const teams = await Team.find({ eventId: req.event._id, status: { $ne: 'WITHDRAWN' } });
  const leaderboard = buildLiveLeaderboard(teams, req.event);
  res.json({
    success: true,
    leaderboard: leaderboard.map((row) => ({
      rank: row.rank,
      teamId: row.team._id,
      teamName: row.team.teamName,
      balance: row.team.currentBalance,
      stats: row.team.stats,
      eligible: row.eligible,
      reasons: row.reasons,
    })),
  });
});
