import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function EventDetails() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${eventId}`)
      .then(({ data }) => setEvent(data.event))
      .catch((err) => setError(err.message));
  }, [eventId]);

  if (error) return <div className="mx-auto max-w-3xl px-5 py-16 text-coral-400">{error}</div>;
  if (!event) return <div className="mx-auto max-w-3xl px-5 py-16 text-mist-500">Loading…</div>;

  const rules = [
    ['Starting balance', `₹${event.startingBalance?.toLocaleString('en-IN')}`],
    ['Minimum bid', `₹${event.minimumBid?.toLocaleString('en-IN')}`],
    ['Bid increment', `₹${event.bidIncrement?.toLocaleString('en-IN')}`],
    ['Bidding time', `${event.biddingDurationSec}s`],
    ['Answer time', `${event.answerDurationSec}s`],
    ['Wrong-answer loss', `${event.wrongAnswerLossPercent}% of bid`],
    ['Min. bids to be eligible', event.minimumBidsRequired],
    ['Min. winning bids', event.minimumWinningBidsRequired],
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 md:px-8 py-14">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-display font-bold text-3xl">{event.name}</h1>
        <StatusBadge status={event.status} />
      </div>
      <p className="text-mist-400 mt-2 mb-8">{event.description}</p>

      <div className="panel p-6 mb-6">
        <h2 className="label mb-4">Bidding &amp; scoring rules</h2>
        <dl className="grid sm:grid-cols-2 gap-4">
          {rules.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-mist-500">{k}</dt>
              <dd className="font-mono text-mist-100">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to={`/events/${eventId}/live`} className="btn-gold">Watch live / spectate</Link>
        <Link to="/login" className="btn-ghost">Team sign in</Link>
        <Link to={`/events/${eventId}/results`} className="btn-ghost">Results</Link>
      </div>
    </div>
  );
}
