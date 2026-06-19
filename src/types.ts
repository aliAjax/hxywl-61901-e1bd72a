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

export interface ChartNote {
  id: number;
  time: number;
  track: number;
}

export interface Chart {
  songId: string;
  totalNotes: number;
  notes: ChartNote[];
  audioBeats: { time: number; freq: number; type: "kick" | "snare" | "hihat" | "melody" }[];
}

export type JudgeType = "perfect" | "good" | "miss" | null;

export interface JudgeEvent {
  type: JudgeType;
  track: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
}

export interface ActiveNote {
  id: number;
  track: number;
  spawnTime: number;
  targetTime: number;
  y: number;
  judged: boolean;
}
