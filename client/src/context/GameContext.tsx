import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { type TrophyTarget } from '@kgs/game-rules';
import { CardCatalogOption, ClientGameState } from '../types';
import { useSocket } from '../hooks/useSocket';
import { applyVariantTheme } from '../theme';

const RECONNECT_STORAGE_KEY = 'kgds-reconnect-session';

interface StoredReconnectSession {
  gameCode: string;
  playerId: string;
  playerName?: string;
}

function shouldAttemptSessionRestore(): boolean {
  const pathname = window.location.pathname;
  return pathname.startsWith('/lobby') || pathname.startsWith('/game');
}

function loadStoredSession(): StoredReconnectSession | null {
  const rawSession = localStorage.getItem(RECONNECT_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredReconnectSession;
  } catch {
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    return null;
  }
}

function saveStoredSession(session: StoredReconnectSession): void {
  localStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem(RECONNECT_STORAGE_KEY);
}

interface GameContextType {
  gameState: ClientGameState | null;
  availableVariants: CardCatalogOption[];
  isConnected: boolean;
  isRestoringSession: boolean;
  error: string | null;
  toast: string | null;
  createGame: (playerName: string, maxTrophies: TrophyTarget, variant: string, extensions: string[], password?: string) => Promise<string | null>;
  joinGame: (gameCode: string, playerName: string, password?: string) => Promise<string | null>;
  startGame: () => Promise<void>;
  rematch: () => Promise<void>;
  submitAnswer: (cardIds: string[]) => Promise<void>;
  swapCards: () => Promise<void>;
  revealSubmission: (index: number) => Promise<void>;
  revealAll: () => Promise<void>;
  pickWinner: (playerId: string) => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  nextRound: () => Promise<void>;
  leaveGame: () => Promise<void>;
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, emit, on } = useSocket();
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [availableVariants, setAvailableVariants] = useState<CardCatalogOption[]>([]);
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => shouldAttemptSessionRestore() && loadStoredSession() !== null,
  );
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const syncGameState = useCallback(async () => {
    const response = await emit('get-state');
    if (!response?.error && response?.state) {
      setGameState(response.state);
    }
  }, [emit]);

  useEffect(() => {
    applyVariantTheme(gameState?.activeVariant);
  }, [gameState?.activeVariant]);

  useEffect(() => {
    if (!gameState || gameState.phase === 'LOBBY') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameState]);

  useEffect(() => {
    const unsub1 = on('game-state', (state: ClientGameState) => {
      setGameState(state);
    });

    const unsub2 = on('player-joined', (data: any) => {
      showToast(`${data.playerName} ist beigetreten!`);
      void syncGameState();
    });

    const unsub3 = on('player-left', (data: any) => {
      showToast(`${data.playerName} hat das Spiel verlassen.`);
      void syncGameState();
    });

    const unsub4 = on('player-disconnected', (data: any) => {
      showToast(`${data.playerName} ist rausgeflogen. Das Spiel pausiert ${data.reconnectSeconds} Sekunden für den Reconnect.`);
      void syncGameState();
    });

    const unsub5 = on('player-reconnected', (data: any) => {
      showToast(`${data.playerName} ist wieder verbunden.`);
      void syncGameState();
    });

    const unsub6 = on('player-kicked', (data: any) => {
      showToast(`${data.playerName} wurde aus der Lobby entfernt.`);
      void syncGameState();
    });

    const unsub7 = on('players-auto-removed', (data: any) => {
      if (Array.isArray(data?.playerNames) && data.playerNames.length > 0) {
        showToast(`${data.playerNames.join(', ')} wurden wegen Inaktivität entfernt.`);
      }
      void syncGameState();
    });

    const unsub8 = on('players-removed-for-rematch', (data: any) => {
      if (Array.isArray(data?.playerNames) && data.playerNames.length > 0) {
        showToast(`${data.playerNames.join(', ')} waren offline und sind nicht in der Revanche dabei.`);
      }
      void syncGameState();
    });

    const unsub9 = on('phase-expired', (data: any) => {
      if (data?.phase === 'SUBMITTING') {
        showToast(
          data?.toPhase === 'ROUND_END'
            ? 'Die Antwortzeit ist abgelaufen. Ohne Einreichungen endet die Runde direkt.'
            : 'Die Antwortzeit ist abgelaufen. Es geht weiter mit dem Aufdecken.',
        );
      }

      if (data?.phase === 'REVEALING') {
        showToast('Die Aufdeckzeit ist abgelaufen. Alle Antworten wurden gezeigt.');
      }

      if (data?.phase === 'JUDGING') {
        showToast('Die Entscheidungszeit ist abgelaufen. Der Gewinner wurde automatisch gewählt.');
      }
    });

    const unsub10 = on('kicked', (data: any) => {
      clearStoredSession();
      setGameState(null);
      setIsRestoringSession(false);
      showError(data?.message || 'Du wurdest aus der Lobby entfernt.');
    });

    const unsub11 = on('game-aborted', (data: any) => {
      clearStoredSession();
      setGameState(null);
      setIsRestoringSession(false);
      showError(data?.message || 'Das Spiel wurde abgebrochen.');
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      unsub7();
      unsub8();
      unsub9();
      unsub10();
      unsub11();
    };
  }, [on, showError, showToast, syncGameState]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    let isCancelled = false;

    void emit('get-variants').then((response) => {
      if (isCancelled) {
        return;
      }

      if (Array.isArray(response)) {
        setAvailableVariants(response);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [emit, isConnected]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    if (!shouldAttemptSessionRestore()) {
      setIsRestoringSession(false);
      return;
    }

    const storedSession = loadStoredSession();
    if (!storedSession) {
      setIsRestoringSession(false);
      return;
    }

    let isCancelled = false;
    setIsRestoringSession(true);

    void emit('rejoin-game', storedSession).then((response) => {
      if (isCancelled) {
        return;
      }

      if (response?.error) {
        clearStoredSession();
        setGameState(null);
      } else if (response?.state) {
        setGameState(response.state);
      }

      setIsRestoringSession(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [emit, isConnected]);

  const createGame = useCallback(async (playerName: string, maxTrophies: TrophyTarget, variant: string, extensions: string[], password?: string) => {
    const response = await emit('create-game', { playerName, maxTrophies, variant, extensions, password });
    if (response.error) {
      showError(response.error);
      return null;
    }
    setGameState(response.state);
    saveStoredSession({
      gameCode: response.gameCode,
      playerId: response.playerId,
      playerName,
    });
    setIsRestoringSession(false);
    return response.gameCode;
  }, [emit, showError]);

  const joinGame = useCallback(async (gameCode: string, playerName: string, password?: string) => {
    const normalizedGameCode = gameCode.trim().toUpperCase();
    const normalizedPlayerName = playerName.trim();
    const response = await emit('join-game', { gameCode: normalizedGameCode, playerName: normalizedPlayerName, password });

    if (response.error) {
      const storedSession = loadStoredSession();
      const matchesStoredGame = storedSession?.gameCode?.toUpperCase() === normalizedGameCode;
      const matchesStoredName = !storedSession?.playerName
        || storedSession.playerName.toLowerCase() === normalizedPlayerName.toLowerCase();

      if (matchesStoredGame && matchesStoredName) {
        const rejoinResponse = await emit('rejoin-game', {
          gameCode: normalizedGameCode,
          playerId: storedSession.playerId,
        });

        if (!rejoinResponse?.error && rejoinResponse?.state) {
          setGameState(rejoinResponse.state);
          saveStoredSession({
            gameCode: rejoinResponse.gameCode,
            playerId: rejoinResponse.playerId,
            playerName: normalizedPlayerName,
          });
          setIsRestoringSession(false);
          return rejoinResponse.gameCode;
        }

        if (rejoinResponse?.error) {
          clearStoredSession();
          showError(rejoinResponse.error);
          return null;
        }
      }

      showError(response.error);
      return null;
    }

    if (response.error) {
      showError(response.error);
      return null;
    }
    setGameState(response.state);
    saveStoredSession({
      gameCode: response.gameCode,
      playerId: response.playerId,
      playerName: normalizedPlayerName,
    });
    setIsRestoringSession(false);
    return response.gameCode;
  }, [emit, showError]);

  const startGame = useCallback(async () => {
    const response = await emit('start-game');
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const rematch = useCallback(async () => {
    const response = await emit('rematch');
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const submitAnswer = useCallback(async (cardIds: string[]) => {
    const response = await emit('submit-answer', { cardIds });
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const swapCards = useCallback(async () => {
    const response = await emit('swap-cards');
    if (response.error) showError(response.error);
    else showToast('Karten getauscht! Du setzt diese Runde aus.');
  }, [emit, showError, showToast]);

  const revealSubmission = useCallback(async (index: number) => {
    const response = await emit('reveal-submission', index);
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const revealAll = useCallback(async () => {
    const response = await emit('reveal-all');
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const pickWinner = useCallback(async (playerId: string) => {
    const response = await emit('pick-winner', { playerId });
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const kickPlayer = useCallback(async (playerId: string) => {
    const response = await emit('kick-player', { playerId });
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const nextRound = useCallback(async () => {
    const response = await emit('next-round');
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const leaveGame = useCallback(async () => {
    if (gameState) {
      await emit('leave-game');
    }

    clearStoredSession();
    setGameState(null);
    setIsRestoringSession(false);
  }, [emit, gameState]);

  return (
    <GameContext.Provider value={{
      gameState,
      availableVariants,
      isConnected,
      isRestoringSession,
      error,
      toast,
      createGame,
      joinGame,
      startGame,
      rematch,
      submitAnswer,
      swapCards,
      revealSubmission,
      revealAll,
      pickWinner,
      kickPlayer,
      nextRound,
      leaveGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}
