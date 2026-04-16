import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmittedAnswers from './SubmittedAnswers';
import { type ClientSubmission, GamePhase } from '../types';

function createSubmission(playerId: string, playerName: string): ClientSubmission {
  return {
    playerId,
    playerName,
    revealed: true,
    cards: [
      {
        id: `${playerId}-card`,
        type: 'answer',
        text: `${playerName} Antwort`,
        blanks: 0,
        extension: 'base',
      },
    ],
  };
}

describe('SubmittedAnswers', () => {
  it('clears the pending winner selection when a new round phase remounts the component', () => {
    const onPickWinner = vi.fn();
    const baseProps = {
      submissions: [createSubmission('p1', 'Anna'), createSubmission('p2', 'Bert')],
      isBoss: true,
      winnerId: null,
      communityVotingContext: null,
      onReveal: vi.fn(),
      onRevealAll: vi.fn(),
      onPickWinner,
    };

    const { rerender } = render(
      <SubmittedAnswers
        key="1-JUDGING"
        {...baseProps}
        phase={GamePhase.JUDGING}
      />,
    );

    fireEvent.click(screen.getByText('Anna Antwort'));
    const confirmButton = screen.getByRole('button', { name: 'Gewinner bestätigen' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);

    rerender(
      <SubmittedAnswers
        key="2-JUDGING"
        {...baseProps}
        phase={GamePhase.JUDGING}
      />,
    );

    const remountedConfirmButton = screen.getByRole('button', { name: 'Gewinner bestätigen' }) as HTMLButtonElement;
    expect(remountedConfirmButton.disabled).toBe(true);
    fireEvent.click(remountedConfirmButton);
    expect(onPickWinner).not.toHaveBeenCalled();
  });
});
