import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { CardDeck } from '../src/game/CardDeck';
import { Card, Game, GamePhase, Player } from '../src/types';

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

describe('GameState match-stat reset', () => {
  it('resets match stats on rematch and starts the new game cleanly', () => {
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

    const firstGameStats = state.getClientState('p1').endGameStats;
    expect(firstGameStats?.players.find((player) => player.playerId === 'p2')?.submittedRounds).toBe(1);
    expect(firstGameStats?.players.find((player) => player.playerId === 'p2')?.longestWinStreak).toBe(1);
    expect(firstGameStats?.players.find((player) => player.playerId === 'p2')?.bossRounds).toBe(0);

    expect(state.rematch()).toEqual([]);
    expect(state.getClientState('p1').phase).toBe(GamePhase.SUBMITTING);
    expect(state.getClientState('p1').endGameStats).toBeNull();

    const rematchP2Card = state.getPlayer('p2')?.hand[0];
    const rematchP3Card = state.getPlayer('p3')?.hand[0];

    expect(rematchP2Card).toBeDefined();
    expect(rematchP3Card).toBeDefined();

    expect(state.submitAnswer('p2', [rematchP2Card!])).toBe(true);
    expect(state.submitAnswer('p3', [rematchP3Card!])).toBe(true);
    state.revealAllSubmissions();
    expect(state.pickWinner('p2')).toBe(true);

    const secondGameStats = state.getClientState('p1').endGameStats;
    expect(secondGameStats?.players.find((player) => player.playerId === 'p2')?.submittedRounds).toBe(1);
    expect(secondGameStats?.players.find((player) => player.playerId === 'p2')?.longestWinStreak).toBe(1);
    expect(secondGameStats?.players.find((player) => player.playerId === 'p2')?.currentWinStreak).toBe(1);
    expect(secondGameStats?.players.find((player) => player.playerId === 'p2')?.bossRounds).toBe(0);
  });
});
