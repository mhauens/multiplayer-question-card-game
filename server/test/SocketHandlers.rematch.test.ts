import { describe, expect, it, vi } from 'vitest';
import { registerSocketHandlers } from '../src/socket/handlers';
import { Card, Game, GamePhase, Player } from '../src/types';
import { CardDeck } from '../src/game/CardDeck';
import { GameState } from '../src/game/GameState';

type Handler = (...args: any[]) => void;

function createSocketStub() {
  const handlers = new Map<string, Handler>();
  const roomEmitter = { emit: vi.fn() };

  return {
    id: 'socket-1',
    handlers,
    roomEmitter,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    to: vi.fn(() => roomEmitter),
  };
}

const questionCard: Card = {
  id: 'question-1',
  type: 'question',
  text: 'Die beste Antwort ist _____.',
  blanks: 1,
  extension: 'base',
};

const answerCards: Card[] = Array.from({ length: 20 }, (_, index) => ({
  id: `answer-${index + 1}`,
  type: 'answer',
  text: `Antwort ${index + 1}`,
  blanks: 0,
  extension: 'base',
}));

const cardMap = new Map<string, Card>([
  [questionCard.id, questionCard],
  ...answerCards.map((card): [string, Card] => [card.id, card]),
]);

function createPlayer(id: string, name: string, isHost = false): Player {
  return {
    id,
    name,
    socketId: `${id}-socket`,
    hand: [],
    trophies: 0,
    isConnected: true,
    isHost,
    swappedThisRound: false,
    inactiveRounds: 0,
  };
}

function createGame(): Game {
  return {
    code: 'ABCD',
    players: [
      createPlayer('p1', 'Anna', true),
      createPlayer('p2', 'Bert'),
      createPlayer('p3', 'Chris'),
    ],
    rounds: [],
    currentRound: 0,
    maxTrophies: 1,
    phase: GamePhase.LOBBY,
    activeVariant: 'base',
    activeExtensions: [],
    questionDeck: [questionCard.id],
    answerDeck: answerCards.map((card) => card.id),
    reconnectWindow: null,
    createdAt: Date.now(),
    passwordHash: null,
  };
}

function createState(game = createGame()): GameState {
  const deck = {
    getCard(id: string) {
      return cardMap.get(id);
    },
    createDecks() {
      return {
        questionDeck: [questionCard.id],
        answerDeck: answerCards.map((card) => card.id),
      };
    },
  } as CardDeck;

  return new GameState(game, deck);
}

describe('registerSocketHandlers rematch broadcast', () => {
  it('broadcasts a fresh game-state snapshot after rematch', () => {
    const state = createState();
    state.startGame();

    const p2Card = state.getPlayer('p2')?.hand[0];
    const p3Card = state.getPlayer('p3')?.hand[0];

    expect(p2Card).toBeDefined();
    expect(p3Card).toBeDefined();

    expect(state.submitAnswer('p2', [p2Card!])).toBe(true);
    expect(state.submitAnswer('p3', [p3Card!])).toBe(true);
    state.revealAllSubmissions();
    expect(state.pickWinner('p2')).toBe(true);

    const socket = createSocketStub();
    const io = {
      on: vi.fn(),
      to: vi.fn(() => socket.roomEmitter),
      sockets: { sockets: new Map() },
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        gameState: state,
        player: state.getPlayer('p1'),
      })),
    };
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    const connectionHandler = io.on.mock.calls[0]?.[1] as Handler;
    connectionHandler?.(socket);

    const rematchHandler = socket.handlers.get('rematch');
    expect(rematchHandler).toBeDefined();

    rematchHandler?.(ack);

    expect(ack).toHaveBeenCalledWith({ success: true });

    const gameStateEvents = socket.roomEmitter.emit.mock.calls.filter(([event]) => event === 'game-state');
    expect(gameStateEvents.length).toBeGreaterThan(0);
    expect(gameStateEvents.some(([, snapshot]) => snapshot.phase === GamePhase.SUBMITTING)).toBe(true);
    expect(gameStateEvents.some(([, snapshot]) => snapshot.endGameStats === null)).toBe(true);
  });
});
