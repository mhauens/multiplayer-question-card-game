import { getRemainingSeconds, useCurrentTime } from '../hooks/useCurrentTime';

interface ReconnectOverlayProps {
  playerNames: string[];
  deadline: number;
  title: string;
  body: string;
}

export default function ReconnectOverlay({ playerNames, deadline, title, body }: ReconnectOverlayProps) {
  const currentTime = useCurrentTime();
  const remainingSeconds = getRemainingSeconds(deadline, currentTime);
  const reconnectLabel = playerNames.length === 1
    ? playerNames[0]
    : playerNames.join(', ');
  const reconnectCopy = playerNames.length === 1
    ? 'kann sich noch verbinden.'
    : 'können sich noch verbinden.';

  return (
    <div className="reconnect-overlay" role="presentation">
      <div className="reconnect-dialog" role="alert" aria-live="assertive">
        <p className="reconnect-eyebrow">Reconnect-Fenster</p>
        <h2>{title}</h2>
        <p className="reconnect-copy">
          <strong>{reconnectLabel}</strong> {reconnectCopy}
        </p>
        <p className="reconnect-copy">{body}</p>
        <div className="reconnect-counter">{remainingSeconds}s</div>
      </div>
    </div>
  );
}
