import { DEFAULT_MAX_TROPHIES, MAX_PLAYERS, isValidTrophyTarget, type TrophyTarget } from '@kgs/game-rules';
import { CardCatalogOption, ExtensionCatalogOption, Game, GamePhase, GamePreview, Player } from '../types';
import { randomUUID } from 'crypto';
import { GameState } from './GameState';
import { CardDeck } from './CardDeck';

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private cardDeck: CardDeck;

  constructor() {
    this.cardDeck = new CardDeck();
  }

  getAvailableVariants(): CardCatalogOption[] {
    return this.cardDeck.getAvailableVariants();
  }

  hasVariant(variant: string): boolean {
    return this.cardDeck.hasVariant(variant);
  }

  getAvailableExtensions(): ExtensionCatalogOption[] {
    return this.cardDeck.getAvailableExtensions();
  }

  createGame(hostName: string, maxTrophies: TrophyTarget, variant: string, extensions: string[]): { gameState: GameState; player: Player } {
    let code = generateGameCode();
    while (this.games.has(code)) {
      code = generateGameCode();
    }

    const normalizedMaxTrophies = isValidTrophyTarget(maxTrophies)
      ? maxTrophies
      : DEFAULT_MAX_TROPHIES;
    const selectedVariant = this.cardDeck.hasVariant(variant) ? variant : 'base';
    const selectedExtensions = this.cardDeck.getValidExtensionsForVariant(selectedVariant, extensions);
    const { questionDeck, answerDeck } = this.cardDeck.createDecks(selectedVariant, selectedExtensions);

    const game: Game = {
      code,
      players: [],
      rounds: [],
      currentRound: 0,
      maxTrophies: normalizedMaxTrophies,
      phase: GamePhase.LOBBY,
      activeVariant: selectedVariant,
      activeExtensions: selectedExtensions,
      questionDeck,
      answerDeck,
      createdAt: Date.now(),
    };

    const gameState = new GameState(game, this.cardDeck);

    const player: Player = {
      id: randomUUID(),
      name: hostName,
      socketId: null,
      hand: [],
      trophies: 0,
      isConnected: true,
      isHost: true,
      swappedThisRound: false,
    };

    gameState.addPlayer(player);
    this.games.set(code, gameState);

    return { gameState, player };
  }

  joinGame(code: string, playerName: string): { gameState: GameState; player: Player } | null {
    const gameState = this.games.get(code.toUpperCase());
    if (!gameState) return null;

    if (gameState.game.phase !== GamePhase.LOBBY) return null;
    if (gameState.game.players.length >= MAX_PLAYERS) return null;

    // Check for duplicate name
    if (gameState.game.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return null;
    }

    const player: Player = {
      id: randomUUID(),
      name: playerName,
      socketId: null,
      hand: [],
      trophies: 0,
      isConnected: true,
      isHost: false,
      swappedThisRound: false,
    };

    gameState.addPlayer(player);
    return { gameState, player };
  }

  getGame(code: string): GameState | undefined {
    return this.games.get(code.toUpperCase());
  }

  getGamePreview(code: string): GamePreview | null {
    const gameState = this.games.get(code.toUpperCase());
    if (!gameState) return null;

    return {
      code: gameState.game.code,
      phase: gameState.game.phase,
      activeVariant: gameState.game.activeVariant,
    };
  }

  findGameBySocketId(socketId: string): { gameState: GameState; player: Player } | undefined {
    for (const [, gameState] of this.games) {
      const player = gameState.getPlayerBySocketId(socketId);
      if (player) {
        return { gameState, player };
      }
    }
    return undefined;
  }

  rejoinGame(code: string, playerId: string): { gameState: GameState; player: Player } | null {
    const gameState = this.games.get(code.toUpperCase());
    if (!gameState) return null;

    const player = gameState.getPlayer(playerId);
    if (!player) return null;

    player.isConnected = true;
    return { gameState, player };
  }

  deleteGame(code: string): void {
    this.games.delete(code.toUpperCase());
  }

  // Clean up old games (no connected players for more than 1 hour)
  cleanup(): void {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const [code, gameState] of this.games) {
      const connectedCount = gameState.getConnectedPlayerCount();
      if (connectedCount === 0 && now - gameState.game.createdAt > ONE_HOUR) {
        this.games.delete(code);
      }
    }
  }
}
