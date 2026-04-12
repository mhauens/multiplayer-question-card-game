import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_TROPHIES } from '@kgs/game-rules';
import { GameManager } from '../src/game/GameManager';

describe('GameManager', () => {
  it('keeps valid trophy targets when creating a game', () => {
    const manager = new GameManager();

    const { gameState } = manager.createGame('Anna', 7, 'base', []);

    expect(gameState.game.maxTrophies).toBe(7);
  });

  it('falls back to the default trophy target for invalid runtime input', () => {
    const manager = new GameManager();

    const { gameState } = manager.createGame('Anna', 999 as never, 'base', []);

    expect(gameState.game.maxTrophies).toBe(DEFAULT_MAX_TROPHIES);
  });
});