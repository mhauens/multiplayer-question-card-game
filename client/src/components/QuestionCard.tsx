import { Card } from '../types';
import '../styles/cards.css';

interface QuestionCardProps {
  card: Card;
  submittedAnswers?: Card[];
}

export default function QuestionCard({ card, submittedAnswers }: QuestionCardProps) {
  const renderText = () => {
    if (!submittedAnswers || submittedAnswers.length === 0) {
      return card.text;
    }

    // Replace blanks with answer texts
    const parts = card.text.split('________');
    const result: (string | React.ReactElement)[] = [];

    for (let i = 0; i < parts.length; i++) {
      result.push(parts[i]);
      if (i < parts.length - 1) {
        const answer = submittedAnswers[i];
        if (answer) {
          result.push(
            <span key={i} className="filled-blank">
              {answer.text.replace(/\.$/, '')}
            </span>
          );
        } else {
          result.push(
            <span key={i} className="blank">________</span>
          );
        }
      }
    }

    return result;
  };

  return (
    <div className="card question-card">
      <div className="card-text">{renderText()}</div>
    </div>
  );
}
