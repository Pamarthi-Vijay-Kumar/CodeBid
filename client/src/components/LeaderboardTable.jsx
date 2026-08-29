export default function LeaderboardTable({ rows = [], highlightTeamId = null }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-mist-500">
            <th className="label px-4 py-3">Rank</th>
            <th className="label px-4 py-3">Team</th>
            <th className="label px-4 py-3 text-right">Balance</th>
            <th className="label px-4 py-3 text-right hidden sm:table-cell">Bids</th>
            <th className="label px-4 py-3 text-right hidden sm:table-cell">Won</th>
            <th className="label px-4 py-3 text-right hidden md:table-cell">Correct</th>
            <th className="label px-4 py-3 text-right hidden md:table-cell">Wrong</th>
            <th className="label px-4 py-3 text-right hidden lg:table-cell">Success</th>
            <th className="label px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const successRate = r.stats.bidsPlaced ? ((r.stats.correctAnswers / r.stats.bidsPlaced) * 100).toFixed(1) : '0.0';
            const active = String(r.teamId) === String(highlightTeamId);
            return (
              <tr
                key={r.teamId}
                className={`border-b border-white/5 last:border-0 transition-colors ${active ? 'bg-gold-500/5' : 'hover:bg-white/[0.02]'}`}
              >
                <td className="px-4 py-3 font-mono">
                  {r.rank ? (
                    <span className={r.rank === 1 ? 'text-gold-400 font-bold' : 'text-mist-300'}>#{r.rank}</span>
                  ) : (
                    <span className="text-mist-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-display font-medium">{r.teamName}</td>
                <td className="px-4 py-3 text-right mono-num text-teal-300">₹{r.balance.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right mono-num hidden sm:table-cell text-mist-300">{r.stats.bidsPlaced}</td>
                <td className="px-4 py-3 text-right mono-num hidden sm:table-cell text-mist-300">{r.stats.winningBids}</td>
                <td className="px-4 py-3 text-right mono-num hidden md:table-cell text-teal-400">{r.stats.correctAnswers}</td>
                <td className="px-4 py-3 text-right mono-num hidden md:table-cell text-coral-400">{r.stats.wrongAnswers}</td>
                <td className="px-4 py-3 text-right mono-num hidden lg:table-cell text-mist-300">{successRate}%</td>
                <td className="px-4 py-3">
                  {r.eligible ? (
                    <span className="badge-completed">Eligible</span>
                  ) : (
                    <span className="badge-scheduled" title={r.reasons?.join(', ')}>Not eligible</span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-mist-500">No teams yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
