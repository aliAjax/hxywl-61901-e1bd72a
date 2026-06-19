export type Difficulty = "easy" | "normal" | "hard" | "expert";

export type NoteType = "tap" | "long";

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
  tapPerfectCount: number;
  tapGoodCount: number;
  tapMissCount: number;
  longPerfectCount: number;
  longGoodCount: number;
  longMissCount: number;
  completedAt: number;
}

export type PageType = "select" | "play" | "tutorial" | "scorebook" | "settings" | "calibration";

export interface ChartNote {
  id: number;
  time: number;
  track: number;
  type: NoteType;
  duration?: number;
}

export interface Chart {
  songId: string;
  totalNotes: number;
  totalTapNotes: number;
  totalLongNotes: number;
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
  tapPerfectCount: number;
  tapGoodCount: number;
  tapMissCount: number;
  longPerfectCount: number;
  longGoodCount: number;
  longMissCount: number;
}

export interface ActiveNote {
  id: number;
  track: number;
  spawnTime: number;
  targetTime: number;
  y: number;
  judged: boolean;
  type: NoteType;
  duration?: number;
  longHolding?: boolean;
  longStartJudged?: boolean;
  longEndTime?: number;
}

export interface ResourceVersion {
  schemaVersion: number;
  songsVersion: number;
  chartsVersion: number;
  scoresVersion: number;
}

export interface ResourceIntegrityReport {
  ok: boolean;
  missingSongs: string[];
  missingCharts: string[];
  corruptedSongs: string[];
  corruptedCharts: string[];
  corruptedScores: string[];
  versionMismatch: boolean;
}

export interface ResourceInitResult {
  initialized: boolean;
  recoveredFromCorruption: boolean;
  cleanedStaleData: boolean;
  warnings: string[];
  version: ResourceVersion;
}
