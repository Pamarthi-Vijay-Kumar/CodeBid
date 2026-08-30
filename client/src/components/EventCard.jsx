import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function EventCard({ event }) {
  return (
    <div className="panel p-6 flex flex-col gap-4 hover:border-gold-500/30 border border-transparent transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-lg leading-snug">{event.name}</h3>
        <StatusBadge status={event.status} />
      </div>
      {event.eventDate && (
        <p className="text-xs font-mono text-gold-400">
          {new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      )}
      <p className="text-sm text-mist-300 line-clamp-2">{event.description || 'No description provided.'}</p>
      <div className="flex items-center gap-4 text-xs font-mono text-mist-500">
        <span>{event.teamCount ?? 0} teams</span>
        <span>·</span>
        <span>{event.questionCount ?? 0} questions</span>
        {event.venue && <><span>·</span><span>{event.venue}</span></>}
      </div>
      <div className="flex gap-2 pt-1">
        <Link to={`/events/${event._id}`} className="btn-ghost flex-1 !py-2 text-xs">Details</Link>
        <Link to={`/events/${event._id}/register`} className="btn-gold flex-1 !py-2 text-xs">Register</Link>
      </div>
    </div>
  );
}
