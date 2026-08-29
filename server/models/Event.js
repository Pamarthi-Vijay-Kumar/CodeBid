const mongoose = require('mongoose');

const DIFFICULTY_MULTIPLIER_DEFAULTS = {
  EASY: 1.25,
  MEDIUM: 1.5,
  HARD: 1.75,
  EXPERT: 2.0,
};

const eventSchema = new mongoose.Schema(
  {
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    venue: { type: String, default: '' },
    eventDate: { type: Date },
    startTime: { type: Date },
    endTime: { type: Date },

    maxTeams: { type: Number, default: 20 },

    // --- Bidding / balance rules ---
    startingBalance: { type: Number, default: 10000 },
    minimumBid: { type: Number, default: 500 },
    bidIncrement: { type: Number, default: 100 },
    biddingDurationSec: { type: Number, default: 30 },
    answerDurationSec: { type: Number, default: 20 },

    // --- Reward / penalty formula (kept configurable, not hardcoded) ---
    rewardFormula: {
      type: String,
      enum: ['BID_PLUS_DIFFICULTY_BONUS'],
      default: 'BID_PLUS_DIFFICULTY_BONUS',
    },
    wrongAnswerLossPercent: { type: Number, default: 75 }, // % of bid lost
    timeoutTreatedAsWrong: { type: Boolean, default: true },

    difficultyMultipliers: {
      EASY: { type: Number, default: DIFFICULTY_MULTIPLIER_DEFAULTS.EASY },
      MEDIUM: { type: Number, default: DIFFICULTY_MULTIPLIER_DEFAULTS.MEDIUM },
      HARD: { type: Number, default: DIFFICULTY_MULTIPLIER_DEFAULTS.HARD },
      EXPERT: { type: Number, default: DIFFICULTY_MULTIPLIER_DEFAULTS.EXPERT },
    },

    // --- Eligibility rules ---
    minimumBidsRequired: { type: Number, default: 3 },
    minimumWinningBidsRequired: { type: Number, default: 1 },
    minimumAnsweredRequired: { type: Number, default: 1 },

    // --- Question ordering ---
    questionOrderMode: { type: String, enum: ['FIXED', 'RANDOM'], default: 'FIXED' },
    resolvedQuestionOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EventQuestion' }],

    championshipRoundEnabled: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },

    // --- Competition state machine (server is source of truth) ---
    competitionState: {
      type: String,
      enum: [
        'DRAFT', 'READY', 'LIVE', 'QUESTION_INFO', 'BIDDING', 'BID_CLOSED',
        'QUESTION_ACTIVE', 'ANSWER_SUBMITTED', 'RESULT', 'LEADERBOARD',
        'NEXT_ROUND', 'COMPLETED',
      ],
      default: 'DRAFT',
    },
    currentRoundIndex: { type: Number, default: -1 },

    // Server-side timers - never trust the client's clock
    biddingStartedAt: { type: Date },
    biddingEndsAt: { type: Date },
    answerStartedAt: { type: Date },
    answerEndsAt: { type: Date },

    currentWinningTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    currentWinningBidId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid' },

    isLocked: { type: Boolean, default: false }, // questions/rules locked once launched
  },
  { timestamps: true }
);

eventSchema.index({ organizerId: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
module.exports.DIFFICULTY_MULTIPLIER_DEFAULTS = DIFFICULTY_MULTIPLIER_DEFAULTS;
