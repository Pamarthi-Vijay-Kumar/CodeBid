const mongoose = require('mongoose');

// Join table: a question added to a specific event, with event-specific ordering
// and per-event overrides (reward multiplier, answer time).
const eventQuestionSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    order: { type: Number, required: true },
    rewardMultiplierOverride: { type: Number, default: null },
    answerDurationOverrideSec: { type: Number, default: null },
    isChampionshipQuestion: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

eventQuestionSchema.index({ eventId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('EventQuestion', eventQuestionSchema);
