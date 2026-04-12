import fs from 'fs';
import path from 'path';
import {
  getMinimumFullVariantAnswerCount,
  getMinimumFullVariantQuestionCount,
  MAX_PLAYERS,
  TROPHY_TARGET_OPTIONS,
} from '@kgs/game-rules';
import { describe, expect, it } from 'vitest';

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf-8');
}

describe('game-rules-and-content skill', () => {
  const skillSource = readFile('../../.agents/skills/game-rules-and-content/SKILL.md');
  const highestSelectableMaxTrophies = Math.max(...TROPHY_TARGET_OPTIONS);
  const minimumAnswers = getMinimumFullVariantAnswerCount();
  const minimumQuestions = getMinimumFullVariantQuestionCount();

  it('documents that the full-variant minimums do not apply to extensions', () => {
    expect(skillSource).toContain('apply to new full variants, not to extensions');
    expect(skillSource).toContain('compatible full variant');
  });

  it('documents the current minimum card counts for full variants', () => {
    expect(skillSource).toContain(`at least ${minimumAnswers} unique answers`);
    expect(skillSource).toContain(`at least ${minimumQuestions} questions`);
    expect(skillSource).toContain('Only one trophy is awarded per round');
    expect(skillSource).toContain(
      `With the current repo limits that means \`${MAX_PLAYERS} * (${highestSelectableMaxTrophies} - 1) + 1 = ${minimumQuestions}\` questions.`
    );
  });

  it('documents when the minimum counts must be recalculated', () => {
    expect(skillSource).toContain('If the maximum player count changes later');
    expect(skillSource).toContain('both the minimum question count and the minimum answer count must be recalculated');
    expect(skillSource).toContain('If the hand size changes later');
    expect(skillSource).toContain('minimum answer count must be recalculated');
    expect(skillSource).toContain('If the highest selectable trophy target changes later');
    expect(skillSource).toContain('minimum question count must be recalculated');
  });
});
