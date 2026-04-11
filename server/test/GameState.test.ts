import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { CardDeck } from '../src/game/CardDeck';
import { Card, Game, GamePhase, Player } from '../src/types';

const questionCard: Card = {
  id: 'question-1',
  type: 'question',
  text: 'Papa Wutz rettet das Meeting mit _____.',
  blanks: 1,
  extension: 'base',
};

const answerCards: Card[] = Array.from({ length: 30 }, (_, index) => ({
  id: `answer-${index + 1}`,
  type: 'answer',
  text: `Antwort ${index + 1}`,
  blanks: 0,
  extension: 'base',
}));

const cardMap = new Map<string, Card>([
  [questionCard.id, questionCard],
  ...answerCards.map((card) => [card.id, card]),
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
    maxTrophies: 3,
    phase: GamePhase.LOBBY,
    activeVariant: 'base',
    activeExtensions: [],
    questionDeck: [questionCard.id],
    answerDeck: answerCards.map((card) => card.id),
    createdAt: Date.now(),
  };
}

function createState(game = createGame()): GameState {
  const deck = {
    getCard(id: string) {
      return cardMap.get(id);
    },
  } as CardDeck;

  return new GameState(game, deck);
}

describe('GameState', () => {
  it('starts a game by dealing hands and opening the first round', () => {
    const state = createState();

    state.startGame();

    expect(state.game.phase).toBe(GamePhase.SUBMITTING);
    expect(state.game.currentRound).toBe(1);
    expect(state.getCurrentRound()?.bossId).toBe('p1');
    expect(state.game.players.every((player) => player.hand.length === 8)).toBe(true);
  });

  it('moves to revealing once all non-boss players have submitted', () => {
    const state = createState();
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    expect(secondPlayerCard).toBeDefined();
    expect(thirdPlayerCard).toBeDefined();
    expect(state.submitAnswer('p2', [secondPlayerCard!])).toBe(true);
    expect(state.game.phase).toBe(GamePhase.SUBMITTING);

    expect(state.submitAnswer('p3', [thirdPlayerCard!])).toBe(true);
    expect(state.game.phase).toBe(GamePhase.REVEALING);
    expect(state.getCurrentRound()?.phase).toBe(GamePhase.REVEALING);
  });

  it('hides submitter names until the round has been judged', () => {
    const state = createState();
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.revealAllSubmissions();

    const hiddenState = state.getClientState('p1');
    expect(hiddenState.submissions.every((submission) => submission.playerName === '???')).toBe(true);

    const winnerId = state.getCurrentRound()?.submissions[0].playerId;
    expect(winnerId).toBeDefined();

    state.pickWinner(winnerId!);

    const roundEndState = state.getClientState('p1');
    expect(roundEndState.phase).toBe(GamePhase.ROUND_END);
    expect(roundEndState.submissions.some((submission) => submission.playerName !== '???')).toBe(true);
  });
});