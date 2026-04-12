import { ClientPlayer, GamePhase } from '../types';

interface ScoreboardProps {
  players: ClientPlayer[];
  myId: string;
  bossId: string | null;
  roundWinnerId: string | null;
  maxTrophies: number;
  phase: GamePhase;
}

export default function Scoreboard({
  players,
  myId,
  bossId,
  roundWinnerId,
  maxTrophies,
  phase,
}: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.trophies - a.trophies);

  return (
    <div className="scoreboard">
      <h3 className="scoreboard-title">Punktestand (Ziel: {maxTrophies})</h3>
      <div className="scoreboard-list">
        {sorted.map(p => (
          <div
            key={p.id}
            className={`scoreboard-row ${p.id === myId ? 'is-me' : ''} ${p.id === roundWinnerId ? 'is-round-winner' : ''} ${!p.isConnected ? 'disconnected' : ''}`}
          >
            <span className="scoreboard-name">
              {p.id === bossId && <span className="boss-icon" title="Rundenboss">👑</span>}
              {p.name}
              {p.id === roundWinnerId && <span className="scoreboard-badge">Rundensieg</span>}
              {p.id === myId && ' (Du)'}
              {phase === GamePhase.SUBMITTING && p.id !== bossId && p.isConnected && (
                <span className={`scoreboard-status ${p.swappedThisRound ? 'is-swapped' : p.hasSubmitted ? 'is-ready' : 'is-pending'}`}>
                  {p.swappedThisRound ? 'tauscht aus' : p.hasSubmitted ? 'fertig' : 'offen'}
                </span>
              )}
            </span>
            <span className="scoreboard-trophies">
              {'🏆'.repeat(p.trophies)}
              {p.trophies === 0 && <span className="no-trophies">0</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
