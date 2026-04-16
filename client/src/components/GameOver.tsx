import { ClientEndGameStats, RoundRecapEntry } from '../types';

function renderQuestionWithAnswers(questionText: string, winningCards: { text: string }[]): (string | React.ReactElement)[] {
  const parts = questionText.split('________');
  const result: (string | React.ReactElement)[] = [];

  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i]);
    if (i < parts.length - 1) {
      const answer = winningCards[i];
      if (answer) {
        result.push(
          <span key={i} className="round-recap-filled-blank">{answer.text.replace(/\.$/, '')}</span>,
        );
      } else {
        result.push('________');
      }
    }
  }

  return result;
}

interface GameOverProps {
  winnerId: string | null;
  winnerName: string | null;
  myId: string;
  isHost: boolean;
  endGameStats: ClientEndGameStats;
  roundRecap: RoundRecapEntry[] | null;
  onRematch: () => void;
  onLeave: () => void;
}

export default function GameOver({ winnerId, winnerName, myId, isHost, endGameStats, roundRecap, onRematch, onLeave }: GameOverProps) {
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
            {endGameStats.players.map((p, i) => (
              <li key={p.playerId} className={`final-score-item ${p.playerId === myId ? 'is-me' : ''}`}>
                <span className="final-rank">{i + 1}.</span>
                <span className="final-name">{p.playerName}{p.playerId === myId ? ' (Du)' : ''}</span>
                <span className="final-trophies">{p.trophies} 🏆</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="match-summary">
          <h3>Match-Zusammenfassung</h3>

          <div className="match-summary-total">
            <span className="match-summary-label">Gesamtrunden</span>
            <strong>{endGameStats.totalRounds}</strong>
          </div>

          <div className="match-highlights" aria-label="Match-Highlights">
            {endGameStats.highlights.map((highlight) => (
              <article key={highlight.key} className="match-highlight-card">
                <p className="match-highlight-title">{highlight.title}</p>
                <p className="match-highlight-value">{highlight.value}</p>
                <p className="match-highlight-leaders">
                  {highlight.leaders.map((leader) => leader.playerName).join(', ')}
                </p>
              </article>
            ))}
          </div>

          <div className="match-stats-table-wrap">
            <table className="match-stats-table">
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th>🏆</th>
                  <th>Boss</th>
                  <th>Abgaben</th>
                  <th>Wechsel</th>
                  <th>Serie</th>
                </tr>
              </thead>
              <tbody>
                {endGameStats.players.map((player) => (
                  <tr key={player.playerId} className={player.playerId === myId ? 'is-me' : ''}>
                    <td>{player.playerName}{player.playerId === myId ? ' (Du)' : ''}</td>
                    <td>{player.trophies}</td>
                    <td>{player.bossRounds}</td>
                    <td>{player.submittedRounds}</td>
                    <td>{player.swappedRounds}</td>
                    <td>{player.longestWinStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {roundRecap && roundRecap.length > 0 && (
          <div className="round-recap">
            <h3>Rundenprotokoll</h3>
            <div className="round-recap-list">
              {roundRecap.map((entry) => (
                <div key={entry.roundNumber} className="round-recap-entry">
                  <div className="round-recap-header">
                    <span className="round-recap-number">Runde {entry.roundNumber}</span>
                    {entry.winnerName && <span className="round-recap-winner">🏆 {entry.winnerName}</span>}
                  </div>
                  <p className="round-recap-question">
                    {entry.winningCards.length > 0
                      ? renderQuestionWithAnswers(entry.questionText, entry.winningCards)
                      : entry.questionText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
