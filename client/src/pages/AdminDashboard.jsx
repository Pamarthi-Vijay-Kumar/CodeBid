import { useEffect, useState } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [organizers, setOrganizers] = useState([]);

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data.stats));
    api.get('/admin/events').then(({ data }) => setEvents(data.events));
    api.get('/admin/organizers').then(({ data }) => setOrganizers(data.organizers));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8 py-12">
      <span className="label">Super admin</span>
      <h1 className="font-display font-bold text-3xl mt-1 mb-8">Platform overview</h1>

      {stats && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="panel p-5">
              <p className="text-[11px] uppercase tracking-wider text-mist-500 mb-1">{k.replace(/([A-Z])/g, ' $1')}</p>
              <p className="font-mono text-2xl text-gold-400">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="panel divide-y divide-white/5">
          <div className="px-5 py-3"><h2 className="label">All events</h2></div>
          {events.map((e) => (
            <div key={e._id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-display">{e.name}</p>
                <p className="text-xs text-mist-500 font-mono">{e.organizerId?.name}</p>
              </div>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </div>

        <div className="panel divide-y divide-white/5">
          <div className="px-5 py-3"><h2 className="label">Organizers</h2></div>
          {organizers.map((o) => (
            <div key={o._id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-display">{o.name}</p>
                <p className="text-xs text-mist-500 font-mono">{o.email}</p>
              </div>
              <span className={`badge ${o.isActive ? 'badge-completed' : 'badge-scheduled'}`}>{o.isActive ? 'Active' : 'Disabled'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
