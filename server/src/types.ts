import { type TrophyTarget } from '@kgs/game-rules';

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

export interface Player {
  id: string;
  name: string;
  socketId: string | null;
  hand: string[]; // card IDs
  trophies: number;
  isConnected: boolean;
  isHost: boolean;
  swappedThisRound: boolean;
}

export interface Submission {
  playerId: string;
  cardIds: string[];
  revealed: boolean;
}

export interface Round {
  roundNumber: number;
  bossId: string;
  questionCardId: string;
  submissions: Submission[];
  winnerId: string | null;
  phase: GamePhase;
}

export interface Game {
  code: string;
  players: Player[];
  rounds: Round[];
  currentRound: number;
  maxTrophies: TrophyTarget;
  phase: GamePhase;
  activeVariant: string;
  activeExtensions: string[];
  questionDeck: string[]; // card IDs remaining
  answerDeck: string[]; // card IDs remaining
  createdAt: number;
}

export interface CardSet {
  name: string;
  title?: string;
  description?: string;
  variants?: string[];
  questions: { text: string; blanks: number }[];
  answers: string[];
}

export interface ExtensionCatalogOption {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  answerCount: number;
  variants: string[];
}

export interface CardCatalogOption {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  answerCount: number;
  extensions: ExtensionCatalogOption[];
}

// Socket event payloads

export interface CreateGamePayload {
  playerName: string;
  maxTrophies: TrophyTarget;
  variant: string;
  extensions: string[];
}

export interface JoinGamePayload {
  gameCode: string;
  playerName: string;
}

export interface SubmitAnswerPayload {
  cardIds: string[];
}

export interface PickWinnerPayload {
  playerId: string;
}

export interface RejoinPayload {
  gameCode: string;
  playerId: string;
}

// Client-facing state (sanitized - no other player hands)
export interface ClientGameState {
  code: string;
  phase: GamePhase;
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
