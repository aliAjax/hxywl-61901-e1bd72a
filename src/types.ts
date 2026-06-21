export type Difficulty = "easy" | "normal" | "hard" | "expert";

export type ChartDifficulty = "casual" | "standard" | "challenge";

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

export interface ChartDifficultyInfo {
  level: number;
  label: string;
  color: string;
}

export interface PlayRecord {
  songId: string;
  difficulty: ChartDifficulty;
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

export interface PracticeSegment {
  startMs: number;
  endMs: number;
}

export type PageType = "select" | "play" | "tutorial" | "scorebook" | "settings" | "calibration" | "editor";

export interface ChartValidationError {
  type: "time" | "track" | "duration" | "overlap";
  noteId?: number;
  message: string;
}

export interface ChartValidationResult {
  valid: boolean;
  errors: ChartValidationError[];
}

export interface ChartNote {
  id: number;
  time: number;
  track: number;
  type: NoteType;
  duration?: number;
}

export interface Chart {
  songId: string;
  difficulty: ChartDifficulty;
  totalNotes: number;
  totalTapNotes: number;
  totalLongNotes: number;
  chorusCount: number;
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

export interface CalibrationData {
  global: number;
  perSong: Record<string, number>;
}

export type CalibrationSource = "global" | "song";

export interface EffectiveCalibration {
  value: number;
  source: CalibrationSource;
}

export interface ScoreCheckpoint {
  progressPercent: number;
  elapsedMs: number;
  score: number;
  combo: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
}

export interface BestPlaySummary {
  songId: string;
  difficulty: ChartDifficulty;
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
  checkpoints: ScoreCheckpoint[];
  completedAt: number;
}

export interface LiveComparisonState {
  scoreDiff: number;
  comboDiff: number;
  bestScoreAtProgress: number;
  bestComboAtProgress: number;
  isScoreBehind: boolean;
  isComboBehind: boolean;
}

export type ButtonLayout = "compact" | "spacious";

export interface KeyBindings {
  track0: string;
  track1: string;
  track2: string;
  track3: string;
}

export interface ControlSettings {
  keyBindings: KeyBindings;
  buttonLayout: ButtonLayout;
}
