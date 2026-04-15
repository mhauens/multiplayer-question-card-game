export const MIN_PLAYERS_TO_START = 3;
export const MAX_PLAYERS = 8;
export const HAND_SIZE = 8;
export const TROPHY_TARGET_OPTIONS = [3, 5, 7, 10] as const;
export const DEFAULT_MAX_TROPHIES = 5;
export const SUBMIT_TIMER_SECONDS = 180;
export const BOSS_PHASE_TIMER_SECONDS = 180;
export const RECONNECT_GRACE_SECONDS = 30;
export const MAX_INACTIVE_ROUNDS = 3;

export const COMMUNITY_VOTING_CONTEXT_KINDS = ['SUBMIT_HAND', 'JUDGE_SUBMISSIONS'] as const;
export const COMMUNITY_VOTING_CONNECTION_STATUSES = ['disconnected', 'warning_required', 'connecting', 'connected', 'error'] as const;
export const TWITCH_MINIMAL_SCOPES = ['user:read:chat'] as const;
export const COMMUNITY_VOTE_COMMAND = /^!card\s+(\d+)$/i;
export const COMMUNITY_VOTE_COMMAND_PREFIX = '!card';

export type TrophyTarget = (typeof TROPHY_TARGET_OPTIONS)[number];
export type CommunityVotingContextKind = (typeof COMMUNITY_VOTING_CONTEXT_KINDS)[number];
export type CommunityVotingConnectionStatus = (typeof COMMUNITY_VOTING_CONNECTION_STATUSES)[number];

export function isValidTrophyTarget(value: number): value is TrophyTarget {
  return TROPHY_TARGET_OPTIONS.includes(value as TrophyTarget);
}

export function buildCommunityVoteCommand(voteNumber: number): string {
  return `${COMMUNITY_VOTE_COMMAND_PREFIX} ${voteNumber}`;
}

export function getMinimumFullVariantAnswerCount(): number {
  return MAX_PLAYERS * HAND_SIZE;
}

export function getMinimumFullVariantQuestionCount(): number {
  return MAX_PLAYERS * (Math.max(...TROPHY_TARGET_OPTIONS) - 1) + 1;
}