import type { Song, PlayRecord, ChartDifficulty, BestPlaySummary, ScoreCheckpoint, LiveComparisonState, GameStats, KeyBindings, ButtonLayout, ControlSettings } from "./types";
import {
  resourceManager,
  defaultSongs,
  tutorialSong,
  syncTestSong,
  difficultyLabels,
  difficultyColors,
  formatDuration,
  CHART_DIFFICULTIES,
  CHART_DIFFICULTY_INFO,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_BUTTON_LAYOUT,
  DEFAULT_CONTROL_SETTINGS,
} from "./resourceManager";

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  highlightTrack?: number;
  autoSpawnPattern?: number[];
  autoSpawnInterval?: number;
  requireUserAction?: boolean;
  waitMs?: number;
  forceMiss?: boolean;
}

export const songs = new Proxy<Song[]>([] as Song[], {
  get(_target, prop, _receiver) {
    const realSongs = resourceManager.getSongs();
    if (prop === "length") return realSongs.length;
    if (typeof prop === "string" && /^\d+$/.test(prop)) {
      return realSongs[parseInt(prop, 10)];
    }
    if (prop === Symbol.iterator) {
      return realSongs[Symbol.iterator].bind(realSongs);
    }
    const value = (realSongs as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(realSongs);
    }
    return value;
  },
  has(_target, prop) {
    const realSongs = resourceManager.getSongs();
    return prop in realSongs;
  },
});

export { tutorialSong, syncTestSong, difficultyLabels, difficultyColors, formatDuration, CHART_DIFFICULTIES, CHART_DIFFICULTY_INFO };

export function getSongBestScore(songId: string, difficulty: ChartDifficulty = "standard"): number {
  return resourceManager.getBestScore(songId, difficulty);
}

export function saveSongBestScore(songId: string, difficulty: ChartDifficulty, score: number): void {
  resourceManager.saveBestScore(songId, difficulty, score);
}

export function getPlayRecords(songId?: string, difficulty?: ChartDifficulty): PlayRecord[] {
  return resourceManager.getPlayRecords(songId, difficulty);
}

export function savePlayRecord(record: PlayRecord): void {
  resourceManager.savePlayRecord(record);
}

export function getBestPlaySummary(songId: string, difficulty: ChartDifficulty = "standard"): BestPlaySummary | null {
  return resourceManager.getBestPlaySummary(songId, difficulty);
}

export function saveBestPlaySummary(summary: BestPlaySummary): boolean {
  return resourceManager.saveBestPlaySummary(summary);
}

function interpolateCheckpoint(checkpoints: ScoreCheckpoint[], progressPercent: number): ScoreCheckpoint | null {
  if (checkpoints.length === 0) return null;
  if (progressPercent <= checkpoints[0].progressPercent) return checkpoints[0];
  if (progressPercent >= checkpoints[checkpoints.length - 1].progressPercent) return checkpoints[checkpoints.length - 1];

  for (let i = 0; i < checkpoints.length - 1; i++) {
    const curr = checkpoints[i];
    const next = checkpoints[i + 1];
    if (progressPercent >= curr.progressPercent && progressPercent <= next.progressPercent) {
      const range = next.progressPercent - curr.progressPercent;
      const t = range === 0 ? 0 : (progressPercent - curr.progressPercent) / range;
      return {
        progressPercent,
        elapsedMs: Math.round(curr.elapsedMs + (next.elapsedMs - curr.elapsedMs) * t),
        score: Math.round(curr.score + (next.score - curr.score) * t),
        combo: Math.round(curr.combo + (next.combo - curr.combo) * t),
        perfectCount: Math.round(curr.perfectCount + (next.perfectCount - curr.perfectCount) * t),
        goodCount: Math.round(curr.goodCount + (next.goodCount - curr.goodCount) * t),
        missCount: Math.round(curr.missCount + (next.missCount - curr.missCount) * t),
      };
    }
  }
  return checkpoints[checkpoints.length - 1];
}

