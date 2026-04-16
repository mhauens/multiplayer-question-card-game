import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { CardDeck } from '../src/game/CardDeck';
import { Card, Game, GamePhase, Player } from '../src/types';

const questionCards: Card[] = [
  {
    id: 'question-1',
    type: 'question',
    text: 'Die beste Antwort ist _____.',
    blanks: 1,
    extension: 'base',
  },
  {
    id: 'question-2',
    type: 'question',
    text: 'Der Boss mag _____.',
    blanks: 1,
    extension: 'base',
  },
];

const answerCards: Card[] = Array.from({ length: 40 }, (_, index) => ({
  id: `answer-${index + 1}`,
  type: 'answer',
  text: `Antwort ${index + 1}`,
  blanks: 0,
  extension: 'base',
}));

const cardMap = new Map<string, Card>([
  ...questionCards.map((card): [string, Card] => [card.id, card]),
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

function createGame(questionCount = 2, maxTrophies = 2): Game {
  return {
    code: 'ABCD',
    players: [
      createPlayer('p1', 'Anna', true),
      createPlayer('p2', 'Bert'),
      createPlayer('p3', 'Chris'),
    ],
    rounds: [],
    currentRound: 0,
    maxTrophies,
    phase: GamePhase.LOBBY,
    activeVariant: 'base',
    activeExtensions: [],
    questionDeck: Array.from({ length: questionCount }, (_, index) => questionCards[index % questionCards.length].id),
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
        questionDeck: questionCards.map((card) => card.id),
        answerDeck: answerCards.map((card) => card.id),
      };
    },
  } as CardDeck;

  return new GameState(game, deck);
}

function playRound(state: GameState, winnerId: string, swapPlayerId?: string): void {
  const round = state.getCurrentRound();
  expect(round).toBeDefined();

  const bossId = round?.bossId;
  expect(bossId).toBeDefined();

  for (const player of state.game.players) {
    if (player.id === bossId) {
      continue;
    }

    if (player.id === swapPlayerId) {
      expect(state.swapCards(player.id)).toBe(true);
      expect(state.swapCards(player.id)).toBe(false);
      const swappedCard = state.getPlayer(player.id)?.hand[0];
      expect(swappedCard).toBeDefined();
      expect(state.submitAnswer(player.id, [swappedCard!])).toBe(false);
      continue;
    }

    const submittedCard = state.getPlayer(player.id)?.hand[0];
    expect(submittedCard).toBeDefined();
    expect(state.submitAnswer(player.id, [submittedCard!])).toBe(true);
  }

  state.revealAllSubmissions();
  expect(state.pickWinner(winnerId)).toBe(true);
}

describe('GameState endgame stats', () => {
  it('keeps endgame stats hidden until GAME_OVER and counts successful actions only', () => {
    const state = createState(createGame(1, 1));
    state.startGame();

    expect(state.getClientState('p1').endGameStats).toBeNull();

    const firstRoundP2Card = state.getPlayer('p2')?.hand[0];

    expect(firstRoundP2Card).toBeDefined();
    expect(state.submitAnswer('p2', [firstRoundP2Card!, state.getPlayer('p2')!.hand[1]])).toBe(false);

    expect(state.swapCards('p3')).toBe(true);
    expect(state.swapCards('p3')).toBe(false);
    expect(state.submitAnswer('p3', [state.getPlayer('p3')!.hand[0]])).toBe(false);
    expect(state.submitAnswer('p2', [firstRoundP2Card!])).toBe(true);

    state.revealAllSubmissions();
    expect(state.pickWinner('p2')).toBe(true);

    const endGameState = state.getClientState('p1');
    expect(endGameState.phase).toBe(GamePhase.GAME_OVER);
    expect(endGameState.endGameStats).not.toBeNull();
    expect(endGameState.endGameStats?.totalRounds).toBe(1);
    expect(endGameState.endGameStats?.players.map((player) => player.playerId)).toEqual(['p2', 'p1', 'p3']);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p1')?.bossRounds).toBe(1);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p2')?.bossRounds).toBe(0);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p2')?.submittedRounds).toBe(1);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p3')?.submittedRounds).toBe(0);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p3')?.swappedRounds).toBe(1);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p2')?.currentWinStreak).toBe(1);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p2')?.longestWinStreak).toBe(1);
    expect(endGameState.endGameStats?.players.find((player) => player.playerId === 'p3')?.currentWinStreak).toBe(0);
  });

  it('groups tied leaders and hides zero-value highlight categories', () => {
    const state = createState(createGame(3, 2));
    state.startGame();

    playRound(state, 'p2');
    state.nextRound();
    playRound(state, 'p3');
    state.nextRound();
    playRound(state, 'p2');

    const endGameStats = state.getClientState('p1').endGameStats;
    expect(endGameStats).not.toBeNull();
    expect(endGameStats?.highlights.find((highlight) => highlight.key === 'longest-win-streak')?.value).toBe(1);
    expect(endGameStats?.highlights.find((highlight) => highlight.key === 'longest-win-streak')?.leaders.map((leader) => leader.playerId)).toEqual(['p2', 'p3']);
    expect(endGameStats?.highlights.some((highlight) => highlight.key === 'most-swapped-rounds')).toBe(false);
  });
});
