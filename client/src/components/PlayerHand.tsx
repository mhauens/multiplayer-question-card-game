import { useState } from 'react';
import { Card, ClientCommunityVotingContext } from '../types';
import AnswerCard from './AnswerCard';

interface PlayerHandProps {
  cards: Card[];
  blanksNeeded: number;
  communityVotingContext: ClientCommunityVotingContext | null;
  onSubmit: (cardIds: string[]) => void;
  onSwap: () => void;
  disabled: boolean;
  hasSubmitted: boolean;
  isBoss: boolean;
  swappedThisRound: boolean;
}

export default function PlayerHand({
  cards,
  blanksNeeded,
  communityVotingContext,
  onSubmit,
  onSwap,
  disabled,
  hasSubmitted,
  isBoss,
  swappedThisRound,
}: PlayerHandProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const voteOptions = communityVotingContext?.kind === 'SUBMIT_HAND'
    ? communityVotingContext.options
    : [];

  const toggleCard = (cardId: string) => {
    if (disabled || hasSubmitted || isBoss) return;

    setSelectedIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }
      if (prev.length >= blanksNeeded) {
        // Replace the last selected
        return [...prev.slice(0, -1), cardId];
      }
      return [...prev, cardId];
    });
  };

  const handleSubmit = () => {
    if (selectedIds.length === blanksNeeded) {
      onSubmit(selectedIds);
      setSelectedIds([]);
    }
  };

  const canSubmit = selectedIds.length === blanksNeeded && !disabled && !hasSubmitted && !isBoss;

  if (isBoss) {
    return (
      <div className="player-hand">
        <div className="hand-info boss-info">
          Du bist der Rundenboss! Warte auf die Antworten der anderen.
        </div>
        <div className="hand-cards">
          {cards.map(card => (
            <AnswerCard
              key={card.id}
              card={card}
              disabled
              voteOption={voteOptions.find((option) => option.targetId === card.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="player-hand">
        <div className="hand-info submitted-info">
          Antwort eingereicht! Warte auf die anderen...
        </div>
      </div>
    );
  }

  if (swappedThisRound) {
    return (
      <div className="player-hand">
        <div className="hand-info swapped-info">
          Du hast diese Runde deine Karten getauscht und setzt aus.
        </div>
        <div className="hand-cards">
          {cards.map(card => (
            <AnswerCard
              key={card.id}
              card={card}
              disabled
              voteOption={voteOptions.find((option) => option.targetId === card.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="player-hand">
      <div className="hand-header">
        <span className="hand-label">
          Deine Karten — {blanksNeeded > 1 ? `Wähle ${blanksNeeded} Karten` : 'Wähle eine Karte'}
        </span>
        <div className="hand-actions">
          <button
            className="btn btn-small btn-outline"
            onClick={onSwap}
            disabled={disabled}
            title="Alle Karten tauschen und Runde aussetzen"
          >
            🔄 Karten tauschen
          </button>
        </div>
      </div>
      <div className="hand-cards">
        {cards.map(card => (
          <AnswerCard
            key={card.id}
            card={card}
            selected={selectedIds.includes(card.id)}
            selectionOrder={selectedIds.indexOf(card.id) >= 0 ? selectedIds.indexOf(card.id) : undefined}
            onClick={() => toggleCard(card.id)}
            disabled={disabled}
            voteOption={voteOptions.find((option) => option.targetId === card.id)}
          />
        ))}
      </div>
      {canSubmit && (
        <button className="btn btn-primary btn-large submit-btn" onClick={handleSubmit}>
          Antwort einreichen
        </button>
      )}
    </div>
  );
}
