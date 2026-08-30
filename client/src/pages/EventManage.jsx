import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const TABS = ['overview', 'teams', 'questions', 'control', 'results'];

export default function EventManage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState('overview');

  const loadEvent = useCallback(() => {
    api.get(`/events/${eventId}`).then(({ data }) => setEvent(data.event));
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  if (!event) return <div className="mx-auto max-w-6xl px-5 py-16 text-mist-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <span className="label">Managing</span>
          <h1 className="font-display font-bold text-3xl mt-1">{event.name}</h1>
        </div>
        <StatusBadge status={event.status} />
      </div>

      <div className="flex gap-1.5 mb-8 p-1 bg-ink-800 rounded-xl border border-white/5 w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-display font-medium capitalize whitespace-nowrap transition-colors ${
              tab === t ? 'bg-gold-500 text-ink-950' : 'text-mist-400 hover:text-mist-100'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab event={event} eventId={eventId} onChange={loadEvent} />}
      {tab === 'teams' && <TeamsTab eventId={eventId} locked={event.isLocked} />}
      {tab === 'questions' && <QuestionsTab eventId={eventId} locked={event.isLocked} />}
      {tab === 'control' && <ControlTab event={event} eventId={eventId} onChange={loadEvent} />}
      {tab === 'results' && <ResultsTab eventId={eventId} />}
    </div>
  );
}

