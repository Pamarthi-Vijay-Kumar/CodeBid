import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function ResultsPage() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${eventId}/results`).then(({ data }) => setData(data)).catch((err) => setError(err.message));
  }, [eventId]);

  if (error) return <div className="mx-auto max-w-4xl px-5 py-16 text-coral-400">{error}</div>;
  if (!data) return <div className="mx-auto max-w-4xl px-5 py-16 text-mist-500">Loading results…</div>;

  const podium = [data.winner, data.runnerUp, data.third].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl px-5 md:px-8 py-14">
      <span className="label">Final results</span>
      <h1 className="font-display font-bold text-3xl mt-1 mb-10">{data.event.name}</h1>

      {podium.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {podium.map((t, i) => (
            <div key={t.teamId} className={`panel p-6 text-center ${i === 0 ? 'border-gold-500/40 shadow-glow' : ''}`}>
              <p className="text-3xl mb-2">{['🏆', '🥈', '🥉'][i]}</p>
              <p className="font-display font-semibold text-lg">{t.teamName}</p>
              <p className="mono-num text-teal-300 mt-1">₹{t.finalBalance.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          ['Total questions', data.stats.totalQuestions],
          ['Total bids', data.stats.totalBids],
          ['Total money bid', `₹${data.stats.totalMoneyBid.toLocaleString('en-IN')}`],
          ['Highest bid', `₹${data.stats.highestBid.toLocaleString('en-IN')}`],
          ['Most correct answers', data.stats.mostCorrectAnswers],
          ['Highest success rate', `${data.stats.highestSuccessRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="panel p-5">
            <p className="label mb-1">{k}</p>
            <p className="font-mono text-xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-mist-500">
              <th className="label px-4 py-3">Rank</th>
              <th className="label px-4 py-3">Team</th>
              <th className="label px-4 py-3 text-right">Final balance</th>
              <th className="label px-4 py-3 text-right">P/L</th>
              <th className="label px-4 py-3 text-right hidden sm:table-cell">Success rate</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.teamId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-mono">{t.rank ?? '—'}</td>
                <td className="px-4 py-3 font-display">{t.teamName}</td>
                <td className="px-4 py-3 text-right mono-num text-teal-300">₹{t.finalBalance.toLocaleString('en-IN')}</td>
                <td className={`px-4 py-3 text-right mono-num ${t.profitLoss >= 0 ? 'text-teal-300' : 'text-coral-400'}`}>
                  {t.profitLoss >= 0 ? '+' : ''}₹{t.profitLoss.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right mono-num hidden sm:table-cell">{t.successRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
