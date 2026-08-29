const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    eventQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventQuestion', default: null },
    type: {
      type: String,
      enum: [
        'INITIAL_BALANCE', 'BID', 'CORRECT_REWARD', 'WRONG_PENALTY',
        'TIMEOUT_PENALTY', 'BONUS', 'ADJUSTMENT', 'REFUND',
      ],
      required: true,
    },
    amount: { type: Number, required: true }, // signed: + credit, - debit
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ eventId: 1, teamId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