export function computeLiveComparison(
  bestSummary: BestPlaySummary | null,
  currentStats: GameStats,
  progressPercent: number
): LiveComparisonState | null {
  if (!bestSummary || bestSummary.checkpoints.length === 0) return null;
  const bestAt = interpolateCheckpoint(bestSummary.checkpoints, progressPercent);
  if (!bestAt) return null;

  const scoreDiff = Math.floor(currentStats.score) - bestAt.score;
  const comboDiff = currentStats.combo - bestAt.combo;

  return {
    scoreDiff,
    comboDiff,
    bestScoreAtProgress: bestAt.score,
    bestComboAtProgress: bestAt.combo,
    isScoreBehind: scoreDiff < 0,
    isComboBehind: comboDiff < 0,
  };
}

export function getCalibrationOffset(): number {
  return resourceManager.getCalibrationOffset();
}

export function saveCalibrationOffset(offsetMs: number): void {
  resourceManager.saveCalibrationOffset(offsetMs);
}

export function resetCalibrationOffset(): void {
  resourceManager.resetCalibrationOffset();
}

export function getSongCalibrationOffset(songId: string): number | null {
  return resourceManager.getSongCalibrationOffset(songId);
}

export function saveSongCalibrationOffset(songId: string, offsetMs: number): void {
  resourceManager.saveSongCalibrationOffset(songId, offsetMs);
}

export function resetSongCalibrationOffset(songId: string): void {
  resourceManager.resetSongCalibrationOffset(songId);
}

export function getEffectiveCalibration(songId?: string | null): import("./types").EffectiveCalibration {
  return resourceManager.getEffectiveCalibration(songId);
}

export function getAllSongCalibrations(): Record<string, number> {
  return resourceManager.getAllSongCalibrations();
}

export function resetAllSongCalibrations(): void {
  resourceManager.resetAllSongCalibrations();
}

export const TUTORIAL_KEY = "rhythm-tutorial-completed";

export function isTutorialCompleted(): boolean {
  return resourceManager.isTutorialCompleted();
}

export function markTutorialCompleted(): void {
  resourceManager.markTutorialCompleted();
}

export function resetTutorialStatus(): void {
  resourceManager.resetTutorialStatus();
}

export function getFavoriteSongIds(): string[] {
  return resourceManager.getFavoriteSongIds();
}

export function isSongFavorite(songId: string): boolean {
  return resourceManager.isSongFavorite(songId);
}

export function toggleSongFavorite(songId: string): boolean {
  return resourceManager.toggleSongFavorite(songId);
}

export function resetFavorites(): void {
  resourceManager.resetFavorites();
}

export function calcAccuracy(
  perfectCount: number,
  goodCount: number,
  missCount: number
): number {
  const total = perfectCount + goodCount + missCount;
  if (total === 0) return 0;
  const weighted = perfectCount + goodCount * 0.5;
  return (weighted / total) * 100;
}

export type Grade = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D";

