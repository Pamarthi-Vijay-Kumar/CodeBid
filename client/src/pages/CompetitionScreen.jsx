import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import CountdownClock from '../components/CountdownClock';
import LeaderboardTable from '../components/LeaderboardTable';
import StatusBadge from '../components/StatusBadge';

const DIFFICULTY_COLOR = {
  EASY: 'text-teal-300', MEDIUM: 'text-gold-400', HARD: 'text-coral-400', EXPERT: 'text-coral-500',
};

export default function CompetitionScreen() {
  const { eventId } = useParams();
  const { session, refresh } = useAuth();

  const [event, setEvent] = useState(null);
  const [team, setTeam] = useState(session?.type === 'TEAM' ? session : null);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [phase, setPhase] = useState('LIVE');
  const [preview, setPreview] = useState(null);
  const [bidCount, setBidCount] = useState(0);
  const [myBid, setMyBid] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [revealedBids, setRevealedBids] = useState(null);
  const [winner, setWinner] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [transactions, setTransactions] = useState([]);
  const [txFilter, setTxFilter] = useState('All');

  const socketRef = useRef(null);

  const loadEvent = async () => {
    const { data } = await api.get(`/events/${eventId}`);
    setEvent(data.event);
    setPhase(data.event.competitionState);
  };
  const loadTeam = async () => {
    const { data } = await api.get(`/events/${eventId}/teams/me`);
    setTeam(data.team);
  };
  const loadLeaderboard = async () => {
    const { data } = await api.get(`/events/${eventId}/leaderboard`);
    setLeaderboard(data.leaderboard);
  };
  const loadTransactions = async (type) => {
    const { data } = await api.get(`/events/${eventId}/transactions/mine`, { params: { type } });
    setTransactions(data.transactions);
  };

  useEffect(() => {
    loadEvent();
    loadTeam();
    loadLeaderboard();
  }, [eventId]); // eslint-disable-line

  // Fallback polling so this screen never fully freezes even if live
  // updates are unhealthy (e.g. a dropped/failed socket connection).
  // Fast (5s) while disconnected so it recovers quickly once the socket
  // comes back; a slow (25s) background refresh runs even when connected,
  // as a safety net against any single missed broadcast.
  useEffect(() => {
    const t = setInterval(() => {
      if (socketStatus !== 'connected') { loadEvent(); loadTeam(); }
      loadLeaderboard();
    }, socketStatus === 'connected' ? 25000 : 5000);
    return () => clearInterval(t);
  }, [eventId, socketStatus]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'history') loadTransactions(txFilter);
  }, [activeTab, txFilter]); // eslint-disable-line

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    socket.auth = { token: localStorage.getItem('codebid_token') };

    // Re-join the event's room on every successful connection, not just the
    // first one. If the underlying transport ever drops and reconnects
    // (network blips, or a Render free-tier instance waking from sleep),
    // the previous "joined" state doesn't survive - without this, the
    // client stays "connected" but silently stops receiving broadcasts.
    const onConnect = () => {
      setSocketStatus('connected');
      socket.emit('event:join', { eventId });
    };
    const onDisconnect = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('error');
    const onSocketErrorEvent = (payload) => console.error('Socket error:', payload);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('error', onSocketErrorEvent);

    socket.connect();
    // Handles the case where the socket is already connected (e.g. a fast
    // remount) and 'connect' won't fire again on its own.
    if (socket.connected) onConnect();

    const onRoundStarted = (p) => {
      setPreview(p); setPhase('QUESTION_INFO'); setBidCount(0); setMyBid(null);
      setBidAmount(''); setBidError(''); setRevealedBids(null); setWinner(null);
      setQuestion(null); setSelectedAnswer(''); setAnswerSubmitted(false); setAnswerResult(null);
    };
    const onBiddingStarted = ({ biddingStartedAt, biddingEndsAt }) => {
      setPhase('BIDDING');
      setEvent((e) => e && ({ ...e, biddingStartedAt, biddingEndsAt }));
    };
    const onBidSubmitted = ({ bidCount }) => setBidCount(bidCount);
    const onBiddingClosed = ({ bids, winner }) => {
      setPhase('BID_CLOSED'); setRevealedBids(bids); setWinner(winner);
    };
    const onQuestionRevealed = (q) => {
      setPhase('QUESTION_ACTIVE'); setQuestion(q);
      setEvent((e) => e && ({ ...e, answerEndsAt: q.answerEndsAt }));
    };
    const onAnswerResult = (r) => { setPhase('RESULT'); setAnswerResult(r); loadTeam(); };
    const onBalanceUpdated = ({ teamId, newBalance }) => {
      setTeam((t) => (t && String(t._id ?? t.id) === String(teamId) ? { ...t, currentBalance: newBalance } : t));
    };
    const onLeaderboardUpdated = () => { setPhase('LEADERBOARD'); loadLeaderboard(); };
    const onPaused = () => setEvent((e) => e && ({ ...e, status: 'PAUSED' }));
    const onResumed = () => setEvent((e) => e && ({ ...e, status: 'LIVE' }));
    const onCompleted = () => setPhase('COMPLETED');

    socket.on('round:started', onRoundStarted);
    socket.on('bidding:started', onBiddingStarted);
    socket.on('bid:submitted', onBidSubmitted);
    socket.on('bidding:closed', onBiddingClosed);
    socket.on('question:revealed', onQuestionRevealed);
    socket.on('answer:result', onAnswerResult);
    socket.on('balance:updated', onBalanceUpdated);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('event:paused', onPaused);
    socket.on('event:resumed', onResumed);
    socket.on('event:completed', onCompleted);

    return () => {
      socket.emit('event:leave', { eventId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('error', onSocketErrorEvent);
      socket.off('round:started', onRoundStarted);
      socket.off('bidding:started', onBiddingStarted);
      socket.off('bid:submitted', onBidSubmitted);
      socket.off('bidding:closed', onBiddingClosed);
      socket.off('question:revealed', onQuestionRevealed);
      socket.off('answer:result', onAnswerResult);
      socket.off('balance:updated', onBalanceUpdated);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('event:paused', onPaused);
      socket.off('event:resumed', onResumed);
      socket.off('event:completed', onCompleted);
      socket.disconnect();
    };
  }, [eventId]);

  const isWinner = winner && team && String(winner.teamId) === String(team._id ?? team.id);
  const iAmAnswerer = question && team && event?.currentWinningTeamId &&
    String(event.currentWinningTeamId) === String(team._id ?? team.id);

  async function placeBid(e) {
    e.preventDefault();
    setBidError('');
    const amount = Number(bidAmount);
    try {
      await api.post(`/events/${eventId}/bids`, { amount });
      setMyBid(amount);
    } catch (err) {
      setBidError(err.message);
    }
  }

  async function submitAnswer(e) {
    e.preventDefault();
    if (!selectedAnswer) return;
    try {
      await api.post(`/events/${eventId}/answers`, { answer: selectedAnswer });
      setAnswerSubmitted(true);
    } catch (err) {
      setBidError(err.message);
    }
  }

  const balanceLow = team && event && team.currentBalance < event.minimumBid;

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8 py-8">
      {/* Top bar: identity + balance + status */}
      <div className="panel p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="label">{event?.name}</span>
          <h1 className="font-display font-bold text-2xl mt-0.5">{team?.teamName}</h1>
        </div>
        <div className="flex items-center gap-5">
          {socketStatus !== 'connected' && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-coral-400" title="Live updates are not connected — try refreshing the page.">
              <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-pulse" />
              {socketStatus === 'connecting' ? 'Connecting…' : 'Live updates disconnected'}
            </span>
          )}
          {event && <StatusBadge status={event.status} />}
          <div className="text-right">
            <div className="label">Balance</div>
            <div className="mono-num text-2xl text-teal-300 font-semibold">
              ₹{team?.currentBalance?.toLocaleString('en-IN') ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {event?.status === 'PAUSED' && (
        <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/10 px-5 py-4 text-gold-400 text-sm">
          This event is currently paused by the organizer. Hang tight.
        </div>
      )}

      <div className="flex gap-1.5 mb-6 p-1 bg-ink-800 rounded-xl border border-white/5 w-fit">
        {[['live', 'Live round'], ['leaderboard', 'Leaderboard'], ['history', 'My transactions']].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-colors ${
              activeTab === k ? 'bg-teal-400 text-ink-950' : 'text-mist-400 hover:text-mist-100'
            }`}>{l}</button>
        ))}
      </div>

      {activeTab === 'live' && (
        <div className="panel p-8 min-h-[380px] flex flex-col">
          {phase === 'LIVE' && !preview && (
            <Centered>Waiting for the organizer to start the next round…</Centered>
          )}

          {phase === 'COMPLETED' && (
            <Centered>
              <div className="text-center">
                <p className="font-display text-xl mb-2">🏁 Event completed</p>
                <p className="text-mist-400 text-sm">Check the leaderboard tab for final standings.</p>
              </div>
            </Centered>
          )}

          {preview && (phase === 'QUESTION_INFO' || phase === 'BIDDING') && (
            <div className="grid md:grid-cols-2 gap-8 items-center flex-1">
              <div>
                <span className="label">Question {preview.questionNumber} of {preview.totalRounds}</span>
                <h2 className="font-display font-bold text-3xl mt-2 mb-4">{preview.topic}</h2>
                <div className="flex flex-wrap gap-4 text-sm">
                  <Fact label="Category" value={preview.category} />
                  <Fact label="Difficulty" value={preview.difficulty} valueClass={DIFFICULTY_COLOR[preview.difficulty]} />
                  <Fact label="Potential reward" value={`${preview.potentialRewardMultiplier}x`} valueClass="text-gold-400" />
                </div>
                {preview.isChampionshipQuestion && (
                  <div className="mt-4 badge bg-coral-500/15 text-coral-400">🔥 Championship question</div>
                )}
                <p className="text-mist-500 text-xs mt-6">The question text stays hidden until bidding closes.</p>
              </div>

              <div className="flex flex-col items-center gap-6">
                {phase === 'BIDDING' && event?.biddingEndsAt ? (
                  <>
                    <CountdownClock endsAt={event.biddingEndsAt} label="Bidding closes in" size={120} />
                    <p className="text-xs text-mist-500 font-mono">{bidCount} team(s) have bid</p>
                    {myBid == null ? (
                      <form onSubmit={placeBid} className="w-full max-w-xs space-y-3">
                        <input
                          type="number"
                          className="input text-center text-lg mono-num"
                          placeholder={`Min ₹${event.minimumBid}`}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          min={event.minimumBid}
                          step={event.bidIncrement}
                          disabled={balanceLow}
                        />
                        {bidError && <p className="text-coral-400 text-xs text-center">{bidError}</p>}
                        {balanceLow && <p className="text-coral-400 text-xs text-center">Insufficient balance to bid.</p>}
                        <button className="btn-gold w-full" disabled={balanceLow}>Place blind bid</button>
                        <p className="text-mist-500 text-[11px] text-center">
                          Increment of ₹{event.bidIncrement} · balance ₹{team?.currentBalance?.toLocaleString('en-IN')}
                        </p>
                      </form>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-mist-400">Your bid is locked in.</p>
                        <p className="font-mono text-2xl text-gold-400 mt-1">₹{myBid.toLocaleString('en-IN')}</p>
                        <p className="text-mist-500 text-xs mt-2">Other teams&rsquo; bids stay hidden until the timer ends.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <Centered>Bidding opens shortly…</Centered>
                )}
              </div>
            </div>
          )}

          {phase === 'BID_CLOSED' && revealedBids && (
            <div className="flex-1">
              <h2 className="font-display font-bold text-2xl mb-1">Bidding closed</h2>
              <p className="text-mist-400 text-sm mb-6">
                {winner ? <>Winner: <span className="text-gold-400 font-semibold">{winner.teamName}</span> at <span className="mono-num text-gold-400">₹{winner.amount.toLocaleString('en-IN')}</span></> : 'No bids were placed for this question.'}
              </p>
              <div className="space-y-2">
                {revealedBids.map((b) => (
                  <div key={b.teamId} className={`flex justify-between px-4 py-3 rounded-xl border ${
                    winner && String(b.teamId) === String(winner.teamId) ? 'border-gold-500/40 bg-gold-500/5' : 'border-white/5'
                  }`}>
                    <span className={String(b.teamId) === String(team?._id ?? team?.id) ? 'text-teal-300' : ''}>{b.teamName}</span>
                    <span className="mono-num">₹{b.amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {revealedBids.length === 0 && <p className="text-mist-500 text-sm">No teams placed a bid this round.</p>}
              </div>
              {isWinner && <p className="mt-6 text-teal-300 text-sm text-center">You won the bid — get ready to answer!</p>}
            </div>
          )}

          {phase === 'QUESTION_ACTIVE' && question && (
            <div className="flex-1 grid md:grid-cols-[1fr,220px] gap-8">
              <div>
                <span className="label">Question</span>
                <h2 className="font-display font-semibold text-xl mt-2 mb-6 leading-snug">{question.questionText}</h2>

                {iAmAnswerer ? (
                  answerSubmitted ? (
                    <p className="text-teal-300 text-sm">Answer submitted — waiting for the result…</p>
                  ) : (
                    <form onSubmit={submitAnswer} className="space-y-2.5">
                      {(question.options || []).map((opt) => (
                        <label key={opt} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedAnswer === opt ? 'border-teal-400 bg-teal-400/10' : 'border-white/10 hover:border-white/20'
                        }`}>
                          <input type="radio" name="answer" className="accent-teal-400" checked={selectedAnswer === opt}
                            onChange={() => setSelectedAnswer(opt)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                      {bidError && <p className="text-coral-400 text-xs">{bidError}</p>}
                      <button className="btn-teal w-full mt-2" disabled={!selectedAnswer}>Lock in answer</button>
                    </form>
                  )
                ) : (
                  <div className="rounded-xl border border-white/10 px-4 py-6 text-center text-mist-500 text-sm">
                    Only the winning team can answer this round. Watch closely — you might bid next.
                  </div>
                )}
              </div>
              <div className="flex md:justify-end justify-center">
                {event?.answerEndsAt && <CountdownClock endsAt={event.answerEndsAt} label="Answer time" size={110} />}
              </div>
            </div>
          )}

          {phase === 'RESULT' && answerResult && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <span className={`text-4xl ${answerResult.result === 'CORRECT' ? '' : ''}`}>
                {answerResult.result === 'CORRECT' ? '✅' : answerResult.result === 'NO_BIDS' ? '⏭️' : '❌'}
              </span>
              <h2 className="font-display font-bold text-2xl">
                {answerResult.result === 'CORRECT' && `${answerResult.teamName} answered correctly!`}
                {answerResult.result === 'WRONG' && `${answerResult.teamName} answered incorrectly.`}
                {answerResult.result === 'TIMEOUT' && `${answerResult.teamName} ran out of time.`}
                {answerResult.result === 'NO_BIDS' && 'No one bid on this question.'}
              </h2>
              {answerResult.correctAnswer && (
                <p className="text-mist-400 text-sm">Correct answer: <span className="text-mist-100 font-mono">{answerResult.correctAnswer}</span></p>
              )}
              {answerResult.rewardAmount > 0 && <p className="text-teal-300 mono-num">+ ₹{answerResult.rewardAmount.toLocaleString('en-IN')}</p>}
              {answerResult.penaltyAmount > 0 && <p className="text-coral-400 mono-num">− ₹{answerResult.penaltyAmount.toLocaleString('en-IN')}</p>}
            </div>
          )}

          {phase === 'LEADERBOARD' && (
            <div className="flex-1">
              <p className="text-center text-mist-400 text-sm mb-4">Standings updated. Waiting for the next round…</p>
              <LeaderboardTable rows={leaderboard} highlightTeamId={team?._id ?? team?.id} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardTable rows={leaderboard} highlightTeamId={team?._id ?? team?.id} />
      )}

      {activeTab === 'history' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'BID', 'CORRECT_REWARD', 'WRONG_PENALTY', 'TIMEOUT_PENALTY', 'INITIAL_BALANCE'].map((f) => (
              <button key={f} onClick={() => setTxFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  txFilter === f ? 'bg-teal-400 text-ink-950' : 'bg-ink-800 text-mist-400 hover:text-mist-100'
                }`}>{f}</button>
            ))}
          </div>
          <div className="panel divide-y divide-white/5">
            {transactions.map((t) => (
              <div key={t._id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm">{t.note || t.type}</p>
                  <p className="text-xs text-mist-500 font-mono">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className={`mono-num font-semibold ${t.amount >= 0 ? 'text-teal-300' : 'text-coral-400'}`}>
                    {t.amount >= 0 ? '+' : ''}₹{t.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-mist-500 mono-num">Balance: ₹{t.balanceAfter.toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && <p className="px-5 py-10 text-center text-mist-500 text-sm">No transactions yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex-1 flex items-center justify-center text-mist-500 text-sm">{children}</div>;
}
function Fact({ label, value, valueClass = '' }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-mist-500">{label}</div>
      <div className={`font-mono font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}
