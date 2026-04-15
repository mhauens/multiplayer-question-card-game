import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { CardDeck } from '../src/game/CardDeck';
import { Card, Game, GamePhase, Player } from '../src/types';
import { parseCommunityVoteCommand, shouldCountCommunityVoteFromSource } from '../src/twitch/communityVoting';

const questionCard: Card = {
  id: 'question-1',
  type: 'question',
  text: 'Die beste Antwort ist _____.',
  blanks: 1,
  extension: 'base',
};

const multiBlankQuestionCard: Card = {
  id: 'question-2',
  type: 'question',
  text: '_____ trifft _____ im Dorfkrug.',
  blanks: 2,
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
  [multiBlankQuestionCard.id, multiBlankQuestionCard],
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

function createState(questionId = questionCard.id): GameState {
  const game: Game = {
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
    questionDeck: [questionId],
    answerDeck: answerCards.map((card) => card.id),
    reconnectWindow: null,
    createdAt: Date.now(),
    passwordHash: null,
  };

  const deck: Pick<CardDeck, 'getCard' | 'createDecks'> = {
    getCard(id: string) {
      return cardMap.get(id);
    },
    createDecks(_variant: string, _extensions: string[]) {
      return {
        questionDeck: [questionId],
        answerDeck: answerCards.map((card) => card.id),
      };
    },
  };

  return new GameState(game, deck as unknown as CardDeck);
}

describe('community voting command parsing', () => {
  it('accepts valid !card commands within range', () => {
    expect(parseCommunityVoteCommand('!card 1', 3)).toBe(1);
    expect(parseCommunityVoteCommand(' !CARD 2 ', 3)).toBe(2);
    expect(parseCommunityVoteCommand('!card    3', 3)).toBe(3);
  });

  it('rejects invalid commands', () => {
    expect(parseCommunityVoteCommand('1', 3)).toBeNull();
    expect(parseCommunityVoteCommand('!vote 1', 3)).toBeNull();
    expect(parseCommunityVoteCommand('!card', 3)).toBeNull();
    expect(parseCommunityVoteCommand('!card x', 3)).toBeNull();
    expect(parseCommunityVoteCommand('!card 4', 3)).toBeNull();
  });

  it('counts only messages from the owning community in shared chat', () => {
    expect(shouldCountCommunityVoteFromSource(null, '123')).toBe(true);
    expect(shouldCountCommunityVoteFromSource('123', '123')).toBe(true);
    expect(shouldCountCommunityVoteFromSource('999', '123')).toBe(false);
  });
});

describe('GameState community voting state', () => {
  it('isolates submit-hand voting to the connected player', () => {
    const state = createState();
    state.startGame();

    state.setCommunityVotingConnection('p2', {
      channelId: 'channel-2',
      channelLogin: 'bert',
      channelDisplayName: 'BertTV',
    });

    const playerState = state.getClientState('p2');
    expect(playerState.communityVoting.enabled).toBe(true);
    expect(playerState.communityVoting.connection.channelLogin).toBe('bert');
    expect(playerState.communityVoting.context?.kind).toBe('SUBMIT_HAND');
    expect(playerState.communityVoting.context?.options).toHaveLength(playerState.myHand.length);

    const otherPlayerState = state.getClientState('p1');
    expect(otherPlayerState.communityVoting.context).toBeNull();
    expect(otherPlayerState.communityVoting.connection.status).toBe('disconnected');
  });

  it('keeps only the latest valid vote per chatter', () => {
    const state = createState();
    state.startGame();

    state.setCommunityVotingConnection('p2', {
      channelId: 'channel-2',
      channelLogin: 'bert',
      channelDisplayName: 'BertTV',
    });
    state.setCommunityVotingEnabled('p2', true);

    expect(state.recordCommunityVote('p2', 'viewer-1', 1)).toBe(true);
    expect(state.recordCommunityVote('p2', 'viewer-1', 2)).toBe(true);
    expect(state.recordCommunityVote('p2', 'viewer-2', 2)).toBe(true);

    const voteOptions = state.getClientState('p2').communityVoting.context?.options || [];
    expect(voteOptions[0].votes).toBe(0);
    expect(voteOptions[1].votes).toBe(2);
  });

  it('marks the top multi-blank recommendations without auto-submitting', () => {
    const state = createState(multiBlankQuestionCard.id);
    state.startGame();

    state.setCommunityVotingConnection('p2', {
      channelId: 'channel-2',
      channelLogin: 'bert',
      channelDisplayName: 'BertTV',
    });
    state.setCommunityVotingEnabled('p2', true);

    state.recordCommunityVote('p2', 'viewer-1', 1);
    state.recordCommunityVote('p2', 'viewer-2', 2);
    state.recordCommunityVote('p2', 'viewer-3', 2);
    state.recordCommunityVote('p2', 'viewer-4', 3);

    const options = state.getClientState('p2').communityVoting.context?.options || [];
    const recommended = options.filter((option) => option.isRecommended);
    expect(recommended).toHaveLength(2);
    expect(recommended.map((option) => option.voteNumber).sort((left, right) => left - right)).toEqual([1, 2]);
  });

  it('switches to boss judging votes only for the boss', () => {
    const state = createState();
    state.startGame();

    state.setCommunityVotingConnection('p1', {
      channelId: 'channel-1',
      channelLogin: 'anna',
      channelDisplayName: 'AnnaTV',
    });
    state.setCommunityVotingEnabled('p1', true);

    state.submitAnswer('p2', [state.getPlayer('p2')!.hand[0]]);
    state.submitAnswer('p3', [state.getPlayer('p3')!.hand[0]]);
    state.revealAllSubmissions();

    const bossState = state.getClientState('p1');
    expect(bossState.communityVoting.context?.kind).toBe('JUDGE_SUBMISSIONS');
    expect(bossState.communityVoting.context?.options).toHaveLength(2);

    const nonBossState = state.getClientState('p2');
    expect(nonBossState.communityVoting.context).toBeNull();
  });

  it('lets the same chatter vote for the same surviving card again in the next round', () => {
    const state = createState();
    state.game.questionDeck = [questionCard.id, questionCard.id];
    state.startGame();

    state.setCommunityVotingConnection('p3', {
      channelId: 'channel-3',
      channelLogin: 'chris',
      channelDisplayName: 'ChrisTV',
    });
    state.setCommunityVotingEnabled('p3', true);

    const playerTwo = state.getPlayer('p2');
    const playerThree = state.getPlayer('p3');
    expect(playerTwo).toBeDefined();
    expect(playerThree).toBeDefined();

    const carriedCardId = playerThree!.hand[1];

    expect(state.recordCommunityVote('p3', 'viewer-1', 2)).toBe(true);
    expect(state.submitAnswer('p2', [playerTwo!.hand[0]])).toBe(true);
    expect(state.submitAnswer('p3', [playerThree!.hand[0]])).toBe(true);

    state.revealAllSubmissions();
    expect(state.pickWinner('p3')).toBe(true);

    state.nextRound();

    expect(state.getPlayer('p3')?.hand[0]).toBe(carriedCardId);
    expect(state.recordCommunityVote('p3', 'viewer-1', 1)).toBe(true);

    const nextRoundContext = state.getClientState('p3').communityVoting.context;
    expect(nextRoundContext?.totalUniqueVoters).toBe(1);
    expect(nextRoundContext?.options[0].votes).toBe(1);
  });
});
