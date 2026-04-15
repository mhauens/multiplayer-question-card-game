import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { GamePhase, type ClientGameState } from '../types';
import { GameProvider, useGame } from './GameContext';

const { emitMock, onMock, applyVariantThemeMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  onMock: vi.fn(() => () => undefined),
  applyVariantThemeMock: vi.fn(),
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    isConnected: true,
    emit: emitMock,
    on: onMock,
  }),
}));

vi.mock('../theme', () => ({
  applyVariantTheme: applyVariantThemeMock,
}));

vi.mock('../serverUrl', () => ({
  resolveServerUrl: () => 'http://localhost:3001',
}));

let latestContext: ReturnType<typeof useGame> | null = null;

function createStorageStub() {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
    get length() {
      return storage.size;
    },
  };
}

function createGameState(partial?: Partial<ClientGameState>): ClientGameState {
  return {
    code: 'ABCD',
    phase: GamePhase.LOBBY,
    phaseDeadline: null,
    reconnectWindow: null,
    players: [],
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
    ...partial,
  };
}

function collectStorageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
    (key): key is string => Boolean(key),
  );
}

function Probe() {
  latestContext = useGame();

  return (
    <>
      <div data-testid="status">{latestContext.gameState?.communityVoting.connection.status ?? 'none'}</div>
      <div data-testid="ack">{String(latestContext.gameState?.communityVoting.privacyWarningAcknowledgedForSession ?? false)}</div>
      <div data-testid="enabled">{String(latestContext.gameState?.communityVoting.enabled ?? false)}</div>
      <div data-testid="error">{latestContext.error ?? ''}</div>
    </>
  );
}

describe('GameContext Twitch community voting', () => {
  beforeEach(() => {
    latestContext = null;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('localStorage', createStorageStub());
    localStorage.clear();
    emitMock.mockReset();
    onMock.mockClear();
    applyVariantThemeMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps privacy acknowledgement session-local and overlays the connecting state during OAuth', async () => {
    const disconnectedState = createGameState();
    const connectedState = createGameState({
      communityVoting: {
        enabled: true,
        privacyWarningAcknowledgedForSession: false,
        connection: {
          status: 'connected',
          channelLogin: 'anna',
          channelDisplayName: 'AnnaTV',
          sharedChatActive: false,
          lastError: null,
        },
        context: null,
      },
    });
    const popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true;
      }),
      location: {
        replace: vi.fn(),
      },
    };

    emitMock.mockImplementation(async (event: string) => {
      switch (event) {
        case 'get-variants':
          return [];
        case 'create-game':
          return { gameCode: 'ABCD', playerId: 'p1', state: disconnectedState };
        case 'twitch-connect:start':
          return { url: 'https://id.twitch.tv/oauth2/authorize?scope=user%3Aread%3Achat' };
        case 'get-state':
          return { state: connectedState };
        default:
          return { success: true };
      }
    });

    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('open', vi.fn(() => popup));

    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );

    await act(async () => {
      await latestContext?.createGame('Anna', 3, 'base', []);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('disconnected');
    });

    const connectPromise = latestContext!.connectTwitchCommunity();

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connecting');
      expect(screen.getByTestId('ack').textContent).toBe('true');
    });

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:3001',
      data: {
        type: 'twitch-oauth-complete',
        status: 'success',
        message: 'ok',
      },
    }));

    await act(async () => {
      await connectPromise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
      expect(screen.getByTestId('enabled').textContent).toBe('true');
    });

    expect(popup.location.replace).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/authorize?scope=user%3Aread%3Achat');
    expect(collectStorageKeys()).toEqual(['kgds-reconnect-session']);
  });

  it('does not start Twitch OAuth when the privacy warning is declined', async () => {
    emitMock.mockImplementation(async (event: string) => {
      switch (event) {
        case 'get-variants':
          return [];
        case 'create-game':
          return { gameCode: 'ABCD', playerId: 'p1', state: createGameState() };
        default:
          return { success: true };
      }
    });

    const openMock = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => false));
    vi.stubGlobal('open', openMock);

    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );

    await act(async () => {
      await latestContext?.createGame('Anna', 3, 'base', []);
    });

    await act(async () => {
      await latestContext?.connectTwitchCommunity();
    });

    expect(openMock).not.toHaveBeenCalled();
    expect(emitMock.mock.calls.some(([event]) => event === 'twitch-connect:start')).toBe(false);
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('ack').textContent).toBe('false');
  });
});