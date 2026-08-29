import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('team'); // 'team' | 'organizer' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [teamForm, setTeamForm] = useState({ eventId: '', identifier: '', password: '' });
  const [orgForm, setOrgForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', role: 'ORGANIZER' });

  async function submitTeam(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/team-login', teamForm);
      login(data.token, data.team, 'TEAM');
      navigate(`/compete/${data.team.eventId}`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function submitOrg(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', orgForm);
      login(data.token, data.user, 'USER');
      navigate(data.user.role === 'SUPER_ADMIN' ? '/admin' : '/organizer');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function submitRegister(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', regForm);
      login(data.token, data.user, 'USER');
      navigate('/organizer');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display font-bold text-2xl mb-1">Sign in</h1>
      <p className="text-sm text-mist-400 mb-8">Teams, organizers, and admins all sign in here.</p>

      <div className="flex gap-1.5 mb-7 p-1 bg-ink-800 rounded-xl border border-white/5 w-fit">
        {[
          ['team', 'Team'],
          ['organizer', 'Organizer / Admin'],
          ['register', 'New organizer'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setMode(key); setError(''); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-medium transition-colors ${
              mode === key ? 'bg-gold-500 text-ink-950' : 'text-mist-400 hover:text-mist-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-400">
          {error}
        </div>
      )}

      {mode === 'team' && (
        <form onSubmit={submitTeam} className="space-y-4 panel p-6">
          <div>
            <label className="label block mb-1.5">Event ID</label>
            <input required className="input" placeholder="Paste the event ID your organizer shared"
              value={teamForm.eventId} onChange={(e) => setTeamForm({ ...teamForm, eventId: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Team name or captain email</label>
            <input required className="input" value={teamForm.identifier}
              onChange={(e) => setTeamForm({ ...teamForm, identifier: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Password</label>
            <input required type="password" className="input" value={teamForm.password}
              onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })} />
          </div>
          <button disabled={loading} className="btn-gold w-full">{loading ? 'Signing in…' : 'Enter the competition'}</button>
        </form>
      )}

      {mode === 'organizer' && (
        <form onSubmit={submitOrg} className="space-y-4 panel p-6">
          <div>
            <label className="label block mb-1.5">Email</label>
            <input required type="email" className="input" value={orgForm.email}
              onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Password</label>
            <input required type="password" className="input" value={orgForm.password}
              onChange={(e) => setOrgForm({ ...orgForm, password: e.target.value })} />
          </div>
          <button disabled={loading} className="btn-teal w-full">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={submitRegister} className="space-y-4 panel p-6">
          <div>
            <label className="label block mb-1.5">Full name</label>
            <input required className="input" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Email</label>
            <input required type="email" className="input" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Password</label>
            <input required type="password" minLength={8} className="input" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} />
          </div>
          <button disabled={loading} className="btn-teal w-full">{loading ? 'Creating account…' : 'Create organizer account'}</button>
        </form>
      )}
    </div>
  );
}
