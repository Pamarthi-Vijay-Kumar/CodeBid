const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teamSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    teamName: { type: String, required: true, trim: true },
    members: [{ type: String, trim: true }],
    captainName: { type: String, required: true },
    captainEmail: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },

    startingBalance: { type: Number, required: true },
    currentBalance: { type: Number, required: true },

    status: { type: String, enum: ['ACTIVE', 'DISQUALIFIED', 'WITHDRAWN'], default: 'ACTIVE' },

    // Denormalized running stats for fast leaderboard reads
    stats: {
      bidsPlaced: { type: Number, default: 0 },
      winningBids: { type: Number, default: 0 },
      correctAnswers: { type: Number, default: 0 },
      wrongAnswers: { type: Number, default: 0 },
      timeouts: { type: Number, default: 0 },
      totalRewards: { type: Number, default: 0 },
      totalLosses: { type: Number, default: 0 },
      highestBid: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

teamSchema.index({ eventId: 1, teamName: 1 }, { unique: true });
teamSchema.index({ eventId: 1, captainEmail: 1 }, { unique: true });

teamSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

teamSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Team', teamSchema);
