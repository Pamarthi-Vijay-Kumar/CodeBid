// Section 20/21/22 — the reward/penalty engine. Pure functions, unit-testable,
// and the formula is read from the event config rather than hardcoded, so an
// organizer can tune it per event.

function computeReward(bidAmount, difficulty, event) {
  const multiplier =
    (event.difficultyMultipliers && event.difficultyMultipliers[difficulty]) || 1;
  // Reward = Bid + (Bid * DifficultyBonus multiplier expressed as a fraction
  // over 1x, e.g. 1.75x means +75% bonus on top of the returned bid).
  const bonus = bidAmount * (multiplier - 1); // Section 20: "Difficulty Bonus" portion
  const reward = Math.round(bidAmount + bonus); // Reward = Bid + (Bid x Difficulty Bonus) = Bid x multiplier
  return { multiplier, reward };
}

function computeWrongPenalty(bidAmount, event) {
  const lossPercent = typeof event.wrongAnswerLossPercent === 'number' ? event.wrongAnswerLossPercent : 75;
  const loss = Math.round(bidAmount * (lossPercent / 100));
  return { lossPercent, loss };
}

// Returns { result, delta, meta } where delta is the signed balance change
// (excluding the bid itself, which was already deducted at bid time).
function resolveOutcome({ isCorrect, isTimeout, bidAmount, difficulty, event }) {
  if (isTimeout) {
    if (event.timeoutTreatedAsWrong) {
      const { loss, lossPercent } = computeWrongPenalty(bidAmount, event);
      return { result: 'TIMEOUT', delta: 0, penalty: loss, reward: 0, lossPercent };
    }
    return { result: 'TIMEOUT', delta: bidAmount, penalty: 0, reward: bidAmount, lossPercent: 0 }; // full refund
  }
  if (isCorrect) {
    const { reward, multiplier } = computeReward(bidAmount, difficulty, event);
    return { result: 'CORRECT', delta: reward, penalty: 0, reward, multiplier };
  }
  const { loss, lossPercent } = computeWrongPenalty(bidAmount, event);
  return { result: 'WRONG', delta: 0, penalty: loss, reward: 0, lossPercent };
}

module.exports = { computeReward, computeWrongPenalty, resolveOutcome };
