import { useEffect, useState } from 'react';
import { ClientCommunityVotingContext, ClientSubmission, GamePhase } from '../types';
import '../styles/cards.css';

interface SubmittedAnswersProps {
  submissions: ClientSubmission[];
  isBoss: boolean;
  phase: GamePhase;
  winnerId: string | null;
  communityVotingContext: ClientCommunityVotingContext | null;
  onReveal: (index: number) => void;
  onRevealAll: () => void;
  onPickWinner: (playerId: string) => void;
}

export default function SubmittedAnswers({
  submissions,
  isBoss,
  phase,
  winnerId,
  communityVotingContext,
  onReveal,
  onRevealAll,
  onPickWinner,
}: SubmittedAnswersProps) {
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const voteOptions = communityVotingContext?.kind === 'JUDGE_SUBMISSIONS'
    ? communityVotingContext.options
    : [];

  useEffect(() => {
    if (phase !== GamePhase.JUDGING || !isBoss) {
      setPendingWinnerId(null);
      return;
    }

    if (pendingWinnerId && !submissions.some((submission) => submission.playerId === pendingWinnerId && submission.revealed)) {
      setPendingWinnerId(null);
    }
  }, [isBoss, pendingWinnerId, phase, submissions]);

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
        {submissions.map((sub, index) => {
          const voteOption = voteOptions.find((option) => option.targetId === sub.playerId);

          return (
            <div
              key={index}
              className={`submission-card ${sub.revealed ? 'revealed' : 'hidden'} ${isJudging && isBoss ? 'pickable' : ''} ${isJudging && sub.playerId === pendingWinnerId ? 'is-selected' : ''} ${isRoundEnd && sub.playerId ? 'show-name' : ''} ${isRoundEnd && sub.playerId === winnerId ? 'is-round-winner' : ''} ${voteOption ? 'has-community-vote' : ''} ${voteOption?.isLeading ? 'is-vote-leading' : ''} ${voteOption?.isRecommended ? 'is-vote-recommended' : ''}`}
              onClick={() => {
                if (!sub.revealed && isBoss && isRevealing) {
                  onReveal(index);
                } else if (sub.revealed && isBoss && isJudging) {
                  setPendingWinnerId(sub.playerId);
                }
              }}
            >
              {sub.revealed ? (
                <>
                  {voteOption && (
                    <div className="community-vote-overlay submission-vote-overlay">
                      <span className="community-vote-command">{voteOption.voteCommand}</span>
                      <span className="community-vote-count">
                        {voteOption.votes} Stimme{voteOption.votes === 1 ? '' : 'n'}
                      </span>
                    </div>
                  )}
                <div
                  className={`submission-cards ${sub.cards.length > 1 ? 'has-multiple-answers' : ''}`}
                >
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
                  <div className="pick-hint">
                    {sub.playerId === pendingWinnerId ? 'Ausgewählt, unten bestätigen' : 'Klicke zum Auswählen'}
                  </div>
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
          );
        })}
      </div>

      {isJudging && isBoss && (
        <div className="submissions-actions submissions-actions-confirm">
          <button
            className="btn btn-primary submissions-confirm-winner"
            onClick={() => pendingWinnerId && onPickWinner(pendingWinnerId)}
            disabled={!pendingWinnerId}
          >
            Gewinner bestätigen
          </button>
        </div>
      )}
    </div>
  );
}
