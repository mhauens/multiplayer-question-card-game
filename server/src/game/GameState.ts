import {
  BOSS_PHASE_TIMER_SECONDS,
  buildCommunityVoteCommand,
  type CommunityVotingConnectionStatus,
  type CommunityVotingContextKind,
  HAND_SIZE,
  MAX_INACTIVE_ROUNDS,
  MIN_PLAYERS_TO_START,
  RECONNECT_GRACE_SECONDS,
  SUBMIT_TIMER_SECONDS,
} from '@kgs/game-rules';
import {
  Game,
  GamePhase,
  Player,
  Round,
  RoundRecapEntry,
  ClientGameState,
  ClientPlayer,
  ClientSubmission,
  ClientCommunityVotingState,
  ExpiredReconnectPlayer,
  ReconnectWindowPlayer,
} from '../types';
import { CardDeck } from './CardDeck';

interface ServerCommunityVotingConnectionState {
  status: CommunityVotingConnectionStatus;
  channelId: string | null;
  channelLogin: string | null;
  channelDisplayName: string | null;
  sharedChatActive: boolean;
  lastError: string | null;
}

interface ServerCommunityVotingState {
  enabled: boolean;
  privacyWarningAcknowledgedForSession: boolean;
  connection: ServerCommunityVotingConnectionState;
  activeContextKey: string | null;
  votesByChatterId: Map<string, string>;
  votesByTargetId: Map<string, number>;
}

interface CommunityVotingContextRuntime {
  key: string;
  kind: CommunityVotingContextKind;
  roundNumber: number;
  recommendedCount: number;
  optionTargetIds: string[];
}

export class GameState {
  game: Game;
  private cardDeck: CardDeck;
  private communityVotingByPlayerId = new Map<string, ServerCommunityVotingState>();

  constructor(game: Game, cardDeck: CardDeck) {
    this.game = game;
    this.cardDeck = cardDeck;
  }

  addPlayer(player: Player): void {
    this.game.players.push(player);
  }

  getReconnectWindow() {
    return this.game.reconnectWindow;
  }

  isReconnectPaused(): boolean {
    return this.game.reconnectWindow !== null;
  }

  private getReconnectWindowPlayer(playerId: string): ReconnectWindowPlayer | undefined {
    return this.game.reconnectWindow?.players.find((player) => player.playerId === playerId);
  }

  shouldAbortForTooFewPlayers(pausedPhase: GamePhase = this.game.phase): boolean {
    return pausedPhase !== GamePhase.LOBBY
      && pausedPhase !== GamePhase.GAME_OVER
      && this.game.players.length < MIN_PLAYERS_TO_START;
  }

  startReconnectWindow(playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (
      !player
      || !player.isConnected
      || this.game.phase === GamePhase.LOBBY
      || this.game.phase === GamePhase.GAME_OVER
    ) {
      return false;
    }

    player.isConnected = false;
    player.socketId = null;

    const reconnectPlayer = {
      playerId: player.id,
      playerName: player.name,
    };

    if (this.game.reconnectWindow) {
      this.game.reconnectWindow.players.push(reconnectPlayer);
      this.game.reconnectWindow.deadline = Math.max(
        this.game.reconnectWindow.deadline,
        Date.now() + (RECONNECT_GRACE_SECONDS * 1000),
      );
      return true;
    }

    const round = this.getCurrentRound();
    const remainingPhaseMs = round?.phaseDeadline
      ? Math.max(0, round.phaseDeadline - Date.now())
      : null;

    if (round) {
      round.phaseDeadline = null;
    }

    this.game.reconnectWindow = {
      players: [reconnectPlayer],
      deadline: Date.now() + (RECONNECT_GRACE_SECONDS * 1000),
      pausedPhase: this.game.phase,
      remainingPhaseMs,
    };

    return true;
  }

  resumeAfterReconnect(playerId: string): boolean {
    const reconnectWindow = this.game.reconnectWindow;
    const player = this.getPlayer(playerId);

    if (!reconnectWindow || !this.getReconnectWindowPlayer(playerId) || !player) {
      return false;
    }

    player.isConnected = true;
    player.inactiveRounds = 0;
    reconnectWindow.players = reconnectWindow.players.filter(
      (reconnectPlayer) => reconnectPlayer.playerId !== playerId,
    );

    if (reconnectWindow.players.length === 0) {
      this.restorePausedDeadline(reconnectWindow.remainingPhaseMs);
      this.game.reconnectWindow = null;
    }

    return true;
  }

