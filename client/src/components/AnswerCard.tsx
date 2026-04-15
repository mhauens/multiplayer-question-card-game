import { Card, ClientCommunityVotingOption } from '../types';
import '../styles/cards.css';

interface AnswerCardProps {
  card: Card;
  selected?: boolean;
  selectionOrder?: number;
  onClick?: () => void;
  disabled?: boolean;
  voteOption?: ClientCommunityVotingOption;
}

export default function AnswerCard({ card, selected, selectionOrder, onClick, disabled, voteOption }: AnswerCardProps) {
  return (
    <div
      className={`card answer-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${onClick ? 'clickable' : ''} ${voteOption ? 'has-community-vote' : ''} ${voteOption?.isLeading ? 'is-vote-leading' : ''} ${voteOption?.isRecommended ? 'is-vote-recommended' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      {voteOption && (
        <div className="community-vote-overlay">
          <span className="community-vote-command">{voteOption.voteCommand}</span>
          <span className="community-vote-count">{voteOption.votes} Stimme{voteOption.votes === 1 ? '' : 'n'}</span>
        </div>
      )}
      <div className="card-text">{card.text}</div>
      {selected && selectionOrder !== undefined && (
        <div className="selection-badge">{selectionOrder + 1}</div>
      )}
    </div>
  );
}
