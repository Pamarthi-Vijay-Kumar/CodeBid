const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');
const User = require('../models/User');
const Team = require('../models/Team');
const Event = require('../models/Event');

// Registers Super Admins / Organizers / Spectator accounts.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.');

  const allowedSelfRegisterRoles = ['ORGANIZER', 'SPECTATOR'];
  const finalRole = allowedSelfRegisterRoles.includes(role) ? role : 'SPECTATOR';

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({ name, email, password, role: finalRole });
  const token = signToken({ id: user._id, type: 'USER', role: user.role });
  res.status(201).json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({ id: user._id, type: 'USER', role: user.role });
  res.json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// A Team logs in with eventId + team name (or captain email) + password.
exports.teamLogin = asyncHandler(async (req, res) => {
  const { eventId, identifier, password } = req.body;
  if (!eventId || !identifier || !password) {
    throw new ApiError(400, 'Event, team identifier and password are required.');
  }

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, 'Event not found.');

  const team = await Team.findOne({
    eventId,
    $or: [{ teamName: identifier }, { captainEmail: identifier.toLowerCase() }],
  }).select('+password');

  if (!team || !(await team.comparePassword(password))) {
    throw new ApiError(401, 'Invalid team credentials.');
  }
  if (team.status === 'DISQUALIFIED') throw new ApiError(403, 'This team has been disqualified from the event.');

  const token = signToken({ id: team._id, type: 'TEAM' });
  res.json({
    success: true,
    token,
    team: {
      id: team._id,
      teamName: team.teamName,
      eventId: team.eventId,
      currentBalance: team.currentBalance,
    },
  });
});

exports.me = asyncHandler(async (req, res) => {
  if (req.auth.type === 'TEAM') {
    return res.json({ success: true, type: 'TEAM', team: req.auth.team });
  }
  res.json({ success: true, type: 'USER', user: req.auth.user });
});
