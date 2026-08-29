import { Link } from 'react-router-dom';

const TICKER_ITEMS = [
  { team: 'Code Warriors', q: 'Q7 · Java Strings', bid: '₹2,500', result: 'WON' },
  { team: 'Bug Hunters', q: 'Q4 · SQL Joins', bid: '₹1,200', result: 'CORRECT' },
  { team: 'Java Masters', q: 'Q9 · DSA Trees', bid: '₹3,100', result: 'WON' },
  { team: 'Code Ninjas', q: 'Q2 · Python', bid: '₹900', result: 'WRONG' },
  { team: 'Stack Overflowers', q: 'Q11 · OOP', bid: '₹1,750', result: 'CORRECT' },
  { team: 'Kernel Panic', q: 'Q6 · Networks', bid: '₹2,000', result: 'WON' },
];

const FLOW = [
  { step: '01', title: 'Question topic drops', body: 'Only the category, topic and difficulty are shown — the real question stays hidden.' },
  { step: '02', title: 'Teams bid blind', body: 'Every team stakes part of its balance in secret. No one sees the competition\u2019s number.' },
  { step: '03', title: 'Highest bid wins', body: 'Bids reveal at once. The top bidder earns the exclusive right to answer.' },
  { step: '04', title: 'Answer under the clock', body: 'The question appears. The winner has one shot before the server-side timer runs out.' },
  { step: '05', title: 'Balance moves live', body: 'Correct multiplies the bid by the difficulty bonus. Wrong costs 75% of it. Instantly.' },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-500/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-7xl px-5 md:px-8 pt-20 pb-16 md:pt-28 md:pb-24 relative">
          <div className="flex items-center gap-2 mb-6">
            <span className="badge-live">LIVE AUCTION FORMAT</span>
            <span className="text-mist-500 text-xs font-mono">for technical competitions</span>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-[1.05] max-w-3xl">
            Don&rsquo;t just answer questions.
            <span className="block text-gold-500">Win the right to.</span>
          </h1>
          <p className="mt-6 max-w-xl text-mist-300 text-base md:text-lg">
            CodeBid turns a technical quiz into a real-time trading floor. Teams bid their balance
            blind on the right to answer each question — bigger risk, bigger reward, one shot on the clock.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/events" className="btn-gold text-sm">Browse live events</Link>
            <Link to="/login" className="btn-ghost text-sm">Organizer sign in</Link>
          </div>

          <div className="mt-14 flex items-center gap-8 text-mist-500 text-xs font-mono uppercase tracking-widest">
            <span>Blind bidding</span>
            <span className="w-1 h-1 rounded-full bg-mist-500" />
            <span>Server-timed rounds</span>
            <span className="w-1 h-1 rounded-full bg-mist-500" />
            <span>Live leaderboard</span>
            <span className="w-1 h-1 rounded-full bg-mist-500" />
            <span>Multi-event isolated</span>
          </div>
        </div>

        {/* Signature element: live bid ticker strip */}
        <div className="border-t border-white/5 bg-ink-950/60 py-3 overflow-hidden">
          <div className="ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 px-6 font-mono text-xs shrink-0">
                <span className="text-mist-300">{t.team}</span>
                <span className="text-mist-500">{t.q}</span>
                <span className="text-gold-400">{t.bid}</span>
                <span className={
                  t.result === 'WRONG' ? 'text-coral-400' : t.result === 'WON' ? 'text-gold-400' : 'text-teal-400'
                }>{t.result}</span>
                <span className="w-1 h-1 rounded-full bg-white/10 ml-3" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-5 md:px-8 py-20">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="label">The competition flow</span>
            <h2 className="font-display font-bold text-2xl md:text-3xl mt-2">Every round, five moves.</h2>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {FLOW.map((f) => (
            <div key={f.step} className="bg-ink-900 p-6 flex flex-col gap-3 min-h-[200px]">
              <span className="font-mono text-gold-500/80 text-sm">{f.step}</span>
              <h3 className="font-display font-semibold text-base leading-snug">{f.title}</h3>
              <p className="text-sm text-mist-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-5 md:px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { title: 'Organizers', body: 'Build a question bank, configure bidding and reward rules per event, then run the live control room.', to: '/organizer' },
            { title: 'Teams', body: 'Bid strategically, protect your balance, and climb the live leaderboard question by question.', to: '/login' },
            { title: 'Spectators', body: 'Follow the whole event on the big screen — current bid, current round, live standings.', to: '/events' },
          ].map((r) => (
            <Link key={r.title} to={r.to} className="panel p-7 hover:border-teal-400/30 border border-transparent transition-colors group">
              <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-teal-300 transition-colors">{r.title}</h3>
              <p className="text-sm text-mist-400 leading-relaxed">{r.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
