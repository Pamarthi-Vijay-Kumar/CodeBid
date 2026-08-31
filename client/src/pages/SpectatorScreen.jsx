import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../socket/socket';
import CountdownClock from '../components/CountdownClock';
import LeaderboardTable from '../components/LeaderboardTable';
import StatusBadge from '../components/StatusBadge';

// Section 38 - public spectator screen, suitable for a projector.
export default function SpectatorScreen() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState('LIVE');
  const [preview, setPreview] = useState(null);
  const [bidCount, setBidCount] = useState(0);
  const [winner, setWinner] = useState(null);
  const [result, setResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const socketRef = useRef(null);

  const loadEvent = () => api.get(`/events/${eventId}`).then(({ data }) => { setEvent(data.event); setPhase(data.event.competitionState); });
  const loadLeaderboard = () => api.get(`/events/${eventId}/leaderboard`).then(({ data }) => setLeaderboard(data.leaderboard));

  // Poll as a fallback so this screen never fully freezes even if the
  // socket connection is unhealthy - every 8s while disconnected, every
  // 20s otherwise as a safety net against missed broadcasts.
  useEffect(() => {
    loadEvent(); loadLeaderboard();
    const t = setInterval(() => {
      loadLeaderboard();
      if (socketStatus !== 'connected') loadEvent();
    }, socketStatus === 'connected' ? 20000 : 8000);
    return () => clearInterval(t);
  }, [eventId, socketStatus]); // eslint-disable-line

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => { setSocketStatus('connected'); socket.emit('event:join', { eventId }); };
    const onDisconnect = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('error');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.connect();
    if (socket.connected) onConnect();

    const onRound = (p) => { setPreview(p); setPhase('QUESTION_INFO'); setBidCount(0); setWinner(null); setResult(null); };
    const onBidding = ({ biddingEndsAt }) => { setPhase('BIDDING'); setEvent((e) => e && ({ ...e, biddingEndsAt })); };
    const onBid = ({ bidCount }) => setBidCount(bidCount);
    const onClosed = ({ winner }) => { setPhase('BID_CLOSED'); setWinner(winner); };
    const onReveal = (q) => { setPhase('QUESTION_ACTIVE'); setEvent((e) => e && ({ ...e, answerEndsAt: q.answerEndsAt })); };
    const onResult = (r) => { setPhase('RESULT'); setResult(r); };
    const onLeaderboard = () => { setPhase('LEADERBOARD'); loadLeaderboard(); };
    const onCompleted = () => setPhase('COMPLETED');

    socket.on('round:started', onRound);
    socket.on('bidding:started', onBidding);
    socket.on('bid:submitted', onBid);
    socket.on('bidding:closed', onClosed);
    socket.on('question:revealed', onReveal);
    socket.on('answer:result', onResult);
    socket.on('leaderboard:updated', onLeaderboard);
    socket.on('event:completed', onCompleted);

    return () => {
      socket.emit('event:leave', { eventId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('round:started', onRound);
      socket.off('bidding:started', onBidding);
      socket.off('bid:submitted', onBid);
      socket.off('bidding:closed', onClosed);
      socket.off('question:revealed', onReveal);
      socket.off('answer:result', onResult);
      socket.off('leaderboard:updated', onLeaderboard);
      socket.off('event:completed', onCompleted);
      socket.disconnect();
    };
  }, [eventId]);

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="label">Live spectator screen</span>
          <h1 className="font-display font-bold text-3xl mt-1">{event?.name || 'CodeBid'}</h1>
        </div>
        <div className="flex items-center gap-4">
          {socketStatus !== 'connected' && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-coral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-pulse" />
              {socketStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </span>
          )}
          {event && <StatusBadge status={event.status} />}
        </div>
      </div>

      <div className="panel p-10 min-h-[320px] flex items-center justify-center mb-8">
        {phase === 'LIVE' && !preview && <p className="text-mist-500">Waiting for the next round to begin…</p>}
        {phase === 'COMPLETED' && <p className="font-display text-2xl">🏁 Event complete — see final standings below.</p>}

        {preview && (phase === 'QUESTION_INFO' || phase === 'BIDDING') && (
          <div className="text-center w-full">
            <span className="label">Question {preview.questionNumber} / {preview.totalRounds}</span>
            <h2 className="font-display font-bold text-4xl mt-2">{preview.topic}</h2>
            <p className="text-mist-400 mt-1">{preview.category} · {preview.difficulty} · {preview.potentialRewardMultiplier}x reward</p>
            {phase === 'BIDDING' && event?.biddingEndsAt && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <CountdownClock endsAt={event.biddingEndsAt} size={140} label="Bidding" />
                <p className="font-mono text-mist-400 text-sm">{bidCount} bid(s) placed — sealed</p>
              </div>
            )}
          </div>
        )}

        {phase === 'BID_CLOSED' && (
          <div className="text-center">
            <p className="label mb-2">Bidding closed</p>
            {winner ? (
              <p className="font-display text-3xl">
                <span className="text-gold-400">{winner.teamName}</span> wins at <span className="mono-num">₹{winner.amount.toLocaleString('en-IN')}</span>
              </p>
            ) : <p className="font-display text-2xl text-mist-400">No bids this round</p>}
          </div>
        )}

        {phase === 'QUESTION_ACTIVE' && event?.answerEndsAt && (
          <div className="text-center flex flex-col items-center gap-4">
            <p className="label">Answer window open</p>
            <CountdownClock endsAt={event.answerEndsAt} size={140} label="Answer time" />
          </div>
        )}

        {phase === 'RESULT' && result && (
          <div className="text-center">
            <p className="text-5xl mb-3">{result.result === 'CORRECT' ? '✅' : result.result === 'NO_BIDS' ? '⏭️' : '❌'}</p>
            <p className="font-display text-2xl">
              {result.teamName ? `${result.teamName} — ${result.result}` : 'No bids on this question'}
            </p>
          </div>
        )}

        {phase === 'LEADERBOARD' && <p className="text-mist-400">Standings updated — see below.</p>}
      </div>

      <LeaderboardTable rows={leaderboard} />
    </div>
  );
}
