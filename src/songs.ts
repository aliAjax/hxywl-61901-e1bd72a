import type { Song } from "./types";

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
