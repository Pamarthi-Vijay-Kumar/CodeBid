import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then(({ data }) => setEvents(data.events)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <span className="label">Organizer</span>
          <h1 className="font-display font-bold text-3xl mt-1">Your events</h1>
        </div>
        <Link to="/organizer/new" className="btn-gold">+ Create event</Link>
      </div>

      {loading && <p className="text-mist-500">Loading…</p>}

      {!loading && events.length === 0 && (
        <div className="panel p-14 text-center text-mist-500">
          You haven&rsquo;t created an event yet. <Link to="/organizer/new" className="text-gold-400 hover:underline">Create your first one</Link>.
        </div>
      )}

      <div className="space-y-3">
        {events.map((e) => (
          <Link key={e._id} to={`/organizer/events/${e._id}`}
            className="panel p-5 flex items-center justify-between hover:border-gold-500/30 border border-transparent transition-colors">
            <div>
              <p className="font-display font-semibold">{e.name}</p>
              <p className="text-xs text-mist-500 font-mono mt-1">
                {e.status} · round {Math.max(0, e.currentRoundIndex + 1)} · {e.resolvedQuestionOrder?.length || 0} questions
              </p>
            </div>
            <StatusBadge status={e.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
