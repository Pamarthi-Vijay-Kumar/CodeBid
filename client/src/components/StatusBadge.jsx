const MAP = {
  LIVE: 'badge-live',
  PAUSED: 'badge-paused',
  SCHEDULED: 'badge-scheduled',
  DRAFT: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-scheduled',
  ARCHIVED: 'badge-scheduled',
};

export default function StatusBadge({ status }) {
  const cls = MAP[status] || 'badge-scheduled';
  const pulsing = status === 'LIVE';
  return (
    <span className={cls}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${pulsing ? 'animate-pulseRing' : ''}`} />
      {status}
    </span>
  );
}
