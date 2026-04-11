import { Card } from '../types';
import '../styles/cards.css';

interface AnswerCardProps {
  card: Card;
  selected?: boolean;
  selectionOrder?: number;
  onClick?: () => void;
  disabled?: boolean;
}

export default function AnswerCard({ card, selected, selectionOrder, onClick, disabled }: AnswerCardProps) {
  return (
    <div
      className={`card answer-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="card-text">{card.text}</div>
      {selected && selectionOrder !== undefined && (
        <div className="selection-badge">{selectionOrder + 1}</div>
      )}
    </div>
  );
}
