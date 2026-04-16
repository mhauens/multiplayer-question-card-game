import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby';
import { type ClientGameState, GamePhase } from '../types';

const useGameMock = vi.fn();

vi.mock('../context/GameContext', () => ({
  useGame: () => useGameMock(),
}));

vi.mock('../components/CommunityVotingPanel', () => ({
  default: () => null,
}));

vi.mock('../components/ShareAccessPanel', () => ({
  default: () => null,
}));

function createLobbyState(playerCount = 10): ClientGameState {
  return {
    code: 'ABCD',
    phase: GamePhase.LOBBY,
    phaseDeadline: null,
    reconnectWindow: null,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Spieler ${index + 1}`,
      trophies: 0,
      isConnected: true,
      isHost: index === 0,
      hasSubmitted: false,
      swappedThisRound: false,
    })),
    currentRound: 0,
    maxTrophies: 3,
    activeVariant: 'base',
    activeExtensions: [],
    myHand: [],
    myId: 'p1',
    currentQuestion: null,
    bossId: null,
    submissions: [],
    winnerId: null,
    winnerName: null,
    lastRoundWinnerId: null,
    lastRoundWinnerName: null,
    gameWinnerId: null,
    gameWinnerName: null,
    hasPassword: false,
    roundRecap: null,
    endGameStats: null,
    communityVoting: {
      enabled: false,
      privacyWarningAcknowledgedForSession: false,
      connection: {
        status: 'disconnected',
        channelLogin: null,
        channelDisplayName: null,
        sharedChatActive: false,
        lastError: null,
      },
      context: null,
    },
  };
}

describe('Lobby', () => {
  it('shows the updated 10-player cap', () => {
    useGameMock.mockReturnValue({
      gameState: createLobbyState(),
      startGame: vi.fn(),
      leaveGame: vi.fn(),
      availableVariants: [],
      kickPlayer: vi.fn(),
    });

    render(<Lobby />);

    expect(screen.getByText('Spieler (10/10)')).toBeTruthy();
  });
});
