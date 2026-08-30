import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

// Public, unauthenticated page - the "registration link" organizers share
// with teams ahead of the event. Anyone with the link can register a team
// (as long as the organizer has self-registration turned on) right up until
// the event launches or fills up.
export default function TeamRegister() {
  const { eventId } = useParams();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [form, setForm] = useState({
    teamName: '', captainName: '', captainEmail: '', password: '', confirmPassword: '',
  });
  const [members, setMembers] = useState(['']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(null);

  const loadStatus = () => {
    api.get(`/events/${eventId}/registration-status`)
      .then(({ data }) => setStatus(data))
      .catch((err) => setStatusError(err.message));
  };

  useEffect(() => { loadStatus(); }, [eventId]); // eslint-disable-line

  function updateMember(i, value) {
    setMembers((m) => m.map((x, idx) => (idx === i ? value : x)));
  }
  function addMember() {
    if (members.length < 6) setMembers((m) => [...m, '']);
  }
  function removeMember(i) {
    setMembers((m) => m.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(`/events/${eventId}/teams/register`, {
        teamName: form.teamName,
        captainName: form.captainName,
        captainEmail: form.captainEmail,
        password: form.password,
        members: members.map((m) => m.trim()).filter(Boolean),
      });
      setRegistered(data.team);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (statusError) {
    return <div className="mx-auto max-w-md px-5 py-20 text-center text-coral-400">{statusError}</div>;
  }
  if (!status) {
    return <div className="mx-auto max-w-md px-5 py-20 text-center text-mist-500">Loading…</div>;
  }

  if (registered) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <div className="panel p-8 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <h1 className="font-display font-bold text-2xl mb-2">You&rsquo;re registered!</h1>
          <p className="text-mist-400 text-sm mb-6">
            <span className="text-mist-100 font-medium">{registered.teamName}</span> is in for{' '}
            <span className="text-mist-100 font-medium">{status.eventName}</span>.
          </p>
          <div className="text-left panel !bg-ink-900 p-4 mb-6 text-sm space-y-1.5">
            <p className="label mb-2">Save these for login on the event day</p>
            <p>Event ID: <code className="text-teal-300 break-all">{eventId}</code></p>
            <p>Team name / email: <code className="text-teal-300">{registered.teamName}</code></p>
            <p>Password: <span className="text-mist-500">whatever you just set</span></p>
          </div>
          <Link to="/login" className="btn-gold w-full">Go to team login</Link>
        </div>
      </div>
    );
  }

  if (!status.open) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="font-display font-bold text-2xl mb-2">Registration closed</h1>
        <p className="text-mist-400 text-sm mb-1">{status.eventName}</p>
        <p className="text-coral-400 text-sm mt-4">{status.reason}</p>
        <Link to="/events" className="btn-ghost mt-8 inline-flex">Browse other events</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <span className="label">Team registration</span>
      <h1 className="font-display font-bold text-3xl mt-1 mb-1">{status.eventName}</h1>
      {status.eventDate && (
        <p className="text-gold-400 text-sm font-mono mb-2">
          {new Date(status.eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}
      <p className="text-mist-400 text-sm mb-8">
        {status.slotsRemaining} of {status.maxTeams} slot(s) remaining.
      </p>

      {error && (
        <div className="mb-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-400">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="panel p-6 space-y-4">
        <div>
          <label className="label block mb-1.5">Team name</label>
          <input required className="input" value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Captain name</label>
          <input required className="input" value={form.captainName} onChange={(e) => setForm({ ...form, captainName: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Captain email</label>
          <input required type="email" className="input" value={form.captainEmail} onChange={(e) => setForm({ ...form, captainEmail: e.target.value })} />
        </div>

        <div>
          <label className="label block mb-1.5">Team members (optional)</label>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder={`Member ${i + 1}`} value={m} onChange={(e) => updateMember(i, e.target.value)} />
                {members.length > 1 && (
                  <button type="button" onClick={() => removeMember(i)} className="btn-ghost !px-3 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
          {members.length < 6 && (
            <button type="button" onClick={addMember} className="text-xs text-teal-300 hover:underline mt-2">+ Add another member</button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Password</label>
            <input required type="password" minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1.5">Confirm</label>
            <input required type="password" minLength={6} className="input" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </div>
        </div>

        <button disabled={loading} className="btn-gold w-full">{loading ? 'Registering…' : 'Register team'}</button>
      </form>
    </div>
  );
}
