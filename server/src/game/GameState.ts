import { HAND_SIZE, MIN_PLAYERS_TO_START } from '@kgs/game-rules';
import {
  Game,
  GamePhase,
  Player,
  Round,
  ClientGameState,
  ClientPlayer,
  ClientSubmission,
} from '../types';
import { CardDeck } from './CardDeck';

export class GameState {
  game: Game;
  private cardDeck: CardDeck;

  constructor(game: Game, cardDeck: CardDeck) {
    this.game = game;
    this.cardDeck = cardDeck;
  }

  addPlayer(player: Player): void {
    this.game.players.push(player);
  }

  removePlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    // Return cards to answer deck
    this.game.answerDeck.push(...player.hand);
    this.game.players = this.game.players.filter(p => p.id !== playerId);
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
    };

    this.game.rounds.push(round);
    this.game.currentRound = roundNumber;
    this.game.phase = GamePhase.SUBMITTING;

    // Reset swap flag for all players
    for (const player of this.game.players) {
      player.swappedThisRound = false;
    }
  }

  submitAnswer(playerId: string, cardIds: string[]): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.SUBMITTING) return false;
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
      cardIds,
      revealed: false,
    });

    // Check if all non-boss connected players have submitted (or swapped)
    const expectedSubmissions = this.game.players.filter(
      p => p.id !== round.bossId && p.isConnected && !p.swappedThisRound
    ).length;

    if (round.submissions.length >= expectedSubmissions) {
      this.game.phase = GamePhase.REVEALING;
      round.phase = GamePhase.REVEALING;
      // Shuffle submissions so boss can't guess order
      this.shuffleSubmissions(round);
    }

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

    // Check if all non-boss connected non-swapped players have submitted
    const expectedSubmissions = this.game.players.filter(
      p => p.id !== round.bossId && p.isConnected && !p.swappedThisRound
    ).length;

    if (round.submissions.length >= expectedSubmissions) {
      this.game.phase = GamePhase.REVEALING;
      round.phase = GamePhase.REVEALING;
      this.shuffleSubmissions(round);
    }

    return true;
  }

  revealSubmission(index: number): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.REVEALING) return false;
    if (index < 0 || index >= round.submissions.length) return false;

    round.submissions[index].revealed = true;

    // Check if all revealed
    const allRevealed = round.submissions.every(s => s.revealed);
    if (allRevealed) {
      this.game.phase = GamePhase.JUDGING;
      round.phase = GamePhase.JUDGING;
    }

    return true;
  }

  revealAllSubmissions(): void {
    const round = this.getCurrentRound();
    if (!round) return;
    round.submissions.forEach(s => s.revealed = true);
    this.game.phase = GamePhase.JUDGING;
    round.phase = GamePhase.JUDGING;
  }

  pickWinner(winnerId: string): boolean {
    const round = this.getCurrentRound();
    if (!round || this.game.phase !== GamePhase.JUDGING) return false;

    // Verify the winner actually submitted
    if (!round.submissions.some(s => s.playerId === winnerId)) return false;

    round.winnerId = winnerId;
    round.phase = GamePhase.ROUND_END;
    this.game.phase = GamePhase.ROUND_END;

    // Award trophy
    const winner = this.getPlayer(winnerId);
    if (winner) {
      winner.trophies += 1;

      // Check win condition
      if (winner.trophies >= this.game.maxTrophies) {
        this.game.phase = GamePhase.GAME_OVER;
        return true;
      }
    }

    return true;
  }

  nextRound(): void {
    if (this.game.phase === GamePhase.GAME_OVER) return;

    // Deal cards to fill up hands
    for (const player of this.game.players) {
      if (player.isConnected) {
        this.dealCards(player, HAND_SIZE);
      }
    }

    // Determine next boss (round-robin among connected players)
    const currentRound = this.getCurrentRound();
    if (!currentRound) return;

    const currentBossIndex = this.game.players.findIndex(p => p.id === currentRound.bossId);
    let nextBossIndex = (currentBossIndex + 1) % this.game.players.length;

    // Skip disconnected players
    let attempts = 0;
    while (!this.game.players[nextBossIndex].isConnected && attempts < this.game.players.length) {
      nextBossIndex = (nextBossIndex + 1) % this.game.players.length;
      attempts++;
    }

    this.startNewRound(this.game.players[nextBossIndex].id);
  }

  getClientState(forPlayerId: string): ClientGameState {
    const player = this.getPlayer(forPlayerId);
    const round = this.getCurrentRound();
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
          const submitter = this.getPlayer(s.playerId);
          return {
            playerId: s.playerId,
            playerName: submitter?.name || 'Unknown',
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
      winnerName: round?.winnerId ? this.getPlayer(round.winnerId)?.name || null : null,
    };
  }

  getWinner(): Player | undefined {
    if (this.game.phase !== GamePhase.GAME_OVER) return undefined;
    return this.game.players.reduce((best, p) =>
      p.trophies > (best?.trophies || 0) ? p : best
    , this.game.players[0]);
  }
}
