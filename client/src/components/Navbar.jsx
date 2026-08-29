import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-900/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="w-2.5 h-2.5 rounded-full bg-gold-500 shadow-glow group-hover:animate-pulseRing" />
          <span className="font-display font-bold text-lg tracking-tight">
            Code<span className="text-gold-500">Bid</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-mist-300">
          <Link to="/events" className="hover:text-mist-100 transition-colors">Events</Link>
          {session?.type === 'USER' && (session.role === 'ORGANIZER' || session.role === 'SUPER_ADMIN') && (
            <Link to="/organizer" className="hover:text-mist-100 transition-colors">Organizer</Link>
          )}
          {session?.type === 'USER' && session.role === 'SUPER_ADMIN' && (
            <Link to="/admin" className="hover:text-mist-100 transition-colors">Platform</Link>
          )}
          {session?.type === 'TEAM' && (
            <Link to={`/compete/${session.eventId}`} className="hover:text-mist-100 transition-colors">My Competition</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden sm:inline text-sm text-mist-300 font-mono">
                {session.type === 'TEAM' ? session.teamName : session.name}
              </span>
              <button
                className="btn-ghost !py-1.5 !px-3.5 text-xs"
                onClick={() => { logout(); navigate('/'); }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-gold !py-1.5 !px-4 text-xs">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
