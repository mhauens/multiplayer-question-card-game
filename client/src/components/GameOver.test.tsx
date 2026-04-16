import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GameOver from './GameOver';
import { type ClientEndGameStats } from '../types';

const endGameStats: ClientEndGameStats = {
  totalRounds: 2,
  players: [
    {
      playerId: 'p2',
      playerName: 'Bert',
      trophies: 1,
      bossRounds: 1,
      submittedRounds: 2,
      swappedRounds: 0,
      currentWinStreak: 1,
      longestWinStreak: 1,
    },
    {
      playerId: 'p3',
      playerName: 'Chris',
      trophies: 1,
      bossRounds: 1,
      submittedRounds: 2,
      swappedRounds: 0,
      currentWinStreak: 1,
      longestWinStreak: 1,
    },
    {
      playerId: 'p1',
      playerName: 'Anna',
      trophies: 0,
      bossRounds: 0,
      submittedRounds: 0,
      swappedRounds: 0,
      currentWinStreak: 0,
      longestWinStreak: 0,
    },
  ],
  highlights: [
    {
      key: 'longest-win-streak',
      title: 'Längste Siegesserie',
      value: 1,
      leaders: [
        {
          playerId: 'p2',
          playerName: 'Bert',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
        {
          playerId: 'p3',
          playerName: 'Chris',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
      ],
    },
    {
      key: 'most-boss-rounds',
      title: 'Meiste Bossrunden',
      value: 1,
      leaders: [
        {
          playerId: 'p2',
          playerName: 'Bert',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
        {
          playerId: 'p3',
          playerName: 'Chris',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
      ],
    },
    {
      key: 'most-submitted-rounds',
      title: 'Meiste Abgaben',
      value: 2,
      leaders: [
        {
          playerId: 'p2',
          playerName: 'Bert',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
        {
          playerId: 'p3',
          playerName: 'Chris',
          trophies: 1,
          bossRounds: 1,
          submittedRounds: 2,
          swappedRounds: 0,
          currentWinStreak: 1,
          longestWinStreak: 1,
        },
      ],
    },
  ],
};

describe('GameOver', () => {
  it('renders the match summary, tied leaders, and the recap alongside the final ranking', () => {
    render(
      <GameOver
        winnerId="p2"
        winnerName="Bert"
        myId="p1"
        isHost
        endGameStats={endGameStats}
        roundRecap={[
          {
            roundNumber: 1,
            questionText: 'Die beste Antwort ist _____.',
            questionBlanks: 1,
            winnerName: 'Bert',
            winningCards: [{ text: 'Antwort 1' }],
          },
        ]}
        onRematch={() => undefined}
        onLeave={() => undefined}
      />,
    );

    expect(screen.getByText('Spiel vorbei!')).toBeTruthy();
    expect(screen.getByText('Endstand')).toBeTruthy();
    expect(screen.getByText('Match-Zusammenfassung')).toBeTruthy();
    expect(screen.getByText('Gesamtrunden')).toBeTruthy();
    expect(screen.getByText('2', { selector: '.match-summary-total strong' })).toBeTruthy();
    expect(screen.getAllByText('Bert, Chris')).toHaveLength(3);
    expect(screen.queryByText('Meiste Handtausche')).toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Rundenprotokoll')).toBeTruthy();
  });
});
