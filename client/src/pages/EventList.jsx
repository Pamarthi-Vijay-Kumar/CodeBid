import { useEffect, useState } from 'react';
import api from '../services/api';
import EventCard from '../components/EventCard';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/events/public')
      .then(({ data }) => setEvents(data.events))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 md:px-8 py-14">
      <div className="mb-10">
        <span className="label">Explore</span>
        <h1 className="font-display font-bold text-3xl mt-2">Upcoming &amp; live events</h1>
      </div>

      {loading && <p className="text-mist-500">Loading events…</p>}
      {error && <p className="text-coral-400">{error}</p>}

      {!loading && events.length === 0 && (
        <div className="panel p-14 text-center text-mist-500">
          No events published yet. Check back soon.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((e) => <EventCard key={e._id} event={e} />)}
      </div>
    </div>
  );
}
