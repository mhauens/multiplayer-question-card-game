import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_TROPHIES,
  getMinimumFullVariantAnswerCount,
  getMinimumFullVariantQuestionCount,
} from '@kgs/game-rules';
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

  it('allows ten players to join and rejects the eleventh', () => {
    const manager = new GameManager();
    const { gameState } = manager.createGame('Anna', 3, 'base', []);
    const gameCode = gameState.game.code;

    for (let index = 2; index <= 10; index += 1) {
      const result = manager.joinGame(gameCode, `Spieler ${index}`);
      expect(result).not.toBeNull();
    }

    expect(gameState.game.players).toHaveLength(10);
    expect(manager.joinGame(gameCode, 'Spieler 11')).toBeNull();
    expect(gameState.game.players).toHaveLength(10);
  });

  it('ships the base variant with enough cards for the documented full-game limits', () => {
    const manager = new GameManager();
    const baseVariant = manager.getAvailableVariants().find((variant) => variant.id === 'base');

    expect(baseVariant).toBeDefined();
    expect(baseVariant?.questionCount).toBeGreaterThanOrEqual(getMinimumFullVariantQuestionCount());
    expect(baseVariant?.answerCount).toBeGreaterThanOrEqual(getMinimumFullVariantAnswerCount());
  });
});
