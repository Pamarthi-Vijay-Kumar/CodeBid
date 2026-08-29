const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    eventQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventQuestion', required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    amount: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now }, // authoritative server timestamp
    isWinning: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One bid per team per question (blind bidding - no re-bids after submit).
bidSchema.index({ eventQuestionId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('Bid', bidSchema);
