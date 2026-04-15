import { COMMUNITY_VOTE_COMMAND } from '@kgs/game-rules';

export function parseCommunityVoteCommand(message: string, optionCount: number): number | null {
  const normalizedMessage = message.trim();
  const match = COMMUNITY_VOTE_COMMAND.exec(normalizedMessage);
  if (!match) {
    return null;
  }

  const voteNumber = Number.parseInt(match[1], 10);
  if (!Number.isInteger(voteNumber) || voteNumber < 1 || voteNumber > optionCount) {
    return null;
  }

  return voteNumber;
}

export function shouldCountCommunityVoteFromSource(
  sourceBroadcasterUserId: string | null | undefined,
  ownChannelId: string,
): boolean {
  return !sourceBroadcasterUserId || sourceBroadcasterUserId === ownChannelId;
}
