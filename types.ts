export enum GameMode {
  NONE = 'NONE',
  NUMBERS = 'NUMBERS',
  WORDS = 'WORDS',
}

export enum PlayerType {
  USER = 'USER',
  AI = 'AI',
}

export enum GameStatus {
  LOBBY = 'LOBBY',
  SETUP = 'SETUP', // Player choosing their secret
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum AppScreen {
  START = 'START',
  CHARACTER_SELECT = 'CHARACTER_SELECT',
  LOGIN = 'LOGIN',
  GAME = 'GAME',
}

export interface Character {
  id: string;
  name: string;
  description: string;
  speed: number; // 0-100
  damage: number; // 0-100
  health: number; // 0-100
  imagePath?: string; // путь к изображению персонажа
  avatarPath?: string; // путь к аватарке персонажа
}

export interface TurnHistoryItem {
  player: PlayerType;
  guess: string;
  result: string; // e.g., "1 Match" or specific letters
  timestamp: number;
}

export interface PlayerState {
  id: string;
  secret: string; // The code/word they are hiding
  revealedIndices: boolean[]; // Which parts of the secret are revealed
}

export interface GameConfig {
  numberLength: number;
  wordLength: number;
  turnDurationSeconds: number;
}