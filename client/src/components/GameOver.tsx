import { ClientPlayer } from '../types';

interface GameOverProps {
  players: ClientPlayer[];
  winnerId: string | null;
  winnerName: string | null;
  myId: string;
  isHost: boolean;
  onRematch: () => void;
  onLeave: () => void;
}

export default function GameOver({ players, winnerId, winnerName, myId, isHost, onRematch, onLeave }: GameOverProps) {
  const sorted = [...players].sort((a, b) => b.trophies - a.trophies);
  const isWinner = winnerId === myId;

  return (
    <div className="game-over-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">Spiel vorbei!</h1>

        <div className="winner-section">
          {isWinner ? (
            <>
              <div className="winner-emoji">🎉🏆🎉</div>
              <h2 className="winner-text">Du hast gewonnen!</h2>
            </>
          ) : (
            <>
              <div className="winner-emoji">🏆</div>
              <h2 className="winner-text">{winnerName} hat gewonnen!</h2>
            </>
          )}
        </div>

        <div className="final-scores">
          <h3>Endstand</h3>
          <ol className="final-scores-list">
            {sorted.map((p, i) => (
              <li key={p.id} className={`final-score-item ${p.id === myId ? 'is-me' : ''}`}>
                <span className="final-rank">{i + 1}.</span>
                <span className="final-name">{p.name}{p.id === myId ? ' (Du)' : ''}</span>
                <span className="final-trophies">{p.trophies} 🏆</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="game-over-actions">
          {isHost ? (
            <button className="btn btn-primary btn-large" onClick={onRematch}>
              Nochmal spielen
            </button>
          ) : (
            <p className="game-over-waiting">Warte auf den Host, um direkt eine Revanche zu starten.</p>
          )}

          <button className="btn btn-secondary btn-large" onClick={onLeave}>
            Zurück zur Startseite
          </button>
        </div>
      </div>
    </div>
  );
}
