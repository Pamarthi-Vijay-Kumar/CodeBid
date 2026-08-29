const asyncHandler = require('../utils/asyncHandler');
const Team = require('../models/Team');
const Bid = require('../models/Bid');
const Answer = require('../models/Answer');
const AuditLog = require('../models/AuditLog');
const { buildLeaderboard } = require('../services/eligibilityService');

// Section 46/47 - full event results + per-team performance report (JSON;
// CSV/PDF/Excel export can be generated client-side from this same payload).
exports.eventResults = asyncHandler(async (req, res) => {
  const event = req.event;
  const teams = await Team.find({ eventId: event._id, status: { $ne: 'WITHDRAWN' } });
  const leaderboard = buildLeaderboard(teams, event);

  const bids = await Bid.find({ eventId: event._id });
  const answers = await Answer.find({ eventId: event._id });

  const totalMoneyBid = bids.reduce((sum, b) => sum + b.amount, 0);
  const highestBid = bids.reduce((max, b) => Math.max(max, b.amount), 0);

  const teamReports = leaderboard.map((row) => {
    const t = row.team;
    return {
      teamId: t._id,
      teamName: t.teamName,
      rank: row.rank,
      eligible: row.eligible,
      startingBalance: t.startingBalance,
      finalBalance: t.currentBalance,
      profitLoss: t.currentBalance - t.startingBalance,
      ...t.stats.toObject?.() ?? t.stats,
      successRate: t.stats.bidsPlaced
        ? Number(((t.stats.correctAnswers / t.stats.bidsPlaced) * 100).toFixed(2))
        : 0,
    };
  });

  res.json({
    success: true,
    event: { id: event._id, name: event.name, status: event.status },
    winner: teamReports.find((t) => t.rank === 1) || null,
    runnerUp: teamReports.find((t) => t.rank === 2) || null,
    third: teamReports.find((t) => t.rank === 3) || null,
    stats: {
      totalQuestions: event.resolvedQuestionOrder?.length || 0,
      totalBids: bids.length,
      totalMoneyBid,
      highestBid,
      mostCorrectAnswers: Math.max(0, ...teamReports.map((t) => t.correctAnswers || 0)),
      highestSuccessRate: Math.max(0, ...teamReports.map((t) => t.successRate || 0)),
    },
    teams: teamReports,
  });
});

exports.auditLog = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find({ eventId: req.event._id }).sort({ createdAt: -1 }).limit(300).populate('userId', 'name email');
  res.json({ success: true, logs });
});
