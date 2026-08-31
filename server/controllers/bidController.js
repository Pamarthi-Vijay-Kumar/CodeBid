const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Bid = require('../models/Bid');
const Team = require('../models/Team');
const { getIo, room } = require('./competitionController');

// Section 42 - concurrency-safe bid submission. Teams only, blind bidding:
// the current highest bid / other teams' amounts are NEVER echoed back.
exports.submitBid = asyncHandler(async (req, res) => {
  const event = req.event;
  const team = req.auth.team;
  const { amount } = req.body;

  if (event.competitionState !== 'BIDDING') {
    throw new ApiError(409, 'Bidding is not currently open.');
  }
  if (event.status === 'PAUSED') throw new ApiError(409, 'This event is currently paused.');
  if (event.biddingEndsAt && new Date() > event.biddingEndsAt) {
    throw new ApiError(409, 'Bidding has already closed.');
  }
  if (team.status !== 'ACTIVE') throw new ApiError(403, 'This team is not eligible to bid.');

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new ApiError(400, 'A valid bid amount is required.');
  }
  if (amount < event.minimumBid) {
    throw new ApiError(400, `Bid must be at least the minimum bid of ${event.minimumBid}.`);
  }
  if ((amount - event.minimumBid) % event.bidIncrement !== 0) {
    throw new ApiError(400, `Bid must follow the increment of ${event.bidIncrement}.`);
  }
  // Re-fetch the team's live balance server-side - never trust the client.
  const freshTeam = await Team.findById(team._id);
  if (amount > freshTeam.currentBalance) {
    throw new ApiError(400, 'You do not have enough balance for this bid.');
  }

  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];

  let bid;
  try {
    bid = await Bid.create({
      eventId: event._id,
      eventQuestionId: eqId,
      teamId: team._id,
      amount,
      submittedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already submitted a bid for this question.');
    throw err;
  }

  await Team.updateOne({ _id: team._id }, { $inc: { 'stats.bidsPlaced': 1 } });
  await Team.updateOne(
    { _id: team._id, 'stats.highestBid': { $lt: amount } },
    { $set: { 'stats.highestBid': amount } }
  );

  // Blind bidding: broadcast only that a bid was placed and how many teams
  // have bid so far - never the amount or the bidder.
  const bidCount = await Bid.countDocuments({ eventQuestionId: eqId });
  getIo().to(room(event._id)).emit('bid:submitted', { bidCount });

  res.status(201).json({ success: true, bidId: bid._id, submittedAt: bid.submittedAt });
});

exports.myBidStatus = asyncHandler(async (req, res) => {
  const event = req.event;
  const eqId = event.resolvedQuestionOrder[event.currentRoundIndex];
  const bid = await Bid.findOne({ eventQuestionId: eqId, teamId: req.auth.team._id });
  res.json({ success: true, hasBid: Boolean(bid), amount: bid?.amount ?? null });
});
