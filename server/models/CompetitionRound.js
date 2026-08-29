const mongoose = require('mongoose');

const competitionRoundSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    eventQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventQuestion', required: true },
    roundIndex: { type: Number, required: true },
    biddingStartedAt: { type: Date },
    biddingEndsAt: { type: Date },
    answerStartedAt: { type: Date },
    answerEndsAt: { type: Date },
    winningTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    winningBidAmount: { type: Number },
    result: { type: String, enum: ['CORRECT', 'WRONG', 'TIMEOUT', 'NO_BIDS'], default: null },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

competitionRoundSchema.index({ eventId: 1, roundIndex: 1 }, { unique: true });

module.exports = mongoose.model('CompetitionRound', competitionRoundSchema);
