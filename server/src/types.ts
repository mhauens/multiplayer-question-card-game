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
  inactiveRounds: number;
}

export interface Submission {
  playerId: string;
  playerName: string;
  cardIds: string[];
  revealed: boolean;
}

export interface ReconnectWindowPlayer {
  playerId: string;
  playerName: string;
}

export interface ReconnectWindow {
  players: ReconnectWindowPlayer[];
  deadline: number;
  pausedPhase: GamePhase;
  remainingPhaseMs: number | null;
}

export interface Round {
  roundNumber: number;
  bossId: string;
  questionCardId: string;
  submissions: Submission[];
  winnerId: string | null;
  phase: GamePhase;
  phaseDeadline: number | null;
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
  reconnectWindow: ReconnectWindow | null;
  createdAt: number;
  passwordHash: string | null;
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
  password?: string;
}

export interface JoinGamePayload {
  gameCode: string;
  playerName: string;
  password?: string;
}

export interface SubmitAnswerPayload {
  cardIds: string[];
}

export interface PickWinnerPayload {
  playerId: string;
}

export interface KickPlayerPayload {
  playerId: string;
}

export interface RejoinPayload {
  gameCode: string;
  playerId: string;
}

export interface ClientReconnectWindowPlayer {
  playerId: string;
  playerName: string;
}

export interface ClientReconnectWindow {
  players: ClientReconnectWindowPlayer[];
  deadline: number;
}

// Client-facing state (sanitized - no other player hands)
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

export interface RoundRecapEntry {
  roundNumber: number;
  questionText: string;
  questionBlanks: number;
  winnerName: string | null;
  winningCards: { text: string }[];
}
