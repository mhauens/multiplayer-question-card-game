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

export interface ClientGameState {
  code: string;
  phase: GamePhase;
  players: ClientPlayer[];
  currentRound: number;
  maxTrophies: number;
  activeVariant: string;
  activeExtensions: string[];
  myHand: Card[];
  myId: string;
  currentQuestion: Card | null;
  bossId: string | null;
  submissions: ClientSubmission[];
  winnerId: string | null;
  winnerName: string | null;
}
