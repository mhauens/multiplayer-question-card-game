export const MIN_PLAYERS_TO_START = 3;
export const MAX_PLAYERS = 8;
export const HAND_SIZE = 8;
export const TROPHY_TARGET_OPTIONS = [3, 5, 7, 10] as const;
export const DEFAULT_MAX_TROPHIES = 5;

export type TrophyTarget = (typeof TROPHY_TARGET_OPTIONS)[number];

export function isValidTrophyTarget(value: number): value is TrophyTarget {
  return TROPHY_TARGET_OPTIONS.includes(value as TrophyTarget);
}

export function getMinimumFullVariantAnswerCount(): number {
  return MAX_PLAYERS * HAND_SIZE;
}

export function getMinimumFullVariantQuestionCount(): number {
  return MAX_PLAYERS * (Math.max(...TROPHY_TARGET_OPTIONS) - 1) + 1;
}