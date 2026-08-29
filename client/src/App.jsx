import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import EventList from './pages/EventList';
import EventDetails from './pages/EventDetails';
import CompetitionScreen from './pages/CompetitionScreen';
import SpectatorScreen from './pages/SpectatorScreen';
import ResultsPage from './pages/ResultsPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateEvent from './pages/CreateEvent';
import EventManage from './pages/EventManage';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <div className="min-h-screen bg-grid-surface">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/events" element={<EventList />} />
        <Route path="/events/:eventId" element={<EventDetails />} />
        <Route path="/events/:eventId/live" element={<SpectatorScreen />} />
        <Route path="/events/:eventId/results" element={<ResultsPage />} />

        <Route
          path="/compete/:eventId"
          element={
            <ProtectedRoute allow={(s) => s.type === 'TEAM'}>
              <CompetitionScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer"
          element={
            <ProtectedRoute allow={(s) => s.type === 'USER' && ['ORGANIZER', 'SUPER_ADMIN'].includes(s.role)}>
              <OrganizerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/new"
          element={
            <ProtectedRoute allow={(s) => s.type === 'USER' && ['ORGANIZER', 'SUPER_ADMIN'].includes(s.role)}>
              <CreateEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/events/:eventId"
          element={
            <ProtectedRoute allow={(s) => s.type === 'USER' && ['ORGANIZER', 'SUPER_ADMIN'].includes(s.role)}>
              <EventManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allow={(s) => s.type === 'USER' && s.role === 'SUPER_ADMIN'}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
