import {
  type CommunityVotingConnectionStatus,
  type CommunityVotingContextKind,
  type TrophyTarget,
} from '@kgs/game-rules';

export enum GamePhase {
  LOBBY = 'LOBBY',
  READING = 'READING',
  SUBMITTING = 'SUBMITTING',
  REVEALING = 'REVEALING',
  JUDGING = 'JUDGING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export interface Card {
  id: string;
  type: 'question' | 'answer';
  text: string;
  blanks: number;
  extension: string;
}

export interface ClientPlayer {
  id: string;
  name: string;
  trophies: number;
  isConnected: boolean;
  isHost: boolean;
  hasSubmitted: boolean;
  swappedThisRound: boolean;
}

export interface ClientSubmission {
  playerId: string;
  playerName: string;
  cards: Card[];
  revealed: boolean;
}

export interface GamePreview {
  code: string;
  phase: GamePhase;
  activeVariant: string;
  hasPassword: boolean;
}

export interface CardCatalogOption {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  answerCount: number;
  extensions: ExtensionCatalogOption[];
}

export interface ExtensionCatalogOption {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  answerCount: number;
  variants: string[];
}

export interface ClientReconnectWindowPlayer {
  playerId: string;
  playerName: string;
}

export interface ClientReconnectWindow {
  players: ClientReconnectWindowPlayer[];
  deadline: number;
}

export interface ClientCommunityVotingOption {
  targetId: string;
  voteNumber: number;
  voteCommand: string;
  votes: number;
  isLeading: boolean;
  isRecommended: boolean;
}

export interface ClientCommunityVotingContext {
  kind: CommunityVotingContextKind;
  roundNumber: number;
  totalUniqueVoters: number;
  options: ClientCommunityVotingOption[];
}

export interface ClientCommunityVotingConnection {
  status: CommunityVotingConnectionStatus;
  channelLogin: string | null;
  channelDisplayName: string | null;
  sharedChatActive: boolean;
  lastError: string | null;
}

export interface ClientCommunityVotingState {
  enabled: boolean;
  privacyWarningAcknowledgedForSession: boolean;
  connection: ClientCommunityVotingConnection;
  context: ClientCommunityVotingContext | null;
}

export interface ClientGameState {
  code: string;
  phase: GamePhase;
  phaseDeadline: number | null;
  reconnectWindow: ClientReconnectWindow | null;
  players: ClientPlayer[];
  currentRound: number;
  maxTrophies: TrophyTarget;
  activeVariant: string;
  activeExtensions: string[];
  myHand: Card[];
  myId: string;
  currentQuestion: Card | null;
  bossId: string | null;
  submissions: ClientSubmission[];
  winnerId: string | null;
  winnerName: string | null;
  lastRoundWinnerId: string | null;
  lastRoundWinnerName: string | null;
  gameWinnerId: string | null;
  gameWinnerName: string | null;
  hasPassword: boolean;
  roundRecap: RoundRecapEntry[] | null;
  communityVoting: ClientCommunityVotingState;
}

export interface RoundRecapEntry {
  roundNumber: number;
  questionText: string;
  questionBlanks: number;
  winnerName: string | null;
  winningCards: { text: string }[];
}
