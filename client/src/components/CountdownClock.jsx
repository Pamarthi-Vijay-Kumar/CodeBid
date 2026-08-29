import { useEffect, useState } from 'react';

// Server-authoritative countdown (Section 41): we compute remaining time from
// a server timestamp, never from a client-started JS timer, so a slow client
// clock can't be exploited to "buy time".
export default function CountdownClock({ endsAt, size = 96, label, onExpire }) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!endsAt) return undefined;
    const end = new Date(endsAt).getTime();
    let raf;
    const tick = () => {
      const rem = Math.max(0, end - Date.now());
      setRemainingMs(rem);
      if (rem <= 0) {
        onExpire?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!endsAt) return null;

  const totalSec = Math.ceil(remainingMs / 1000);
  const seconds = String(totalSec % 60).padStart(2, '0');
  const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const urgent = totalSec <= 5 && totalSec > 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        style={{ width: size, height: size }}
        className={`relative rounded-full border-2 flex items-center justify-center ${
          urgent ? 'border-coral-500 shadow-[0_0_24px_rgba(255,92,92,0.35)]' : 'border-gold-500/70 shadow-glow'
        }`}
      >
        <span className={`font-mono font-bold tabular-nums ${urgent ? 'text-coral-400' : 'text-gold-400'}`} style={{ fontSize: size * 0.26 }}>
          {minutes}:{seconds}
        </span>
      </div>
      {label && <span className="label">{label}</span>}
    </div>
  );
}
