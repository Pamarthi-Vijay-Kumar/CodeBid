const asyncHandler = require('../utils/asyncHandler');
const Transaction = require('../models/Transaction');

exports.myTransactions = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { eventId: req.event._id, teamId: req.auth.team._id };
  if (type && type !== 'All') filter.type = type;
  const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, transactions });
});

exports.teamTransactions = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const transactions = await Transaction.find({ eventId: req.event._id, teamId }).sort({ createdAt: -1 });
  res.json({ success: true, transactions });
});

exports.eventTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ eventId: req.event._id })
    .populate('teamId', 'teamName')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ success: true, transactions });
});
