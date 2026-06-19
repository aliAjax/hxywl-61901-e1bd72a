export type Difficulty = "easy" | "normal" | "hard" | "expert";

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: Difficulty;
  difficultyLevel: number;
  duration: number;
  coverColor: string;
  accentColor: string;
  previewPattern: number[];
}

export interface PlayRecord {
  songId: string;
  score: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  completedAt: number;
}

export type PageType = "select" | "play" | "tutorial" | "scorebook";
