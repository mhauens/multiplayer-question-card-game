import { MAX_INACTIVE_ROUNDS } from '@kgs/game-rules';
import { describe, expect, it, vi } from 'vitest';
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

const answerCards: Card[] = Array.from({ length: 40 }, (_, index) => ({
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
    maxTrophies: 3,
    phase: GamePhase.LOBBY,
    activeVariant: 'base',
    activeExtensions: [],
    questionDeck: [questionCard.id],
    answerDeck: answerCards.map((card) => card.id),
    reconnectWindow: null,
    createdAt: Date.now(),
  };
}

function createState(game = createGame()): GameState {
  const deck = {
    getCard(id: string) {
      return cardMap.get(id);
    },
    createDecks() {
      return {
        questionDeck: [questionCard.id, questionCard.id, questionCard.id, questionCard.id],
        answerDeck: answerCards.map((card) => card.id),
      };
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
    expect(state.getCurrentRound()?.phaseDeadline).not.toBeNull();
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
    expect(roundEndState.lastRoundWinnerId).toBe(winnerId);
    expect(roundEndState.lastRoundWinnerName).toBe(state.getPlayer(winnerId!)?.name);
  });

  it('keeps the last round winner visible after the next round starts', () => {
    const game = createGame();
    game.questionDeck = [questionCard.id, questionCard.id];

    const state = createState(game);
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.revealAllSubmissions();
    state.pickWinner('p2');

    const roundEndState = state.getClientState('p1');
    expect(roundEndState.lastRoundWinnerId).toBe('p2');
    expect(roundEndState.lastRoundWinnerName).toBe('Bert');

    state.nextRound();

    const nextRoundState = state.getClientState('p1');
    expect(nextRoundState.phase).toBe(GamePhase.SUBMITTING);
    expect(nextRoundState.winnerId).toBeNull();
    expect(nextRoundState.lastRoundWinnerId).toBe('p2');
    expect(nextRoundState.lastRoundWinnerName).toBe('Bert');
  });

  it('reports the actual game winner for the game-over popup', () => {
    const game = createGame();
    game.players[0].trophies = 2;
    game.players[1].trophies = 1;
    game.players[2].trophies = 0;

    const state = createState(game);
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.revealAllSubmissions();
    state.pickWinner('p2');
    state.nextRound();

    const gameOverState = state.getClientState('p1');
    expect(gameOverState.phase).toBe(GamePhase.GAME_OVER);
    expect(gameOverState.lastRoundWinnerId).toBe('p2');
    expect(gameOverState.gameWinnerId).toBe('p1');
    expect(gameOverState.gameWinnerName).toBe('Anna');
  });

  it('keeps the chosen winner visible after that player leaves during round end', () => {
    const state = createState();
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.revealAllSubmissions();
    state.pickWinner('p2');

    state.removePlayer('p2');

    const roundEndState = state.getClientState('p1');
    expect(roundEndState.winnerId).toBe('p2');
    expect(roundEndState.winnerName).toBe('Bert');
    expect(roundEndState.lastRoundWinnerName).toBe('Bert');
  });

  it('hands round-end boss rights to the next connected player when the current boss leaves', () => {
    const game = createGame();
    game.players.push(createPlayer('p4', 'Dana'));

    const state = createState(game);
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];
    const fourthPlayerCard = state.getPlayer('p4')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.submitAnswer('p4', [fourthPlayerCard!]);
    state.revealAllSubmissions();
    state.pickWinner('p2');

    state.removePlayer('p1');

    expect(state.game.phase).toBe(GamePhase.ROUND_END);
    expect(state.getCurrentRound()?.bossId).toBe('p2');
    expect(state.game.players.map((player) => player.id)).toEqual(['p2', 'p3', 'p4']);
  });

  it('keeps boss rotation on the next connected seat when the current boss leaves mid-round', () => {
    const game = createGame();
    game.players.push(createPlayer('p4', 'Dana'));
    game.questionDeck = [questionCard.id, questionCard.id, questionCard.id];

    const state = createState(game);
    state.startGame();

    state.submitAnswer('p2', [state.getPlayer('p2')!.hand[0]]);
    state.submitAnswer('p3', [state.getPlayer('p3')!.hand[0]]);
    state.submitAnswer('p4', [state.getPlayer('p4')!.hand[0]]);
    state.revealAllSubmissions();
    state.pickWinner('p3');
    state.nextRound();

    expect(state.getCurrentRound()?.bossId).toBe('p2');

    state.removePlayer('p2');

    expect(state.game.phase).toBe(GamePhase.SUBMITTING);
    expect(state.game.currentRound).toBe(3);
    expect(state.getCurrentRound()?.bossId).toBe('p3');
  });

  it('pauses the round for a disconnect and resumes the timer after reconnect', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const state = createState();
    state.startGame();

    const originalDeadline = state.getCurrentRound()?.phaseDeadline;
    const originalRemainingMs = originalDeadline! - Date.now();

    expect(state.startReconnectWindow('p2')).toBe(true);
    expect(state.getPlayer('p2')?.isConnected).toBe(false);
    expect(state.getCurrentRound()?.phaseDeadline).toBeNull();
    expect(state.getClientState('p1').reconnectWindow?.players.map((player) => player.playerId)).toEqual(['p2']);

    vi.mocked(Date.now).mockReturnValue(5_000);
    expect(state.resumeAfterReconnect('p2')).toBe(true);
    expect(state.getPlayer('p2')?.isConnected).toBe(true);
    expect(state.getCurrentRound()?.phaseDeadline).not.toBeNull();
    expect(state.getCurrentRound()!.phaseDeadline!).toBe(Date.now() + originalRemainingMs);
    expect(state.getClientState('p1').reconnectWindow).toBeNull();

    vi.restoreAllMocks();
  });

  it('freezes community-voting tallies while the reconnect pause is active', () => {
    const state = createState();
    state.startGame();

    state.setCommunityVotingConnection('p2', {
      channelId: 'channel-2',
      channelLogin: 'bert',
      channelDisplayName: 'BertTV',
    });
    state.setCommunityVotingEnabled('p2', true);

    expect(state.recordCommunityVote('p2', 'viewer-1', 1)).toBe(true);
    expect(state.getClientState('p2').communityVoting.context?.options[0].votes).toBe(1);

    expect(state.startReconnectWindow('p3')).toBe(true);
    expect(state.recordCommunityVote('p2', 'viewer-2', 2)).toBe(false);

    const options = state.getClientState('p2').communityVoting.context?.options || [];
    expect(options[0].votes).toBe(1);
    expect(options[1].votes).toBe(0);
  });

  it('does not open a reconnect window while the game is still in the lobby', () => {
    const state = createState();

    expect(state.game.phase).toBe(GamePhase.LOBBY);
    expect(state.startReconnectWindow('p2')).toBe(false);
    expect(state.getPlayer('p2')?.isConnected).toBe(true);
    expect(state.getReconnectWindow()).toBeNull();
  });

  it('does not open a reconnect window after the game is already over', () => {
    const state = createState();
    state.game.phase = GamePhase.GAME_OVER;

    expect(state.startReconnectWindow('p2')).toBe(false);
    expect(state.getPlayer('p2')?.isConnected).toBe(true);
    expect(state.getReconnectWindow()).toBeNull();
  });

  it('keeps all disconnected players inside the same reconnect pause', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const state = createState();
    state.startGame();

    expect(state.startReconnectWindow('p2')).toBe(true);
    expect(state.getReconnectWindow()?.players.map((player) => player.playerId)).toEqual(['p2']);
    expect(state.getReconnectWindow()?.deadline).toBe(31_000);

    vi.mocked(Date.now).mockReturnValue(10_000);
    expect(state.startReconnectWindow('p3')).toBe(true);
    expect(state.getReconnectWindow()?.players.map((player) => player.playerId)).toEqual(['p2', 'p3']);
    expect(state.getReconnectWindow()?.deadline).toBe(40_000);

    expect(state.resumeAfterReconnect('p2')).toBe(true);
    expect(state.getReconnectWindow()?.players.map((player) => player.playerId)).toEqual(['p3']);
    expect(state.getCurrentRound()?.phaseDeadline).toBeNull();

    vi.restoreAllMocks();
  });

  it('removes a disconnected player after the reconnect window expires and continues the round', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const state = createState();
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    expect(state.submitAnswer('p2', [secondPlayerCard!])).toBe(true);

    expect(state.startReconnectWindow('p3')).toBe(true);
    expect(state.game.phase).toBe(GamePhase.SUBMITTING);
    expect(state.getCurrentRound()?.phaseDeadline).toBeNull();

    vi.mocked(Date.now).mockReturnValue(31_000);
    expect(state.expireReconnectWindow()).toEqual([{ playerId: 'p3', playerName: 'Chris' }]);
    expect(state.getPlayer('p3')).toBeUndefined();
    expect(state.game.phase).toBe(GamePhase.REVEALING);

    vi.restoreAllMocks();
  });

  it('flags a running game as abort-worthy when reconnect timeout leaves fewer than three players', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const state = createState();
    state.startGame();

    expect(state.startReconnectWindow('p3')).toBe(true);

    vi.mocked(Date.now).mockReturnValue(31_000);
    expect(state.expireReconnectWindow()).toEqual([{ playerId: 'p3', playerName: 'Chris' }]);
    expect(state.game.players).toHaveLength(2);
    expect(state.shouldAbortForTooFewPlayers()).toBe(true);

    vi.restoreAllMocks();
  });

  it('clears the previous winner when the latest finished round has no winner', () => {
    const game = createGame();
    game.questionDeck = [questionCard.id, questionCard.id];

    const state = createState(game);
    state.startGame();

    const secondPlayerCard = state.getPlayer('p2')?.hand[0];
    const thirdPlayerCard = state.getPlayer('p3')?.hand[0];

    state.submitAnswer('p2', [secondPlayerCard!]);
    state.submitAnswer('p3', [thirdPlayerCard!]);
    state.revealAllSubmissions();
    state.pickWinner('p2');
    state.nextRound();

    const timeoutResult = state.expireCurrentPhase();
    expect(timeoutResult.expiredPhase).toBe(GamePhase.SUBMITTING);

    const roundEndState = state.getClientState('p1');
    expect(roundEndState.phase).toBe(GamePhase.ROUND_END);
    expect(roundEndState.winnerId).toBeNull();
    expect(roundEndState.lastRoundWinnerId).toBeNull();
    expect(roundEndState.lastRoundWinnerName).toBeNull();
  });

  it('ends the round immediately when submit time expires without submissions', () => {
    const state = createState();
    state.startGame();

    const result = state.expireCurrentPhase();

    expect(result.expiredPhase).toBe(GamePhase.SUBMITTING);
    expect(state.game.phase).toBe(GamePhase.ROUND_END);
    expect(state.getCurrentRound()?.phase).toBe(GamePhase.ROUND_END);
    expect(state.getCurrentRound()?.phaseDeadline).toBeNull();
  });

  it('removes inactive players after repeated next rounds', () => {
    const game = createGame();
    game.players.push(createPlayer('p4', 'Dana'));
    game.questionDeck = [questionCard.id, questionCard.id, questionCard.id, questionCard.id, questionCard.id];

    const state = createState(game);
    state.startGame();

    const inactivePlayer = state.getPlayer('p4');
    expect(inactivePlayer).toBeDefined();
    inactivePlayer!.isConnected = false;

    for (let round = 0; round < MAX_INACTIVE_ROUNDS; round += 1) {
      state.game.phase = GamePhase.ROUND_END;
      if (state.getCurrentRound()) {
        state.getCurrentRound()!.phase = GamePhase.ROUND_END;
      }
      state.nextRound();
    }

    expect(state.getPlayer('p4')).toBeUndefined();
  });

  it('resets the game on rematch and keeps only connected players', () => {
    const game = createGame();
    game.players.push(createPlayer('p4', 'Dana'));
    game.players[1].trophies = 2;
    game.players[2].trophies = 1;
    game.players[3].isConnected = false;

    const state = createState(game);
    state.game.phase = GamePhase.GAME_OVER;

    const removedPlayers = state.rematch();

    expect(removedPlayers).toEqual(['Dana']);
    expect(state.game.players).toHaveLength(3);
    expect(state.game.players.every((player) => player.trophies === 0)).toBe(true);
    expect(state.game.players.every((player) => player.hand.length === 8)).toBe(true);
    expect(state.game.phase).toBe(GamePhase.SUBMITTING);
    expect(state.game.currentRound).toBe(1);
  });
});