export const GRADE_ORDER: Record<Grade, number> = {
  SSS: 7,
  SS: 6,
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

export const GRADE_COLORS: Record<Grade, string> = {
  SSS: "#f472b6",
  SS: "#fb923c",
  S: "#facc15",
  A: "#34d399",
  B: "#60a5fa",
  C: "#a78bfa",
  D: "#64748b",
};

export function calcGrade(
  perfectCount: number,
  goodCount: number,
  missCount: number,
  totalNotes: number
): Grade {
  const total = perfectCount + goodCount + missCount;
  if (total === 0) return "D";
  const perfectRate = perfectCount / Math.max(total, totalNotes);
  const accuracy = calcAccuracy(perfectCount, goodCount, missCount);
  const noMiss = missCount === 0;

  if (perfectRate >= 0.999 && noMiss) return "SSS";
  if (accuracy >= 98 && noMiss) return "SS";
  if (accuracy >= 95) return "S";
  if (accuracy >= 90) return "A";
  if (accuracy >= 80) return "B";
  if (accuracy >= 70) return "C";
  return "D";
}

export function calcRecordGrade(record: PlayRecord): Grade {
  const total =
    record.perfectCount + record.goodCount + record.missCount;
  return calcGrade(
    record.perfectCount,
    record.goodCount,
    record.missCount,
    total
  );
}

export function calcRecordAccuracy(record: PlayRecord): number {
  return calcAccuracy(
    record.perfectCount,
    record.goodCount,
    record.missCount
  );
}

export { DEFAULT_KEY_BINDINGS, DEFAULT_BUTTON_LAYOUT, DEFAULT_CONTROL_SETTINGS };

export function getKeyBindings(): KeyBindings {
  return resourceManager.getKeyBindings();
}

export function saveKeyBindings(keyBindings: KeyBindings): void {
  resourceManager.saveKeyBindings(keyBindings);
}

export function getButtonLayout(): ButtonLayout {
  return resourceManager.getButtonLayout();
}

export function saveButtonLayout(layout: ButtonLayout): void {
  resourceManager.saveButtonLayout(layout);
}

export function getControlSettings(): ControlSettings {
  return resourceManager.getControlSettings();
}

export function saveControlSettings(settings: ControlSettings): void {
  resourceManager.saveControlSettings(settings);
}

export function resetControlSettings(): void {
  resourceManager.resetControlSettings();
}

export function validateKeyBinding(key: string, currentBindings: KeyBindings, trackIndex: number): { valid: boolean; error?: string } {
  return resourceManager.validateKeyBinding(key, currentBindings, trackIndex);
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "欢迎来到节奏点击！",
    description: "本教学将带你了解游戏玩法，约 1.5 分钟完成。观察上方四条彩色轨道，音符会从顶部落下。",
    waitMs: 4000,
  },
  {
    id: 2,
    title: "音符下落演示",
    description: "看！音符从上方缓缓落下，目标是在它们到达底部判定线时准确按下对应按键或轨道。",
    autoSpawnPattern: [0, 1, 2, 3, 0, 1, 2, 3],
    autoSpawnInterval: 600,
    waitMs: 6000,
  },
  {
    id: 3,
    title: "操作方式说明",
    description: "键盘：D / F / J / K 对应四条轨道。移动端：直接点击下方彩色按钮或轨道区域即可。",
    waitMs: 4500,
  },
  {
    id: 4,
    title: "Perfect 完美判定",
    description: "在音符正中心到达判定线时按下，获得 PERFECT！得分最高 +300，连击中加成更多。请按下高亮轨道试试！",
    highlightTrack: 0,
    autoSpawnPattern: [0],
    autoSpawnInterval: 1500,
    requireUserAction: true,
  },
  {
    id: 5,
    title: "Good 良好判定",
    description: "时机稍有偏差会判定为 GOOD，得分 +150。继续尝试！",
    highlightTrack: 1,
    autoSpawnPattern: [1],
    autoSpawnInterval: 1500,
    requireUserAction: true,
  },
  {
    id: 6,
    title: "连击 Combo 系统",
    description: "连续命中会累积连击，连击越高分数加成越大。现在连续命中 3 次试试！",
    autoSpawnPattern: [2, 3, 0],
    autoSpawnInterval: 1100,
    requireUserAction: true,
  },
  {
    id: 7,
    title: "长按音符说明",
    description: "部分音符是长条形状的长按音符！在起点按下并保持按住，直到音符尾部到达判定线时再松开，即可完成长按。",
    waitMs: 5000,
  },
  {
    id: 8,
    title: "Miss 漏击与连击中断",
    description: "如果音符飞过判定线未点击则判定 MISS，连击会清零！注意看下方这个音符——故意漏掉它看看。",
    autoSpawnPattern: [1],
    autoSpawnInterval: 800,
    forceMiss: true,
    waitMs: 6500,
  },
  {
    id: 9,
    title: "结算画面含义",
    description: "演奏结束后会显示分数、Perfect/Good/Miss 数量，并分别统计点击音符和长按音符的命中情况。",
    waitMs: 4500,
  },
  {
    id: 10,
    title: "教学完成！",
    description: "恭喜！你已掌握所有玩法，包括点击音符和长按音符。去选择一首歌正式开始挑战吧！",
    waitMs: 3000,
  },
];
