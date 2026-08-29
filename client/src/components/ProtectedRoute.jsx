import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allow }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-mist-500">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (allow && !allow(session)) return <Navigate to="/" replace />;
  return children;
}