  expireReconnectWindow(): ExpiredReconnectPlayer[] {
    const reconnectWindow = this.game.reconnectWindow;
    if (!reconnectWindow) {
      return [];
    }

    const expiredPlayers = [...reconnectWindow.players];
    this.restorePausedDeadline(reconnectWindow.remainingPhaseMs);
    this.game.reconnectWindow = null;

    const currentBossId = this.getCurrentRound()?.bossId;
    const expiredBoss = expiredPlayers.find((player) => player.playerId === currentBossId);
    const expiredNonBossPlayers = expiredPlayers.filter((player) => player.playerId !== currentBossId);

    for (const reconnectPlayer of expiredNonBossPlayers) {
      this.removePlayer(reconnectPlayer.playerId);
    }

    if (expiredBoss) {
      this.removePlayer(expiredBoss.playerId);
    }

    return expiredPlayers.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
    }));
  }

  removePlayer(playerId: string): void {
    const playerIndex = this.game.players.findIndex((currentPlayer) => currentPlayer.id === playerId);
    if (playerIndex < 0) return;

    this.clearCommunityVoting(playerId);

    const player = this.game.players[playerIndex];
    const currentRound = this.getCurrentRound();
    const wasBoss = currentRound?.bossId === playerId;

    // Return cards to answer deck
    this.game.answerDeck.push(...player.hand);
    player.hand = [];

    if (currentRound && this.game.phase !== GamePhase.ROUND_END && this.game.phase !== GamePhase.GAME_OVER) {
      currentRound.submissions = currentRound.submissions.filter((submission) => submission.playerId !== playerId);
    }

    this.game.players = this.game.players.filter(p => p.id !== playerId);

    if (player.isHost && this.game.players.length > 0) {
      this.game.players[0].isHost = true;
    }

    if (!currentRound || this.game.players.length === 0) {
      return;
    }

    if (this.game.players.length === 1 && this.game.phase !== GamePhase.LOBBY) {
      this.endCurrentRoundAsGameOver();
      return;
    }

    if (wasBoss && this.game.phase !== GamePhase.LOBBY && this.game.phase !== GamePhase.GAME_OVER) {
      this.handleBossRemoval(playerIndex);
      return;
    }

    this.reconcileAfterPlayerRemoval();
  }

  getPlayer(playerId: string): Player | undefined {
    return this.game.players.find(p => p.id === playerId);
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    return this.game.players.find(p => p.socketId === socketId);
  }

  getConnectedPlayerCount(): number {
    return this.game.players.filter(p => p.isConnected).length;
  }

  getCurrentRound(): Round | undefined {
    return this.game.rounds[this.game.currentRound - 1];
  }

  getBoss(): Player | undefined {
    const round = this.getCurrentRound();
    if (!round) return undefined;
    return this.getPlayer(round.bossId);
  }

  private getDefaultCommunityVotingConnection(): ServerCommunityVotingConnectionState {
    return {
      status: 'disconnected',
      channelId: null,
      channelLogin: null,
      channelDisplayName: null,
      sharedChatActive: false,
      lastError: null,
    };
  }

  private getOrCreateCommunityVotingState(playerId: string): ServerCommunityVotingState {
    const existingState = this.communityVotingByPlayerId.get(playerId);
    if (existingState) {
      return existingState;
    }

    const nextState: ServerCommunityVotingState = {
      enabled: false,
      privacyWarningAcknowledgedForSession: false,
      connection: this.getDefaultCommunityVotingConnection(),
      activeContextKey: null,
      votesByChatterId: new Map(),
      votesByTargetId: new Map(),
    };

    this.communityVotingByPlayerId.set(playerId, nextState);
    return nextState;
  }

  private resetCommunityVotingContext(state: ServerCommunityVotingState, nextContextKey: string | null): void {
    state.activeContextKey = nextContextKey;
    state.votesByChatterId.clear();
    state.votesByTargetId.clear();
  }

  private getRecommendedTargetIds(
    runtime: CommunityVotingContextRuntime,
    voteCountsByTargetId: Map<string, number>,
  ): Set<string> {
    const rankedTargets = runtime.optionTargetIds
      .map((targetId, index) => ({
        targetId,
        votes: voteCountsByTargetId.get(targetId) || 0,
        voteNumber: index + 1,
      }))
      .filter((option) => option.votes > 0)
      .sort((left, right) => right.votes - left.votes || left.voteNumber - right.voteNumber);

    return new Set(
      rankedTargets
        .slice(0, runtime.recommendedCount)
        .map((option) => option.targetId),
    );
  }

  private getCommunityVotingContextRuntime(playerId: string): CommunityVotingContextRuntime | null {
    const player = this.getPlayer(playerId);
    const round = this.getCurrentRound();
    if (!player || !round) {
      return null;
    }

    const questionCard = this.cardDeck.getCard(round.questionCardId);
    const hasSubmitted = round.submissions.some((submission) => submission.playerId === playerId);

    if (
      this.game.phase === GamePhase.SUBMITTING
      && round.bossId !== playerId
      && player.isConnected
      && !player.swappedThisRound
      && !hasSubmitted
      && player.hand.length > 0
    ) {
      return {
        key: `SUBMIT_HAND:${round.roundNumber}:${player.hand.join('|')}`,
        kind: 'SUBMIT_HAND',
        roundNumber: round.roundNumber,
        recommendedCount: Math.max(1, questionCard?.blanks || 1),
        optionTargetIds: [...player.hand],
      };
    }

    if (
      this.game.phase === GamePhase.JUDGING
      && round.bossId === playerId
      && round.submissions.length > 0
    ) {
      return {
        key: `JUDGE_SUBMISSIONS:${round.roundNumber}:${round.submissions.map((submission) => submission.playerId).join('|')}`,
        kind: 'JUDGE_SUBMISSIONS',
        roundNumber: round.roundNumber,
        recommendedCount: 1,
        optionTargetIds: round.submissions.map((submission) => submission.playerId),
      };
    }

    return null;
  }

  private syncCommunityVotingContext(playerId: string): {
    state: ServerCommunityVotingState;
    runtime: CommunityVotingContextRuntime | null;
  } {
    const state = this.getOrCreateCommunityVotingState(playerId);
    const runtime = this.getCommunityVotingContextRuntime(playerId);
    const nextContextKey = runtime?.key || null;

    if (state.activeContextKey !== nextContextKey) {
      this.resetCommunityVotingContext(state, nextContextKey);
    }

    return { state, runtime };
  }

  setCommunityVotingConnection(
    playerId: string,
    connection: {
      channelId: string;
      channelLogin: string;
      channelDisplayName: string;
    },
  ): void {
    const state = this.getOrCreateCommunityVotingState(playerId);
    state.enabled = true;
    state.connection = {
      status: 'connected',
      channelId: connection.channelId,
      channelLogin: connection.channelLogin,
      channelDisplayName: connection.channelDisplayName,
      sharedChatActive: false,
      lastError: null,
    };
    this.resetCommunityVotingContext(state, null);
  }

  setCommunityVotingSharedChatActive(playerId: string, sharedChatActive: boolean): void {
    const state = this.getOrCreateCommunityVotingState(playerId);
    state.connection.sharedChatActive = sharedChatActive;
  }

  setCommunityVotingError(playerId: string, message: string): void {
    const state = this.getOrCreateCommunityVotingState(playerId);
    state.connection = {
      ...state.connection,
      status: 'error',
      sharedChatActive: false,
      lastError: message,
    };
    state.enabled = false;
    this.resetCommunityVotingContext(state, null);
  }

  clearCommunityVoting(playerId: string): void {
    this.communityVotingByPlayerId.delete(playerId);
  }

  getCommunityVotingChannelId(playerId: string): string | null {
    return this.communityVotingByPlayerId.get(playerId)?.connection.channelId || null;
  }

  setCommunityVotingEnabled(playerId: string, enabled: boolean): boolean {
    const state = this.getOrCreateCommunityVotingState(playerId);
    if (state.connection.status !== 'connected') {
      return false;
    }

    state.enabled = enabled;
    if (!enabled) {
      this.resetCommunityVotingContext(state, null);
    } else {
      this.syncCommunityVotingContext(playerId);
    }

    return true;
  }

  recordCommunityVote(playerId: string, chatterId: string, voteNumber: number): boolean {
    if (this.isReconnectPaused()) {
      return false;
    }

    const { state, runtime } = this.syncCommunityVotingContext(playerId);
    if (!runtime || !state.enabled || state.connection.status !== 'connected') {
      return false;
    }

    const targetId = runtime.optionTargetIds[voteNumber - 1];
    if (!targetId) {
      return false;
    }

    const previousTargetId = state.votesByChatterId.get(chatterId);
    if (previousTargetId === targetId) {
      return false;
    }

    if (previousTargetId) {
      const previousCount = state.votesByTargetId.get(previousTargetId) || 0;
      if (previousCount <= 1) {
        state.votesByTargetId.delete(previousTargetId);
      } else {
        state.votesByTargetId.set(previousTargetId, previousCount - 1);
      }
    }

    state.votesByChatterId.set(chatterId, targetId);
    state.votesByTargetId.set(targetId, (state.votesByTargetId.get(targetId) || 0) + 1);
    return true;
  }

  getClientCommunityVotingState(forPlayerId: string): ClientCommunityVotingState {
    const { state, runtime } = this.syncCommunityVotingContext(forPlayerId);
    const connection = state.connection;

    if (!runtime || !state.enabled || connection.status !== 'connected') {
      return {
        enabled: state.enabled,
        privacyWarningAcknowledgedForSession: state.privacyWarningAcknowledgedForSession,
        connection: {
          status: connection.status,
          channelLogin: connection.channelLogin,
          channelDisplayName: connection.channelDisplayName,
          sharedChatActive: connection.sharedChatActive,
          lastError: connection.lastError,
        },
        context: null,
      };
    }

    const optionsWithVotes = runtime.optionTargetIds.map((targetId, index) => ({
      targetId,
      voteNumber: index + 1,
      votes: state.votesByTargetId.get(targetId) || 0,
    }));
    const highestVoteCount = optionsWithVotes.reduce((highest, option) => Math.max(highest, option.votes), 0);
    const recommendedTargetIds = this.getRecommendedTargetIds(runtime, state.votesByTargetId);

    return {
      enabled: state.enabled,
      privacyWarningAcknowledgedForSession: state.privacyWarningAcknowledgedForSession,
      connection: {
        status: connection.status,
        channelLogin: connection.channelLogin,
        channelDisplayName: connection.channelDisplayName,
        sharedChatActive: connection.sharedChatActive,
        lastError: connection.lastError,
      },
      context: {
        kind: runtime.kind,
        roundNumber: runtime.roundNumber,
        totalUniqueVoters: state.votesByChatterId.size,
        options: optionsWithVotes.map((option) => ({
          targetId: option.targetId,
          voteNumber: option.voteNumber,
          voteCommand: buildCommunityVoteCommand(option.voteNumber),
          votes: option.votes,
          isLeading: highestVoteCount > 0 && option.votes === highestVoteCount,
          isRecommended: recommendedTargetIds.has(option.targetId),
        })),
      },
    };
  }

  private getLatestResolvedRound(): Round | undefined {
    if (this.game.rounds.length === 0) {
      return undefined;
    }

    if (this.game.phase === GamePhase.ROUND_END || this.game.phase === GamePhase.GAME_OVER) {
      return this.getCurrentRound();
    }

    if (this.game.currentRound <= 1) {
      return undefined;
    }

    return this.game.rounds[this.game.currentRound - 2];
  }

  canStart(): boolean {
    return this.game.players.length >= MIN_PLAYERS_TO_START && this.game.phase === GamePhase.LOBBY;
  }

  startGame(): void {
    if (!this.canStart()) return;

    this.game.phase = GamePhase.READING;

    // Deal cards to all players
    for (const player of this.game.players) {
      this.dealCards(player, HAND_SIZE);
    }

    // Start first round with first player as boss
    this.startNewRound(this.game.players[0].id);
  }

  private dealCards(player: Player, count: number): void {
    const needed = count - player.hand.length;
    for (let i = 0; i < needed && this.game.answerDeck.length > 0; i++) {
      player.hand.push(this.game.answerDeck.pop()!);
    }
  }

  private startNewRound(bossId: string): void {
    if (this.game.questionDeck.length === 0) {
      this.game.phase = GamePhase.GAME_OVER;
      return;
    }

    const questionCardId = this.game.questionDeck.pop()!;
    const roundNumber = this.game.rounds.length + 1;

    const round: Round = {
      roundNumber,
      bossId,
      questionCardId,
      submissions: [],
      winnerId: null,
      phase: GamePhase.SUBMITTING,
      phaseDeadline: this.createDeadline(GamePhase.SUBMITTING),
    };

    this.game.rounds.push(round);
    this.game.currentRound = roundNumber;
    this.game.phase = GamePhase.SUBMITTING;

    // Reset swap flag for all players
    for (const player of this.game.players) {
      player.swappedThisRound = false;
    }
  }

  private createDeadline(phase: GamePhase): number | null {
    const durationSeconds = this.getPhaseDurationSeconds(phase);
    return durationSeconds ? Date.now() + (durationSeconds * 1000) : null;
  }

  private getPhaseDurationSeconds(phase: GamePhase): number | null {
    if (phase === GamePhase.SUBMITTING) {
      return SUBMIT_TIMER_SECONDS;
    }

    if (phase === GamePhase.REVEALING || phase === GamePhase.JUDGING) {
      return BOSS_PHASE_TIMER_SECONDS;
    }

    return null;
  }

  private updatePhase(phase: GamePhase, deadlineOverride?: number | null): void {
    const round = this.getCurrentRound();
    this.game.phase = phase;

    if (!round) {
      return;
    }

    round.phase = phase;
    round.phaseDeadline = typeof deadlineOverride === 'undefined'
      ? this.createDeadline(phase)
      : deadlineOverride;
  }

  private advanceToRevealing(): void {
    const round = this.getCurrentRound();
    if (!round) {
      return;
    }

    this.shuffleSubmissions(round);
    this.updatePhase(GamePhase.REVEALING);
  }

  private advanceToJudging(): void {
    this.updatePhase(GamePhase.JUDGING);
  }

  private endCurrentRoundAsGameOver(): void {
    const round = this.getCurrentRound();
    if (round) {
      round.phase = GamePhase.GAME_OVER;
      round.phaseDeadline = null;
    }

    this.game.phase = GamePhase.GAME_OVER;
  }

  private restorePausedDeadline(remainingPhaseMs: number | null): void {
    const round = this.getCurrentRound();
    if (!round) {
      return;
    }

    round.phaseDeadline = remainingPhaseMs !== null
      ? Date.now() + remainingPhaseMs
      : null;
  }

  private getExpectedSubmissionCount(round: Round): number {
    return this.game.players.filter(
      p => p.id !== round.bossId && p.isConnected && !p.swappedThisRound
    ).length;
  }

  private maybeAdvanceSubmittingPhase(round: Round): void {
    const expectedSubmissionCount = this.getExpectedSubmissionCount(round);

    if (expectedSubmissionCount === 0) {
      this.updatePhase(GamePhase.ROUND_END, null);
      return;
    }

    if (round.submissions.length >= expectedSubmissionCount) {
      this.advanceToRevealing();
    }
  }

  submitAnswer(playerId: string, cardIds: string[]): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.SUBMITTING) return false;
    if (this.isReconnectPaused()) return false;
    if (playerId === round.bossId) return false;

    const player = this.getPlayer(playerId);
    if (!player) return false;

    // Check player hasn't already submitted
    if (round.submissions.some(s => s.playerId === playerId)) return false;

    // Check correct number of cards
    const questionCard = this.cardDeck.getCard(round.questionCardId);
    if (!questionCard) return false;
    if (cardIds.length !== questionCard.blanks) return false;

    // Check player has all cards
    for (const cardId of cardIds) {
      if (!player.hand.includes(cardId)) return false;
    }

    // Remove cards from hand
    player.hand = player.hand.filter(id => !cardIds.includes(id));

    // Add submission
    round.submissions.push({
      playerId,
      playerName: player.name,
      cardIds,
      revealed: false,
    });

    this.maybeAdvanceSubmittingPhase(round);

    return true;
  }

  private shuffleSubmissions(round: Round): void {
    const subs = round.submissions;
    for (let i = subs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [subs[i], subs[j]] = [subs[j], subs[i]];
    }
  }

  swapCards(playerId: string): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.SUBMITTING) return false;
    if (this.isReconnectPaused()) return false;
    if (playerId === round.bossId) return false;

    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (player.swappedThisRound) return false;

    // Already submitted? Can't swap
    if (round.submissions.some(s => s.playerId === playerId)) return false;

    // Return old cards
    this.game.answerDeck.push(...player.hand);
    player.hand = [];

    // Draw new cards
    this.dealCards(player, HAND_SIZE);
    player.swappedThisRound = true;

    this.maybeAdvanceSubmittingPhase(round);

    return true;
  }

  revealSubmission(index: number): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.REVEALING) return false;
    if (this.isReconnectPaused()) return false;
    if (index < 0 || index >= round.submissions.length) return false;
    if (round.submissions[index].revealed) return false;

    round.submissions[index].revealed = true;

    // Check if all revealed
    const allRevealed = round.submissions.every(s => s.revealed);
    if (allRevealed) {
      this.advanceToJudging();
    }

    return true;
  }

  revealAllSubmissions(): void {
    const round = this.getCurrentRound();
    if (!round) return;
    if (this.isReconnectPaused()) return;
    round.submissions.forEach(s => s.revealed = true);
    this.advanceToJudging();
  }

  pickWinner(winnerId: string): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.JUDGING) return false;
    if (this.isReconnectPaused()) return false;

    // Verify the winner actually submitted
    if (!round.submissions.some(s => s.playerId === winnerId)) return false;

    round.winnerId = winnerId;
    this.updatePhase(GamePhase.ROUND_END, null);

    // Award trophy
    const winner = this.getPlayer(winnerId);
    if (winner) {
      winner.trophies += 1;

      // Check win condition
      if (winner.trophies >= this.game.maxTrophies) {
        this.game.phase = GamePhase.GAME_OVER;
        round.phase = GamePhase.GAME_OVER;
        round.phaseDeadline = null;
        return true;
      }
    }

    return true;
  }

  nextRound(): string[] {
    if (this.game.phase === GamePhase.GAME_OVER) {
      return [];
    }

    if (this.isReconnectPaused()) {
      return [];
    }

    const removedPlayers: string[] = [];

    for (const player of [...this.game.players]) {
      if (player.isConnected) {
        player.inactiveRounds = 0;
        continue;
      }

      player.inactiveRounds += 1;
      if (player.inactiveRounds >= MAX_INACTIVE_ROUNDS) {
        removedPlayers.push(player.name);
        this.removePlayer(player.id);
      }
    }

    if (this.game.players.length === 0) {
      return removedPlayers;
    }

    if (this.game.players.length < MIN_PLAYERS_TO_START) {
      this.endCurrentRoundAsGameOver();
      return removedPlayers;
    }

    // Deal cards to fill up hands
    for (const player of this.game.players) {
      if (player.isConnected) {
        this.dealCards(player, HAND_SIZE);
      }
    }

    // Determine next boss (round-robin among connected players)
    const currentRound = this.getCurrentRound();
    if (!currentRound) return removedPlayers;

    const currentBossIndex = this.game.players.findIndex((player) => player.id === currentRound.bossId);
    const nextBossId = this.getNextConnectedPlayerIdFromSeatIndex(currentBossIndex + 1);
    if (!nextBossId) {
      this.endCurrentRoundAsGameOver();
      return removedPlayers;
    }

    this.startNewRound(nextBossId);
    return removedPlayers;
  }

  rematch(): string[] {
    if (this.isReconnectPaused()) {
      return [];
    }

    const removedPlayers = this.game.players
      .filter((player) => !player.isConnected)
      .map((player) => player.name);
    const removedPlayerIds = this.game.players
      .filter((player) => !player.isConnected)
      .map((player) => player.id);

    this.game.players = this.game.players.filter((player) => player.isConnected);
    for (const playerId of removedPlayerIds) {
      this.clearCommunityVoting(playerId);
    }

    for (const player of this.game.players) {
      player.hand = [];
      player.trophies = 0;
      player.swappedThisRound = false;
      player.inactiveRounds = 0;
    }

    this.game.players.forEach((player, index) => {
      player.isHost = index === 0;
    });

    const { questionDeck, answerDeck } = this.cardDeck.createDecks(
      this.game.activeVariant,
      this.game.activeExtensions
    );

    this.game.rounds = [];
    this.game.currentRound = 0;
    this.game.questionDeck = questionDeck;
    this.game.answerDeck = answerDeck;
    this.game.phase = GamePhase.LOBBY;

    if (this.canStart()) {
      this.startGame();
    }

    return removedPlayers;
  }

  expireCurrentPhase(): { expiredPhase: GamePhase | null; autoRemovedPlayerNames: string[] } {
    const round = this.getCurrentRound();
    if (!round) {
      return { expiredPhase: null, autoRemovedPlayerNames: [] };
    }

    if (this.isReconnectPaused()) {
      return { expiredPhase: null, autoRemovedPlayerNames: [] };
    }

    const expiredPhase = this.game.phase;

    if (expiredPhase === GamePhase.SUBMITTING) {
      if (round.submissions.length === 0) {
        this.updatePhase(GamePhase.ROUND_END, null);
        return { expiredPhase, autoRemovedPlayerNames: [] };
      }

      this.advanceToRevealing();
      return { expiredPhase, autoRemovedPlayerNames: [] };
    }

    if (expiredPhase === GamePhase.REVEALING) {
      this.revealAllSubmissions();
      return { expiredPhase, autoRemovedPlayerNames: [] };
    }

    if (expiredPhase === GamePhase.JUDGING) {
      if (round.submissions.length === 0) {
        this.updatePhase(GamePhase.ROUND_END, null);
        return { expiredPhase, autoRemovedPlayerNames: [] };
      }

      const choice = round.submissions[Math.floor(Math.random() * round.submissions.length)];
      if (choice) {
        this.pickWinner(choice.playerId);
      }

      return { expiredPhase, autoRemovedPlayerNames: [] };
    }

    return { expiredPhase: null, autoRemovedPlayerNames: [] };
  }

  reconcileAfterDisconnect(): void {
    const round = this.getCurrentRound();
    if (!round) {
      return;
    }

    if (this.game.phase === GamePhase.SUBMITTING) {
      this.maybeAdvanceSubmittingPhase(round);
    }
  }

  private reconcileAfterPlayerRemoval(): void {
    const round = this.getCurrentRound();
    if (!round) {
      return;
    }

    if (this.game.phase === GamePhase.SUBMITTING) {
      this.maybeAdvanceSubmittingPhase(round);
      return;
    }

    if (this.game.phase === GamePhase.REVEALING) {
      if (round.submissions.length === 0) {
        this.updatePhase(GamePhase.ROUND_END, null);
        return;
      }

      if (round.submissions.every((submission) => submission.revealed)) {
        this.advanceToJudging();
      }

      return;
    }

    if (this.game.phase === GamePhase.JUDGING && round.submissions.length === 0) {
      this.updatePhase(GamePhase.ROUND_END, null);
    }
  }

  private getNextConnectedPlayerIdFromSeatIndex(startIndex: number): string | null {
    if (this.game.players.length === 0) {
      return null;
    }

    let nextPlayerIndex = ((startIndex % this.game.players.length) + this.game.players.length)
      % this.game.players.length;
    let attempts = 0;

    while (attempts < this.game.players.length && !this.game.players[nextPlayerIndex].isConnected) {
      nextPlayerIndex = (nextPlayerIndex + 1) % this.game.players.length;
      attempts += 1;
    }

    return attempts < this.game.players.length
      ? this.game.players[nextPlayerIndex].id
      : null;
  }

  private handleBossRemoval(removedBossIndex: number): void {
    if (this.shouldAbortForTooFewPlayers()) {
      this.endCurrentRoundAsGameOver();
      return;
    }

    const nextBossId = this.getNextConnectedPlayerIdFromSeatIndex(removedBossIndex);
    if (!nextBossId) {
      this.endCurrentRoundAsGameOver();
      return;
    }

    if (this.game.phase === GamePhase.ROUND_END) {
      const round = this.getCurrentRound();
      if (round) {
        round.bossId = nextBossId;
      }
      return;
    }

    const round = this.getCurrentRound();
    if (round) {
      round.phaseDeadline = null;
    }

    this.startNewRound(nextBossId);
  }

  private getWinnerNameForRound(round?: Round): string | null {
    if (!round?.winnerId) {
      return null;
    }

    return round.submissions.find((submission) => submission.playerId === round.winnerId)?.playerName
      || this.getPlayer(round.winnerId)?.name
      || null;
  }

  getClientState(forPlayerId: string): ClientGameState {
    const player = this.getPlayer(forPlayerId);
    const round = this.getCurrentRound();
    const lastCompletedRound = this.getLatestResolvedRound();
    const gameWinner = this.getWinner();
    const questionCard = round ? this.cardDeck.getCard(round.questionCardId) : null;

    const clientPlayers: ClientPlayer[] = this.game.players.map(p => ({
      id: p.id,
      name: p.name,
      trophies: p.trophies,
      isConnected: p.isConnected,
      isHost: p.isHost,
      hasSubmitted: round ? round.submissions.some(s => s.playerId === p.id) : false,
      swappedThisRound: p.swappedThisRound,
    }));

    const clientSubmissions: ClientSubmission[] = round
      ? round.submissions.map(s => {
          return {
            playerId: s.playerId,
            playerName: s.playerName,
            cards: s.revealed ? s.cardIds.map(id => this.cardDeck.getCard(id)!).filter(Boolean) : [],
            revealed: s.revealed,
          };
        })
      : [];

    // Only show player names in submissions after winner is picked.
    const hideNames = this.game.phase !== GamePhase.ROUND_END && this.game.phase !== GamePhase.GAME_OVER;

    if (hideNames) {
      clientSubmissions.forEach(s => {
        s.playerName = '???';
      });
    }

    return {
      code: this.game.code,
      phase: this.game.phase,
      phaseDeadline: round?.phaseDeadline || null,
      reconnectWindow: this.game.reconnectWindow
        ? {
            players: this.game.reconnectWindow.players.map((reconnectPlayer) => ({
              playerId: reconnectPlayer.playerId,
              playerName: reconnectPlayer.playerName,
            })),
            deadline: this.game.reconnectWindow.deadline,
          }
        : null,
      players: clientPlayers,
      currentRound: this.game.currentRound,
      maxTrophies: this.game.maxTrophies,
      activeVariant: this.game.activeVariant,
      activeExtensions: [...this.game.activeExtensions],
      myHand: player ? player.hand.map(id => this.cardDeck.getCard(id)!).filter(Boolean) : [],
      myId: forPlayerId,
      currentQuestion: questionCard || null,
      bossId: round?.bossId || null,
      submissions: clientSubmissions,
      winnerId: round?.winnerId || null,
      winnerName: this.getWinnerNameForRound(round),
      lastRoundWinnerId: lastCompletedRound?.winnerId || null,
      lastRoundWinnerName: this.getWinnerNameForRound(lastCompletedRound),
      gameWinnerId: gameWinner?.id || null,
      gameWinnerName: gameWinner?.name || null,
      hasPassword: this.game.passwordHash !== null,
      roundRecap: this.game.phase === GamePhase.GAME_OVER ? this.getRoundRecap() : null,
      communityVoting: this.getClientCommunityVotingState(forPlayerId),
    };
  }

  getRoundRecap(): RoundRecapEntry[] {
    return this.game.rounds
      .filter(round => round.winnerId !== null)
      .map(round => {
        const questionCard = this.cardDeck.getCard(round.questionCardId);
        const winningSubmission = round.submissions.find(s => s.playerId === round.winnerId);
        const winnerName = winningSubmission?.playerName
          || this.getPlayer(round.winnerId!)?.name
          || null;
        const winningCards = winningSubmission
          ? winningSubmission.cardIds
              .map(id => this.cardDeck.getCard(id))
              .filter(Boolean)
              .map(card => ({ text: card!.text }))
          : [];

        return {
          roundNumber: round.roundNumber,
          questionText: questionCard?.text || '',
          questionBlanks: questionCard?.blanks || 1,
          winnerName,
          winningCards,
        };
      });
  }

  getWinner(): Player | undefined {
    if (this.game.phase !== GamePhase.GAME_OVER) return undefined;
    return this.game.players.reduce((best, p) =>
      p.trophies > (best?.trophies || 0) ? p : best
    , this.game.players[0]);
  }
}
