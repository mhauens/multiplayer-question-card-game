import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { type TrophyTarget } from '@kgs/game-rules';
import { CardCatalogOption, ClientGameState } from '../types';
import { useSocket } from '../hooks/useSocket';
import { applyVariantTheme } from '../theme';

const SESSION_STORAGE_KEY = 'kgds-session';

interface StoredSession {
  gameCode: string;
  playerId: string;
}

function loadStoredSession(): StoredSession | null {
  const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveStoredSession(session: StoredSession) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

interface GameContextType {
  gameState: ClientGameState | null;
  availableVariants: CardCatalogOption[];
  isConnected: boolean;
  isRestoringSession: boolean;
  error: string | null;
  toast: string | null;
  createGame: (playerName: string, maxTrophies: TrophyTarget, variant: string, extensions: string[]) => Promise<string | null>;
  joinGame: (gameCode: string, playerName: string) => Promise<string | null>;
  startGame: () => Promise<void>;
  submitAnswer: (cardIds: string[]) => Promise<void>;
  swapCards: () => Promise<void>;
  revealSubmission: (index: number) => Promise<void>;
  revealAll: () => Promise<void>;
  pickWinner: (playerId: string) => Promise<void>;
  nextRound: () => Promise<void>;
  leaveGame: () => void;
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
  const [isRestoringSession, setIsRestoringSession] = useState(() => loadStoredSession() !== null);
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
    const unsub1 = on('game-state', (state: ClientGameState) => {
      setGameState(state);
    });

    const unsub2 = on('player-joined', (data: any) => {
      showToast(`${data.playerName} ist beigetreten!`);
      void syncGameState();
    });

    const unsub3 = on('player-disconnected', (data: any) => {
      showToast(`${data.playerName} hat die Verbindung verloren.`);
      void syncGameState();
    });

    const unsub4 = on('player-reconnected', (data: any) => {
      showToast(`${data.playerName} ist wieder da!`);
      void syncGameState();
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [on, showToast, syncGameState]);

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

    const storedSession = loadStoredSession();
    if (!storedSession) {
      setIsRestoringSession(false);
      return;
    }

    let isCancelled = false;

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

  const createGame = useCallback(async (playerName: string, maxTrophies: TrophyTarget, variant: string, extensions: string[]) => {
    const response = await emit('create-game', { playerName, maxTrophies, variant, extensions });
    if (response.error) {
      showError(response.error);
      return null;
    }
    setGameState(response.state);
    saveStoredSession({
      gameCode: response.gameCode,
      playerId: response.playerId,
    });
    setIsRestoringSession(false);
    return response.gameCode;
  }, [emit, showError]);

  const joinGame = useCallback(async (gameCode: string, playerName: string) => {
    const response = await emit('join-game', { gameCode, playerName });
    if (response.error) {
      showError(response.error);
      return null;
    }
    setGameState(response.state);
    saveStoredSession({
      gameCode: response.gameCode,
      playerId: response.playerId,
    });
    setIsRestoringSession(false);
    return response.gameCode;
  }, [emit, showError]);

  const startGame = useCallback(async () => {
    const response = await emit('start-game');
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

  const nextRound = useCallback(async () => {
    const response = await emit('next-round');
    if (response.error) showError(response.error);
  }, [emit, showError]);

  const leaveGame = useCallback(() => {
    clearStoredSession();
    setGameState(null);
    setIsRestoringSession(false);
  }, []);

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
      submitAnswer,
      swapCards,
      revealSubmission,
      revealAll,
      pickWinner,
      nextRound,
      leaveGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}
