import { ClientSubmission, GamePhase } from '../types';
import '../styles/cards.css';

interface SubmittedAnswersProps {
  submissions: ClientSubmission[];
  isBoss: boolean;
  phase: GamePhase;
  winnerId: string | null;
  onReveal: (index: number) => void;
  onRevealAll: () => void;
  onPickWinner: (playerId: string) => void;
}

export default function SubmittedAnswers({
  submissions,
  isBoss,
  phase,
  winnerId,
  onReveal,
  onRevealAll,
  onPickWinner,
}: SubmittedAnswersProps) {
  if (submissions.length === 0) return null;

  const allRevealed = submissions.every(s => s.revealed);
  const isRevealing = phase === GamePhase.REVEALING;
  const isJudging = phase === GamePhase.JUDGING;
  const isRoundEnd = phase === GamePhase.ROUND_END;

  return (
    <div className="submitted-answers">
      <h3 className="submissions-title">
        {isRevealing && isBoss && 'Decke die Antworten auf!'}
        {isRevealing && !isBoss && 'Der Rundenboss deckt die Antworten auf...'}
        {isJudging && isBoss && 'Wähle die beste Antwort!'}
        {isJudging && !isBoss && 'Der Rundenboss wählt die beste Antwort...'}
        {isRoundEnd && 'Ergebnis der Runde'}
      </h3>

      {isBoss && isRevealing && !allRevealed && (
        <div className="submissions-actions">
          <button className="btn btn-secondary submissions-reveal-all" onClick={onRevealAll}>
            Alle aufdecken
          </button>
        </div>
      )}

      <div className="submissions-grid">
        {submissions.map((sub, index) => (
          <div
            key={index}
            className={`submission-card ${sub.revealed ? 'revealed' : 'hidden'} ${isJudging && isBoss ? 'pickable' : ''} ${isRoundEnd && sub.playerId ? 'show-name' : ''} ${isRoundEnd && sub.playerId === winnerId ? 'is-round-winner' : ''}`}
            onClick={() => {
              if (!sub.revealed && isBoss && isRevealing) {
                onReveal(index);
              } else if (sub.revealed && isBoss && isJudging) {
                onPickWinner(sub.playerId);
              }
            }}
          >
            {sub.revealed ? (
              <>
                <div className="submission-cards">
                  {sub.cards.map((card, ci) => (
                    <div key={ci} className="submission-answer-text">
                      {card.text}
                    </div>
                  ))}
                </div>
                {isRoundEnd && (
                  <div className="submission-player-wrap">
                    <div className="submission-player">{sub.playerName}</div>
                    {sub.playerId === winnerId && (
                      <div className="submission-winner-badge">Ausgewählt vom Boss</div>
                    )}
                  </div>
                )}
                {isJudging && isBoss && (
                  <div className="pick-hint">Klicke zum Auswählen</div>
                )}
              </>
            ) : (
              <div className="submission-hidden">
                {isBoss && isRevealing ? (
                  <span className="reveal-hint">Klicke zum Aufdecken</span>
                ) : (
                  <span>?</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
