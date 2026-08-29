const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const { buildLeaderboard } = require('../services/eligibilityService');

exports.addTeam = asyncHandler(async (req, res) => {
  const event = req.event;
  if (event.isLocked) throw new ApiError(409, 'Event is locked. Pause it to add teams.');

  const { teamName, members, captainName, captainEmail, password, customBalance } = req.body;
  if (!teamName || !captainName || !captainEmail || !password) {
    throw new ApiError(400, 'teamName, captainName, captainEmail and password are required.');
  }

  const teamCount = await Team.countDocuments({ eventId: event._id });
  if (teamCount >= event.maxTeams) throw new ApiError(400, 'Maximum number of teams reached for this event.');

  const startingBalance = typeof customBalance === 'number' ? customBalance : event.startingBalance;

  const team = await Team.create({
    eventId: event._id,
    teamName,
    members: members || [],
    captainName,
    captainEmail,
    password,
    startingBalance,
    currentBalance: startingBalance,
  });

  await Transaction.create({
    eventId: event._id,
    teamId: team._id,
    type: 'INITIAL_BALANCE',
    amount: startingBalance,
    balanceAfter: startingBalance,
    note: 'Starting balance',
  });

  await AuditLog.create({ userId: req.auth.userId, eventId: event._id, action: 'Team Added', metadata: { teamName } });

  const safeTeam = team.toObject();
  delete safeTeam.password;
  res.status(201).json({ success: true, team: safeTeam });
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
  const leaderboard = buildLeaderboard(teams, req.event);
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
