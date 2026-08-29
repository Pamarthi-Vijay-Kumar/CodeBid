const asyncHandler = require('../utils/asyncHandler');
const Event = require('../models/Event');
const Team = require('../models/Team');
const Question = require('../models/Question');
const User = require('../models/User');

// Super Admin platform-wide stats (Section 30).
exports.platformStats = asyncHandler(async (req, res) => {
  const [totalEvents, activeEvents, completedEvents, totalTeams, totalQuestions, liveEvents] = await Promise.all([
    Event.countDocuments({}),
    Event.countDocuments({ status: { $in: ['LIVE', 'PAUSED'] } }),
    Event.countDocuments({ status: 'COMPLETED' }),
    Team.countDocuments({}),
    Question.countDocuments({}),
    Event.countDocuments({ status: 'LIVE' }),
  ]);
  res.json({
    success: true,
    stats: { totalEvents, activeEvents, completedEvents, totalTeams, totalQuestions, liveEvents },
  });
});

exports.listOrganizers = asyncHandler(async (req, res) => {
  const organizers = await User.find({ role: 'ORGANIZER' }).sort({ createdAt: -1 });
  res.json({ success: true, organizers });
});

exports.setUserActive = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
  res.json({ success: true, user });
});

exports.listAllEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({}).populate('organizerId', 'name email').sort({ createdAt: -1 });
  res.json({ success: true, events });
});
