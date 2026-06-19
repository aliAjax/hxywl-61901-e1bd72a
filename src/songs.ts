import type { Song, PlayRecord } from "./types";

export const songs: Song[] = [
  {
    id: "song-001",
    title: "星辰序曲",
    artist: "Rhythm Studio",
    bpm: 120,
    difficulty: "easy",
    difficultyLevel: 3,
    duration: 95,
    coverColor: "#4f46e5",
    accentColor: "#06b6d4",
    previewPattern: [0, 1, 2, 1, 0, 1, 2, 3],
  },
  {
    id: "song-002",
    title: "夏日浪花",
    artist: "Coastal Beats",
    bpm: 138,
    difficulty: "normal",
    difficultyLevel: 6,
    duration: 112,
    coverColor: "#06b6d4",
    accentColor: "#f97316",
    previewPattern: [1, 0, 2, 1, 3, 2, 0, 1, 2, 3],
  },
  {
    id: "song-003",
    title: "霓虹都市",
    artist: "Neon Dreams",
    bpm: 156,
    difficulty: "hard",
    difficultyLevel: 9,
    duration: 128,
    coverColor: "#f97316",
    accentColor: "#ec4899",
    previewPattern: [0, 2, 1, 3, 0, 2, 3, 1, 2, 0, 3, 1],
  },
  {
    id: "song-004",
    title: "极速风暴",
    artist: "Thunder Pulse",
    bpm: 180,
    difficulty: "expert",
    difficultyLevel: 12,
    duration: 140,
    coverColor: "#ec4899",
    accentColor: "#8b5cf6",
    previewPattern: [0, 3, 1, 2, 3, 0, 2, 1, 3, 2, 0, 1, 3, 0, 2, 1],
  },
  {
    id: "song-005",
    title: "月光漫步",
    artist: "Luna Echo",
    bpm: 100,
    difficulty: "easy",
    difficultyLevel: 2,
    duration: 88,
    coverColor: "#8b5cf6",
    accentColor: "#4f46e5",
    previewPattern: [0, 1, 0, 2, 1, 2, 0, 1],
  },
  {
    id: "song-006",
    title: "电子脉冲",
    artist: "Digital Wave",
    bpm: 145,
    difficulty: "normal",
    difficultyLevel: 7,
    duration: 105,
    coverColor: "#10b981",
    accentColor: "#06b6d4",
    previewPattern: [1, 2, 0, 3, 1, 2, 3, 0, 2, 1],
  },
];

export const difficultyLabels: Record<Song["difficulty"], string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  expert: "专家",
};

export const difficultyColors: Record<Song["difficulty"], string> = {
  easy: "#10b981",
  normal: "#06b6d4",
  hard: "#f97316",
  expert: "#ec4899",
};

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getSongBestScore(songId: string): number {
  return Number(localStorage.getItem(`rhythm-best-${songId}`) || 0);
}

export function saveSongBestScore(songId: string, score: number): void {
  const current = getSongBestScore(songId);
  if (score > current) {
    localStorage.setItem(`rhythm-best-${songId}`, String(score));
  }
}

const RECORDS_KEY = "rhythm-play-records";
const MAX_RECORDS_PER_SONG = 10;

export function getPlayRecords(songId?: string): PlayRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const all: PlayRecord[] = raw ? JSON.parse(raw) : [];
    if (songId) {
      return all.filter((r) => r.songId === songId);
    }
    return all;
  } catch {
    return [];
  }
}

export function savePlayRecord(record: PlayRecord): void {
  const all = getPlayRecords();
  all.push(record);
  const grouped: Record<string, PlayRecord[]> = {};
  for (const r of all) {
    if (!grouped[r.songId]) grouped[r.songId] = [];
    grouped[r.songId].push(r);
  }
  const trimmed: PlayRecord[] = [];
  for (const key of Object.keys(grouped)) {
    const records = grouped[key].sort((a, b) => b.completedAt - a.completedAt);
    trimmed.push(...records.slice(0, MAX_RECORDS_PER_SONG));
  }
  localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed));
}

export const TUTORIAL_KEY = "rhythm-tutorial-completed";

export function isTutorialCompleted(): boolean {
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function markTutorialCompleted(): void {
  localStorage.setItem(TUTORIAL_KEY, "1");
}

export function resetTutorialStatus(): void {
  localStorage.removeItem(TUTORIAL_KEY);
}

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

export const tutorialSong: Song = {
  id: "tutorial-song",
  title: "新手练习曲",
  artist: "教学模式",
  bpm: 90,
  difficulty: "easy",
  difficultyLevel: 1,
  duration: 30,
  coverColor: "#4f46e5",
  accentColor: "#06b6d4",
  previewPattern: [0, 1, 2, 3],
};

export const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "欢迎来到节奏点击！",
    description: "本教学将带你了解游戏玩法，约 1 分钟完成。观察上方四条彩色轨道，音符会从顶部落下。",
    waitMs: 4000,
  },
  {
    id: 2,
    title: "音符下落演示",
    description: "看！音符从上方缓缓落下，目标是在它们到达底部判定线时准确按下对应按键。",
    autoSpawnPattern: [0, 1, 2, 3, 0, 1, 2, 3],
    autoSpawnInterval: 600,
    waitMs: 6000,
  },
  {
    id: 3,
    title: "按键操作说明",
    description: "四条轨道分别对应键盘 D（左一）、F（左二）、J（右二）、K（右一），或直接点击下方按钮。",
    waitMs: 4000,
  },
  {
    id: 4,
    title: "Perfect 完美判定",
    description: "在音符正中心到达判定线时按下，获得 PERFECT！得分最高 +300，连击中加成更多。请按下高亮轨道的按键试试！",
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
    title: "Miss 漏击与连击中断",
    description: "如果音符飞过判定线未点击则判定 MISS，连击会清零！注意看下方这个音符——故意漏掉它看看。",
    autoSpawnPattern: [1],
    autoSpawnInterval: 800,
    forceMiss: true,
    waitMs: 6500,
  },
  {
    id: 8,
    title: "结算画面含义",
    description: "演奏结束后会显示：分数、Perfect/Good/Miss 数量、最大连击数。达成新纪录会有特别提示！",
    waitMs: 4000,
  },
  {
    id: 9,
    title: "教学完成！",
    description: "恭喜！你已掌握所有基础玩法，去选择一首歌正式开始挑战吧！",
    waitMs: 3000,
  },
];
