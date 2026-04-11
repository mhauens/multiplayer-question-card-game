import { ClientPlayer } from '../types';

interface ScoreboardProps {
  players: ClientPlayer[];
  myId: string;
  bossId: string | null;
  maxTrophies: number;
}

export default function Scoreboard({ players, myId, bossId, maxTrophies }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.trophies - a.trophies);

  return (
    <div className="scoreboard">
      <h3 className="scoreboard-title">Punktestand (Ziel: {maxTrophies})</h3>
      <div className="scoreboard-list">
        {sorted.map(p => (
          <div
            key={p.id}
            className={`scoreboard-row ${p.id === myId ? 'is-me' : ''} ${!p.isConnected ? 'disconnected' : ''}`}
          >
            <span className="scoreboard-name">
              {p.id === bossId && <span className="boss-icon" title="Rundenboss">👑</span>}
              {p.name}
              {p.id === myId && ' (Du)'}
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
