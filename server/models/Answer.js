const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    eventQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventQuestion', required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', required: true },
    submittedAnswer: { type: String, default: null }, // null => timeout
    isCorrect: { type: Boolean, default: null },
    result: { type: String, enum: ['CORRECT', 'WRONG', 'TIMEOUT'], required: true },
    submittedAt: { type: Date },
    rewardAmount: { type: Number, default: 0 },
    penaltyAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

answerSchema.index({ eventQuestionId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('Answer', answerSchema);
