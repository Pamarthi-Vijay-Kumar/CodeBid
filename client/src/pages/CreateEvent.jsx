import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const DEFAULTS = {
  name: '', description: '', venue: '', eventDate: '', maxTeams: 60,
  startingBalance: 10000, minimumBid: 500, bidIncrement: 100,
  biddingDurationSec: 30, answerDurationSec: 20,
  wrongAnswerLossPercent: 75,
  minimumBidsRequired: 3, minimumWinningBidsRequired: 1, minimumAnsweredRequired: 1,
  questionOrderMode: 'FIXED', selfRegistrationEnabled: true,
};

const NUMERIC_FIELDS = new Set([
  'maxTeams', 'startingBalance', 'minimumBid', 'bidIncrement', 'biddingDurationSec',
  'answerDurationSec', 'wrongAnswerLossPercent', 'minimumBidsRequired',
  'minimumWinningBidsRequired', 'minimumAnsweredRequired',
]);

export default function CreateEvent() {
  const [form, setForm] = useState(DEFAULTS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: NUMERIC_FIELDS.has(key) ? Number(value) : value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const payload = { ...form, eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined };
      const { data } = await api.post('/events', payload);
      navigate(`/organizer/events/${data.event._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 md:px-8 py-12">
      <span className="label">New event</span>
      <h1 className="font-display font-bold text-3xl mt-1 mb-8">Create a CodeBid event</h1>

      {error && <div className="mb-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-400">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        <Section title="Event details">
          <Field label="Event name" required>
            <input required className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Venue"><input className="input" value={form.venue} onChange={(e) => update('venue', e.target.value)} /></Field>
            <Field label="Event date" required>
              <input required type="date" className="input" value={form.eventDate} onChange={(e) => update('eventDate', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max teams"><input type="number" min={2} className="input" value={form.maxTeams} onChange={(e) => update('maxTeams', e.target.value)} /></Field>
            <Field label="Team registration">
              <label className="flex items-center gap-2.5 h-[42px] text-sm">
                <input
                  type="checkbox"
                  className="accent-gold-500 w-4 h-4"
                  checked={form.selfRegistrationEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, selfRegistrationEnabled: e.target.checked }))}
                />
                Allow teams to self-register via a link
              </label>
            </Field>
          </div>
        </Section>

        <Section title="Balance & bidding">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starting balance (₹)"><input type="number" className="input" value={form.startingBalance} onChange={(e) => update('startingBalance', e.target.value)} /></Field>
            <Field label="Minimum bid (₹)"><input type="number" className="input" value={form.minimumBid} onChange={(e) => update('minimumBid', e.target.value)} /></Field>
            <Field label="Bid increment (₹)"><input type="number" className="input" value={form.bidIncrement} onChange={(e) => update('bidIncrement', e.target.value)} /></Field>
            <Field label="Bidding duration (sec)"><input type="number" className="input" value={form.biddingDurationSec} onChange={(e) => update('biddingDurationSec', e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Answering & scoring">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Answer duration (sec)"><input type="number" className="input" value={form.answerDurationSec} onChange={(e) => update('answerDurationSec', e.target.value)} /></Field>
            <Field label="Wrong-answer loss (%)"><input type="number" className="input" value={form.wrongAnswerLossPercent} onChange={(e) => update('wrongAnswerLossPercent', e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Eligibility rules">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Min. bids"><input type="number" className="input" value={form.minimumBidsRequired} onChange={(e) => update('minimumBidsRequired', e.target.value)} /></Field>
            <Field label="Min. winning bids"><input type="number" className="input" value={form.minimumWinningBidsRequired} onChange={(e) => update('minimumWinningBidsRequired', e.target.value)} /></Field>
            <Field label="Min. answered"><input type="number" className="input" value={form.minimumAnsweredRequired} onChange={(e) => update('minimumAnsweredRequired', e.target.value)} /></Field>
          </div>
          <Field label="Question order">
            <select className="input" value={form.questionOrderMode} onChange={(e) => update('questionOrderMode', e.target.value)}>
              <option value="FIXED">Fixed order</option>
              <option value="RANDOM">Random order</option>
            </select>
          </Field>
        </Section>

        <button disabled={loading} className="btn-gold w-full">{loading ? 'Creating…' : 'Create event (draft)'}</button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="panel p-6 space-y-4">
      <h2 className="label">{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, required, children }) {
  return (
    <div>
      <label className="label block mb-1.5">{label}{required && <span className="text-coral-400"> *</span>}</label>
      {children}
    </div>
  );
}