function OverviewTab({ event, eventId, onChange }) {
  const [checklist, setChecklist] = useState(null);
  const [error, setError] = useState('');
  const [teamCount, setTeamCount] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const registrationLink = `${window.location.origin}/events/${eventId}/register`;

  useEffect(() => {
    api.get(`/events/${eventId}/checklist`).then(({ data }) => setChecklist(data));
  }, [eventId, event.status]);

  useEffect(() => {
    api.get(`/events/${eventId}/teams`).then(({ data }) => setTeamCount(data.teams.length));
  }, [eventId, event.status, event.isLocked]);

  async function launch() {
    setError('');
    try { await api.post(`/events/${eventId}/launch`); onChange(); } catch (err) { setError(err.message); }
  }
  async function pause() { await api.post(`/events/${eventId}/pause`); onChange(); }
  async function resume() { await api.post(`/events/${eventId}/resume`); onChange(); }
  async function end() { await api.post(`/events/${eventId}/end`); onChange(); }

  async function toggleSelfRegistration() {
    setToggling(true);
    try {
      await api.patch(`/events/${eventId}`, { selfRegistrationEnabled: !(event.selfRegistrationEnabled !== false) });
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="panel p-6">
        <h2 className="label mb-4">Launch checklist</h2>
        {checklist ? (
          <ul className="space-y-2.5 mb-6">
            {checklist.checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-3 text-sm">
                <span className={c.ok ? 'text-teal-400' : 'text-mist-500'}>{c.ok ? '✓' : '○'}</span>
                <span className={c.ok ? '' : 'text-mist-400'}>{c.label}</span>
                {c.detail && <span className="text-mist-500 text-xs ml-auto font-mono">{c.detail}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-mist-500 text-sm">Checking…</p>}

        {error && <p className="text-coral-400 text-xs mb-3">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {event.status === 'DRAFT' && (
            <button onClick={launch} disabled={!checklist?.ready} className="btn-gold">Launch event</button>
          )}
          {event.status === 'LIVE' && <button onClick={pause} className="btn-ghost">Pause event</button>}
          {event.status === 'PAUSED' && <button onClick={resume} className="btn-teal">Resume event</button>}
          {['LIVE', 'PAUSED'].includes(event.status) && <button onClick={end} className="btn-danger">End event</button>}
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="label mb-4">Team registration</h2>
        <p className="text-sm text-mist-400 mb-2">
          Share this link so teams can register themselves before the event:
        </p>
        <div className="flex gap-2 mb-1">
          <code className="flex-1 block bg-ink-900 border border-white/10 rounded-xl px-4 py-3 text-teal-300 text-sm break-all">
            {registrationLink}
          </code>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(registrationLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="btn-ghost !px-4 text-xs shrink-0"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-mist-500 text-xs mb-5">
          {teamCount != null ? `${teamCount} / ${event.maxTeams} teams registered` : 'Loading team count…'}
          {event.isLocked && ' · registration is closed (event launched)'}
        </p>

        <label className="flex items-center gap-2.5 text-sm mb-5">
          <input
            type="checkbox"
            className="accent-gold-500 w-4 h-4"
            checked={event.selfRegistrationEnabled !== false}
            disabled={event.isLocked || toggling}
            onChange={toggleSelfRegistration}
          />
          Allow teams to self-register via the link above
        </label>

        <p className="text-sm text-mist-400 mb-3">Event ID (for the team login screen):</p>
        <code className="block bg-ink-900 border border-white/10 rounded-xl px-4 py-3 text-teal-300 text-sm break-all">{eventId}</code>
        <p className="text-sm text-mist-400 mt-5 mb-3">Spectator / big-screen link:</p>
        <code className="block bg-ink-900 border border-white/10 rounded-xl px-4 py-3 text-teal-300 text-sm break-all">
          {window.location.origin}/events/{eventId}/live
        </code>
      </div>
    </div>
  );
}

function TeamsTab({ eventId, locked }) {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ teamName: '', captainName: '', captainEmail: '', password: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => api.get(`/events/${eventId}/teams`).then(({ data }) => setTeams(data.teams)), [eventId]);
  useEffect(() => { load(); }, [load]);

  async function addTeam(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/events/${eventId}/teams`, form);
      setForm({ teamName: '', captainName: '', captainEmail: '', password: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="grid md:grid-cols-[1fr,320px] gap-6">
      <div className="panel divide-y divide-white/5">
        {teams.map((t) => (
          <div key={t._id} className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-display font-medium">{t.teamName}</p>
              <p className="text-xs text-mist-500 font-mono">{t.captainName} · {t.status}</p>
            </div>
            <p className="mono-num text-teal-300">₹{t.currentBalance.toLocaleString('en-IN')}</p>
          </div>
        ))}
        {teams.length === 0 && <p className="px-5 py-10 text-center text-mist-500 text-sm">No teams added yet.</p>}
      </div>

      <div className="panel p-5">
        <h2 className="label mb-4">Add a team</h2>
        {locked && <p className="text-gold-400 text-xs mb-3">Event is locked — pause it to add more teams.</p>}
        <form onSubmit={addTeam} className="space-y-3">
          <input required disabled={locked} placeholder="Team name" className="input" value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} />
          <input required disabled={locked} placeholder="Captain name" className="input" value={form.captainName} onChange={(e) => setForm({ ...form, captainName: e.target.value })} />
          <input required disabled={locked} type="email" placeholder="Captain email" className="input" value={form.captainEmail} onChange={(e) => setForm({ ...form, captainEmail: e.target.value })} />
          <input required disabled={locked} type="password" placeholder="Team password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-coral-400 text-xs">{error}</p>}
          <button disabled={locked} className="btn-gold w-full">Add team</button>
        </form>
      </div>
    </div>
  );
}

function QuestionsTab({ eventId, locked }) {
  const [bank, setBank] = useState([]);
  const [eventQuestions, setEventQuestions] = useState([]);
  const [form, setForm] = useState({ category: '', topic: '', difficulty: 'MEDIUM', questionType: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '' });
  const [error, setError] = useState('');

  const loadBank = useCallback(() => api.get('/question-bank').then(({ data }) => setBank(data.questions)), []);
  const loadEventQuestions = useCallback(() => api.get(`/events/${eventId}/questions`).then(({ data }) => setEventQuestions(data.questions)), [eventId]);
  useEffect(() => { loadBank(); loadEventQuestions(); }, [loadBank, loadEventQuestions]);

  async function createQuestion(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/question-bank', { ...form, options: form.options.filter(Boolean) });
      setForm({ category: '', topic: '', difficulty: 'MEDIUM', questionType: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '' });
      loadBank();
    } catch (err) { setError(err.message); }
  }

  async function addToEvent(questionId) {
    try { await api.post(`/events/${eventId}/questions`, { questionId }); loadEventQuestions(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <h2 className="label mb-4">Event question order ({eventQuestions.length})</h2>
        <div className="space-y-2">
          {eventQuestions.map((eq, i) => (
            <div key={eq._id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/5">
              <span className="text-sm">
                <span className="text-mist-500 font-mono mr-2">#{i + 1}</span>
                {eq.questionId?.topic} <span className="text-mist-500">· {eq.questionId?.difficulty}</span>
              </span>
              <span className="text-xs font-mono text-mist-500">{eq.status}</span>
            </div>
          ))}
          {eventQuestions.length === 0 && <p className="text-mist-500 text-sm">No questions added to this event yet.</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr,380px] gap-6">
        <div className="panel divide-y divide-white/5">
          <div className="px-5 py-3"><h2 className="label">Question bank</h2></div>
          {bank.map((q) => (
            <div key={q._id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm">{q.questionText}</p>
                <p className="text-xs text-mist-500 font-mono mt-1">{q.category} · {q.topic} · {q.difficulty}</p>
              </div>
              <button disabled={locked} onClick={() => addToEvent(q._id)} className="btn-ghost !py-1.5 !px-3 text-xs shrink-0">Add to event</button>
            </div>
          ))}
          {bank.length === 0 && <p className="px-5 py-10 text-center text-mist-500 text-sm">Your question bank is empty — add one on the right.</p>}
        </div>

        <div className="panel p-5">
          <h2 className="label mb-4">New question</h2>
          <form onSubmit={createQuestion} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input required placeholder="Topic" className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {['EASY', 'MEDIUM', 'HARD', 'EXPERT'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="input" value={form.questionType} onChange={(e) => setForm({ ...form, questionType: e.target.value })}>
                {['MCQ', 'TRUE_FALSE', 'CODE_OUTPUT', 'DEBUGGING', 'SQL', 'FILL_BLANK'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea required placeholder="Question text" className="input min-h-[70px]" value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} />
            {form.options.map((opt, i) => (
              <input key={i} placeholder={`Option ${i + 1}`} className="input" value={opt}
                onChange={(e) => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }} />
            ))}
            <input required placeholder="Correct answer (must match an option exactly)" className="input" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
            {error && <p className="text-coral-400 text-xs">{error}</p>}
            <button className="btn-gold w-full">Save to question bank</button>
          </form>
        </div>
      </div>
    </div>
  );
}

const ACTIONS = [
  { key: 'next-round', label: 'Start / Next question' },
  { key: 'start-bidding', label: 'Start bidding' },
  { key: 'close-bidding', label: 'Close bidding' },
  { key: 'reveal-question', label: 'Reveal question' },
  { key: 'force-timeout', label: 'Force timeout' },
  { key: 'skip-no-bids', label: 'Skip (no bids)' },
  { key: 'show-leaderboard', label: 'Show leaderboard' },
];

function ControlTab({ event, eventId, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const noWinnerThisRound = event.competitionState === 'BID_CLOSED' && !event.currentWinningTeamId;

  async function fire(key) {
    setError(''); setBusy(key);
    try {
      await api.post(`/events/${eventId}/competition/${key}`);
      onChange();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  return (
    <div className="grid md:grid-cols-[1fr,320px] gap-6">
      <div className="panel p-6">
        <h2 className="label mb-1">Competition state</h2>
        <p className="font-mono text-2xl text-gold-400 mb-6">{event.competitionState}</p>
        <p className="text-sm text-mist-400 mb-6">
          Round {Math.max(0, event.currentRoundIndex + 1)} of {event.resolvedQuestionOrder?.length || '—'}
        </p>
        {noWinnerThisRound && (
          <p className="text-gold-400 text-xs mb-4 bg-gold-500/10 border border-gold-500/30 rounded-lg px-3 py-2">
            No team bid on this question — use <span className="font-semibold">Skip (no bids)</span> instead of Reveal question.
          </p>
        )}
        {error && <p className="text-coral-400 text-sm mb-4">{error}</p>}
        <div className="grid grid-cols-2 gap-2.5">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => fire(a.key)}
              disabled={busy === a.key || event.status === 'PAUSED' || (a.key === 'reveal-question' && noWinnerThisRound)}
              className={`btn-ghost text-xs !py-3 ${a.key === 'skip-no-bids' && noWinnerThisRound ? '!border-gold-500/50 !text-gold-400' : ''}`}
            >
              {busy === a.key ? '…' : a.label}
            </button>
          ))}
        </div>
        <p className="text-mist-500 text-xs mt-5">
          The server enforces the state machine — invalid transitions are rejected automatically, so it&rsquo;s safe to click through this in order.
        </p>
      </div>
      <div className="panel p-6">
        <h2 className="label mb-3">Suggested flow</h2>
        <ol className="text-sm text-mist-400 space-y-2 list-decimal list-inside">
          <li>Start / Next question</li>
          <li>Start bidding</li>
          <li>Close bidding (after the timer)</li>
          <li>Reveal question</li>
          <li>Wait for the answer, or Force timeout</li>
          <li>Show leaderboard</li>
          <li>Repeat</li>
        </ol>
      </div>
    </div>
  );
}

function ResultsTab({ eventId }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/events/${eventId}/results`).then(({ data }) => setData(data)); }, [eventId]);
  if (!data) return <p className="text-mist-500 text-sm">Loading…</p>;
  return (
    <div className="panel divide-y divide-white/5">
      {data.teams.map((t) => (
        <div key={t.teamId} className="px-5 py-4 flex items-center justify-between">
          <span className="font-mono text-mist-500 w-10">{t.rank ?? '—'}</span>
          <span className="flex-1 font-display">{t.teamName}</span>
          <span className="mono-num text-teal-300">₹{t.finalBalance.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}
