const mongoose = require('mongoose');

// Reusable question bank entry - NOT tied to a single event.
const questionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, trim: true }, // e.g. Java, DSA, DBMS
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'], required: true },
    questionType: {
      type: String,
      enum: ['MCQ', 'TRUE_FALSE', 'CODE_OUTPUT', 'DEBUGGING', 'SQL', 'FILL_BLANK'],
      required: true,
    },
    questionText: { type: String, required: true },
    options: [{ type: String }], // for MCQ / TRUE_FALSE
    correctAnswer: { type: String, required: true, select: false }, // NEVER sent to frontend pre-answer
    explanation: { type: String, default: '' },
    defaultAnswerDurationSec: { type: Number, default: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

questionSchema.index({ ownerId: 1, category: 1, topic: 1 });

module.exports = mongoose.model('Question', questionSchema);
