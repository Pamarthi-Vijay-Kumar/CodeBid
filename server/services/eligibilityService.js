// Section 25/27 — leaderboard eligibility + tie-break ranking.
function isEligible(team, event) {
  const s = team.stats;
  return (
    s.bidsPlaced >= event.minimumBidsRequired &&
    s.winningBids >= event.minimumWinningBidsRequired &&
    (s.correctAnswers + s.wrongAnswers + s.timeouts) >= event.minimumAnsweredRequired
  );
}

function eligibilityReason(team, event) {
  const s = team.stats;
  const reasons = [];
  if (s.bidsPlaced < event.minimumBidsRequired) reasons.push(`Minimum ${event.minimumBidsRequired} bids required`);
  if (s.winningBids < event.minimumWinningBidsRequired) reasons.push(`Minimum ${event.minimumWinningBidsRequired} winning bid(s) required`);
  const answered = s.correctAnswers + s.wrongAnswers + s.timeouts;
  if (answered < event.minimumAnsweredRequired) reasons.push(`Minimum ${event.minimumAnsweredRequired} question(s) answered required`);
  return reasons;
}

// Tie-breakers per Section 27, applied in order.
function compareTeams(a, b) {
  if (b.currentBalance !== a.currentBalance) return b.currentBalance - a.currentBalance;
  if (b.stats.correctAnswers !== a.stats.correctAnswers) return b.stats.correctAnswers - a.stats.correctAnswers;
  if (b.stats.winningBids !== a.stats.winningBids) return b.stats.winningBids - a.stats.winningBids;
  const successA = a.stats.bidsPlaced ? a.stats.correctAnswers / a.stats.bidsPlaced : 0;
  const successB = b.stats.bidsPlaced ? b.stats.correctAnswers / b.stats.bidsPlaced : 0;
  if (successB !== successA) return successB - successA;
  if (a.stats.totalLosses !== b.stats.totalLosses) return a.stats.totalLosses - b.stats.totalLosses;
  return 0;
}

function buildLeaderboard(teams, event) {
  const withEligibility = teams.map((t) => ({
    team: t,
    eligible: isEligible(t, event),
    reasons: isEligible(t, event) ? [] : eligibilityReason(t, event),
  }));

  const eligible = withEligibility.filter((x) => x.eligible).sort((a, b) => compareTeams(a.team, b.team));
  const notEligible = withEligibility.filter((x) => !x.eligible).sort((a, b) => compareTeams(a.team, b.team));

  return [
    ...eligible.map((x, i) => ({ rank: i + 1, ...x })),
    ...notEligible.map((x) => ({ rank: null, ...x })),
  ];
}

module.exports = { isEligible, eligibilityReason, compareTeams, buildLeaderboard };
