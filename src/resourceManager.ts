import type {
  Song,
  PlayRecord,
  Chart,
  ChartNote,
  NoteType,
  ResourceVersion,
  ResourceIntegrityReport,
  ResourceInitResult,
  CalibrationData,
  EffectiveCalibration,
  ChartDifficulty,
  ChartDifficultyInfo,
  BestPlaySummary,
  ScoreCheckpoint,
  KeyBindings,
  ButtonLayout,
  ControlSettings,
  ReplayData,
} from "./types";

const CURRENT_SCHEMA_VERSION = 2;
const CURRENT_SONGS_VERSION = 1;
const CURRENT_CHARTS_VERSION = 2;
const CURRENT_SCORES_VERSION = 2;

export const CHART_DIFFICULTIES: ChartDifficulty[] = ["casual", "standard", "challenge"];

export const CHART_DIFFICULTY_INFO: Record<ChartDifficulty, ChartDifficultyInfo> = {
  casual: { level: 1, label: "轻松", color: "#10b981" },
  standard: { level: 2, label: "标准", color: "#06b6d4" },
  challenge: { level: 3, label: "挑战", color: "#f97316" },
};

export function makeChartKey(songId: string, difficulty: ChartDifficulty): string {
  return `${songId}__${difficulty}`;
}

export function parseChartKey(key: string): { songId: string; difficulty: ChartDifficulty } | null {
  const parts = key.split("__");
  if (parts.length !== 2) return null;
  const [songId, difficulty] = parts;
  if (!CHART_DIFFICULTIES.includes(difficulty as ChartDifficulty)) return null;
  return { songId, difficulty: difficulty as ChartDifficulty };
}

export function makeScoreKey(songId: string, difficulty: ChartDifficulty): string {
  return `${songId}__${difficulty}`;
}

export const STORAGE_KEYS = {
  VERSION: "rhythm-resource-version",
  SONGS: "rhythm-songs",
  CHARTS: "rhythm-charts",
  CUSTOM_CHARTS: "rhythm-custom-charts",
  BEST_SCORES: "rhythm-best-scores",
  PLAY_RECORDS: "rhythm-play-records",
  BEST_SUMMARIES: "rhythm-best-summaries",
  CALIBRATION: "rhythm-calibration-offset",
  CALIBRATION_V2: "rhythm-calibration-data",
  TUTORIAL: "rhythm-tutorial-completed",
  FAVORITES: "rhythm-favorite-songs",
  CONTROL_SETTINGS: "rhythm-control-settings",
  REPLAY_DATA: "rhythm-replay-data",
} as const;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  track0: "d",
  track1: "f",
  track2: "j",
  track3: "k",
};

export const DEFAULT_BUTTON_LAYOUT: ButtonLayout = "spacious";

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  buttonLayout: DEFAULT_BUTTON_LAYOUT,
};

const TRACK_COUNT = 4;
const MELODY_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const MAX_RECORDS_PER_SONG = 10;

export const syncTestSong: Song = {
  id: "sync-test-001",
  title: "🔧 同步验证测试曲",
  artist: "Audio Sync Engine",
  bpm: 120,
  difficulty: "normal",
  difficultyLevel: 5,
  duration: 180,
  coverColor: "#ef4444",
  accentColor: "#f59e0b",
  previewPattern: [0, 1, 2, 3, 0, 1, 2, 3],
};

export const defaultSongs: Song[] = [
  syncTestSong,
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

class SeededRandom {
  private seed: number;

  constructor(seedString: string) {
    let hash = 2166136261;
    for (let i = 0; i < seedString.length; i++) {
      hash ^= seedString.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    this.seed = hash >>> 0;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function countChorusSections(notes: ChartNote[], totalDuration: number): number {
  const DENSITY_WINDOW_MS = 2000;
  const windows: { time: number; count: number }[] = [];
  const step = DENSITY_WINDOW_MS / 2;
  for (let t = 0; t < totalDuration; t += step) {
    const windowStart = t;
    const windowEnd = t + DENSITY_WINDOW_MS;
    let count = 0;
    for (const note of notes) {
      if (note.time >= windowStart && note.time < windowEnd) {
        count++;
      }
    }
    windows.push({ time: t + DENSITY_WINDOW_MS / 2, count });
  }
  const maxCount = Math.max(...windows.map((w) => w.count), 1);
  const densityData = windows.map((w) => ({
    time: w.time,
    density: w.count / maxCount,
    isPeak: w.count / maxCount > 0.7,
  }));
  const sections: { start: number; end: number }[] = [];
  let inPeak = false;
  let peakStart = 0;
  for (const d of densityData) {
    if (d.isPeak && !inPeak) {
      inPeak = true;
      peakStart = d.time - DENSITY_WINDOW_MS / 2;
    } else if (!d.isPeak && inPeak) {
      inPeak = false;
      sections.push({
        start: peakStart,
        end: d.time - DENSITY_WINDOW_MS / 2,
      });
    }
  }
  if (inPeak) {
    sections.push({
      start: peakStart,
      end: totalDuration,
    });
  }
  return sections.filter((s) => s.end - s.start > DENSITY_WINDOW_MS * 1.5).length;
}

function buildSyncTestChart(song: Song, difficulty: ChartDifficulty): Chart {
  const notes: ChartNote[] = [];
  const audioBeats: Chart["audioBeats"] = [];
  const beatMs = 60000 / song.bpm;
  const totalDuration = song.duration * 1000;
  const introMs = 2000;
  const outroMs = 2000;
  let noteId = 0;

  const diffInfo = CHART_DIFFICULTY_INFO[difficulty];
  const densityMultiplier = diffInfo.level === 1 ? 0.5 : diffInfo.level === 2 ? 1 : 1.4;

  const trackPattern = [0, 1, 2, 3, 0, 1, 2, 3];
  const subdivision = diffInfo.level === 1 ? 2 : diffInfo.level === 2 ? 4 : 4;
  const stepMs = beatMs / subdivision;

  for (let t = introMs; t < totalDuration - outroMs; t += stepMs) {
    const beatIndex = Math.floor(t / beatMs);
    const subIndex = Math.floor((t - beatIndex * beatMs) / stepMs);
    const kickOnBeat = subIndex === 0;
    const snareOnBeat = subIndex === subdivision / 2;
    const hihatOn = subIndex % 2 === 0;

    if (kickOnBeat) {
      audioBeats.push({ time: t, freq: 80, type: "kick" });
    }
    if (snareOnBeat) {
      audioBeats.push({ time: t, freq: 220, type: "snare" });
    }
    if (hihatOn) {
      audioBeats.push({ time: t, freq: 1000, type: "hihat" });
    }

    if (subIndex === 0) {
      const patternIdx = beatIndex % trackPattern.length;
      const track = trackPattern[patternIdx];

      const isCheckpointBeat = beatIndex > 0 && beatIndex % 60 === 0;
      const shouldAdd = Math.random() < densityMultiplier;

      if (isCheckpointBeat && diffInfo.level >= 2) {
        const trCount = diffInfo.level === 3 ? 4 : 2;
        for (let tr = 0; tr < trCount; tr++) {
          notes.push({
            id: noteId++,
            time: Math.round(t),
            track: tr,
            type: "tap",
          });
        }
      } else if (beatIndex % 8 === 0 && beatIndex > 0 && diffInfo.level >= 2 && shouldAdd) {
        notes.push({
          id: noteId++,
          time: Math.round(t),
          track: track,
          type: "long",
          duration: Math.round(beatMs * (diffInfo.level === 3 ? 2 : 1.5)),
        });
      } else if (shouldAdd) {
        notes.push({
          id: noteId++,
          time: Math.round(t),
          track,
          type: "tap",
        });
      }

      const melodyIdx = beatIndex % MELODY_SCALE.length;
      audioBeats.push({
        time: t,
        freq: MELODY_SCALE[melodyIdx] * 2,
        type: "melody",
      });
    } else if (subIndex === 2 && beatIndex % 4 !== 0 && diffInfo.level >= 2 && Math.random() < densityMultiplier) {
      const offbeatTrack = trackPattern[(beatIndex + 2) % trackPattern.length];
      notes.push({
        id: noteId++,
        time: Math.round(t),
        track: offbeatTrack,
        type: "tap",
      });
    } else if (diffInfo.level === 3 && subIndex % 2 === 1 && Math.random() < densityMultiplier * 0.5) {
      const extraTrack = trackPattern[(beatIndex + subIndex) % trackPattern.length];
      notes.push({
        id: noteId++,
        time: Math.round(t),
        track: extraTrack,
        type: "tap",
      });
    }
  }

  const totalTapNotes = notes.filter((n) => n.type === "tap").length;
  const totalLongNotes = notes.filter((n) => n.type === "long").length;
  const chorusCount = countChorusSections(notes, totalDuration);

  return {
    songId: song.id,
    difficulty,
    totalNotes: notes.length,
    totalTapNotes,
    totalLongNotes,
    chorusCount,
    notes,
    audioBeats: audioBeats.sort((a, b) => a.time - b.time),
  };
}

function buildChartForSong(song: Song, difficulty: ChartDifficulty): Chart {
  if (song.id === "sync-test-001") {
    return buildSyncTestChart(song, difficulty);
  }

  const diffInfo = CHART_DIFFICULTY_INFO[difficulty];
  const seedSuffix = diffInfo.level === 1 ? "_casual" : diffInfo.level === 2 ? "_standard" : "_challenge";
  const rng = new SeededRandom(song.id + seedSuffix);
  const notes: ChartNote[] = [];
  const audioBeats: Chart["audioBeats"] = [];
  const beatMs = 60000 / song.bpm;
  const totalDuration = song.duration * 1000;

  const baseDensityLevel = diffInfo.level === 1 ? 2 : diffInfo.level === 2 ? 5 : 9;
  const noteDensity = Math.min(
    1,
    0.1 + baseDensityLevel * 0.07
  );
  const doubleChance = diffInfo.level === 1 ? 0 : diffInfo.level === 2 ? Math.min(0.3, baseDensityLevel * 0.03) : Math.min(0.55, baseDensityLevel * 0.05);
  const longNoteChance = diffInfo.level === 1 ? 0.08 : diffInfo.level === 2 ? 0.18 : Math.min(0.4, 0.1 + baseDensityLevel * 0.03);
  const introMs = 2000;
  const outroMs = 2000;
  let noteId = 0;

  const subdivision = diffInfo.level === 1 ? 2 : diffInfo.level === 2 ? 4 : 8;
  const stepMs = beatMs / subdivision;

  const pattern = song.previewPattern.length > 0 ? song.previewPattern : [0, 1, 2, 3];

  const longDurations = [
    Math.round(beatMs * 1),
    Math.round(beatMs * 1.5),
    Math.round(beatMs * 2),
    Math.round(beatMs * 3),
  ];

  const skipUntil: Record<number, number> = {};

  for (let t = introMs; t < totalDuration - outroMs; t += stepMs) {
    const beatIndex = Math.floor(t / beatMs);
    const subIndex = Math.floor((t - beatIndex * beatMs) / stepMs);
    const kickOnBeat = subIndex === 0;
    const snareOnBeat = subIndex === subdivision / 2 && subdivision >= 2;
    const hihatOn = subIndex % 2 === 0;

    if (kickOnBeat) {
      audioBeats.push({ time: t, freq: 60, type: "kick" });
    }
    if (snareOnBeat) {
      audioBeats.push({ time: t, freq: 200, type: "snare" });
    }
    if (hihatOn) {
      audioBeats.push({ time: t, freq: 800, type: "hihat" });
    }

    const onStrongBeat = subIndex === 0;
    const onMediumBeat = subdivision >= 4 && subIndex % 2 === 0;
    let spawnNote = false;
    if (onStrongBeat) {
      spawnNote = rng.next() < noteDensity * 1.3;
    } else if (onMediumBeat) {
      spawnNote = rng.next() < noteDensity * (diffInfo.level === 1 ? 0.5 : 0.8);
    } else {
      spawnNote = rng.next() < noteDensity * (diffInfo.level === 1 ? 0.15 : diffInfo.level === 2 ? 0.35 : 0.55);
    }

    if (spawnNote) {
      const baseTrack = pattern[Math.floor(noteId / 2) % pattern.length];
      let track = baseTrack;
      if (!onStrongBeat && diffInfo.level >= 2 && rng.next() < 0.3) {
        track = (track + 1 + rng.nextInt(0, 1)) % TRACK_COUNT;
      }

      if (skipUntil[track] && t < skipUntil[track]) {
        continue;
      }

      let noteType: NoteType = "tap";
      let noteDuration: number | undefined = undefined;

      if (onStrongBeat && rng.next() < longNoteChance) {
        noteType = "long";
        const durationIdx = diffInfo.level === 1
          ? rng.nextInt(0, 1)
          : diffInfo.level === 2
          ? rng.nextInt(0, longDurations.length - 2)
          : rng.nextInt(0, longDurations.length - 1);
        noteDuration = longDurations[durationIdx];
        skipUntil[track] = t + noteDuration + stepMs;
      }

      notes.push({
        id: noteId++,
        time: Math.round(t),
        track,
        type: noteType,
        duration: noteDuration,
      });

      if (rng.next() < doubleChance && onStrongBeat && noteType === "tap") {
        const otherTracks = [0, 1, 2, 3].filter((tr) => tr !== track && !(skipUntil[tr] && t < skipUntil[tr]));
        if (otherTracks.length > 0) {
          const otherTrack = otherTracks[rng.nextInt(0, otherTracks.length - 1)];
          notes.push({
            id: noteId++,
            time: Math.round(t),
            track: otherTrack,
            type: "tap",
          });
        }
      }
    }

    if (kickOnBeat) {
      const melodyFreq = MELODY_SCALE[beatIndex % MELODY_SCALE.length];
      audioBeats.push({ time: t, freq: melodyFreq, type: "melody" });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  for (let i = 0; i < notes.length; i++) {
    notes[i].id = i;
  }

  const totalTapNotes = notes.filter((n) => n.type === "tap").length;
  const totalLongNotes = notes.filter((n) => n.type === "long").length;
  const chorusCount = countChorusSections(notes, totalDuration);

  return {
    songId: song.id,
    difficulty,
    totalNotes: notes.length,
    totalTapNotes,
    totalLongNotes,
    chorusCount,
    notes,
    audioBeats: audioBeats.sort((a, b) => a.time - b.time),
  };
}

export function getCurrentVersion(): ResourceVersion {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    songsVersion: CURRENT_SONGS_VERSION,
    chartsVersion: CURRENT_CHARTS_VERSION,
    scoresVersion: CURRENT_SCORES_VERSION,
  };
}

export function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isValidSong(song: unknown): song is Song {
  if (!song || typeof song !== "object") return false;
  const s = song as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.artist === "string" &&
    typeof s.bpm === "number" &&
    typeof s.difficulty === "string" &&
    typeof s.difficultyLevel === "number" &&
    typeof s.duration === "number" &&
    typeof s.coverColor === "string" &&
    typeof s.accentColor === "string" &&
    Array.isArray(s.previewPattern)
  );
}

export function isValidChart(chart: unknown): chart is Chart {
  if (!chart || typeof chart !== "object") return false;
  const c = chart as Record<string, unknown>;
  return (
    typeof c.songId === "string" &&
    (typeof c.difficulty === "string" || c.difficulty === undefined) &&
    typeof c.totalNotes === "number" &&
    typeof c.totalTapNotes === "number" &&
    typeof c.totalLongNotes === "number" &&
    Array.isArray(c.notes) &&
    Array.isArray(c.audioBeats)
  );
}

export function isValidPlayRecord(record: unknown): record is PlayRecord {
  if (!record || typeof record !== "object") return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.songId === "string" &&
    (typeof r.difficulty === "string" || r.difficulty === undefined) &&
    typeof r.score === "number" &&
    typeof r.maxCombo === "number" &&
    typeof r.perfectCount === "number" &&
    typeof r.goodCount === "number" &&
    typeof r.missCount === "number" &&
    typeof r.completedAt === "number"
  );
}

export function isValidBestPlaySummary(summary: unknown): summary is BestPlaySummary {
  if (!summary || typeof summary !== "object") return false;
  const s = summary as Record<string, unknown>;
  return (
    typeof s.songId === "string" &&
    (typeof s.difficulty === "string" || s.difficulty === undefined) &&
    typeof s.score === "number" &&
    typeof s.maxCombo === "number" &&
    typeof s.perfectCount === "number" &&
    typeof s.goodCount === "number" &&
    typeof s.missCount === "number" &&
    typeof s.tapPerfectCount === "number" &&
    typeof s.tapGoodCount === "number" &&
    typeof s.tapMissCount === "number" &&
    typeof s.longPerfectCount === "number" &&
    typeof s.longGoodCount === "number" &&
    typeof s.longMissCount === "number" &&
    Array.isArray(s.checkpoints) &&
    typeof s.completedAt === "number"
  );
}

export function isVersionCompatible(stored: ResourceVersion | null): boolean {
  if (!stored) return false;
  return (
    stored.schemaVersion === CURRENT_SCHEMA_VERSION &&
    stored.songsVersion === CURRENT_SONGS_VERSION &&
    stored.chartsVersion === CURRENT_CHARTS_VERSION &&
    stored.scoresVersion === CURRENT_SCORES_VERSION
  );
}

export function migrateLegacyBestScoresPure(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const song of defaultSongs) {
    for (const diff of CHART_DIFFICULTIES) {
      scores[makeScoreKey(song.id, diff)] = 0;
    }
    const legacyKey = `rhythm-best-${song.id}`;
    const legacy = Number(storage.getItem(legacyKey) || 0);
    if (legacy > 0) {
      scores[makeScoreKey(song.id, "standard")] = legacy;
    }
    try {
      storage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }
  const existing = safeParseJSON<Record<string, number>>(
    storage.getItem(STORAGE_KEYS.BEST_SCORES),
    {}
  );
  for (const key of Object.keys(existing)) {
    if (key.includes("__")) {
      scores[key] = existing[key];
    } else {
      scores[makeScoreKey(key, "standard")] = existing[key];
    }
  }
  storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
  return { ...scores };
}

export function migrateLegacyRecordsPure(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): PlayRecord[] | null {
  const legacyKey = "rhythm-play-records";
  const newKey = STORAGE_KEYS.PLAY_RECORDS;
  const raw = storage.getItem(legacyKey);
  if (!raw) return null;
  const parsed = safeParseJSON<PlayRecord[]>(raw, []);
  const normalized: PlayRecord[] = parsed.map((r) => ({
    songId: r.songId,
    difficulty: r.difficulty ?? "standard",
    score: r.score,
    maxCombo: r.maxCombo,
    perfectCount: r.perfectCount,
    goodCount: r.goodCount,
    missCount: r.missCount,
    tapPerfectCount: r.tapPerfectCount ?? 0,
    tapGoodCount: r.tapGoodCount ?? 0,
    tapMissCount: r.tapMissCount ?? 0,
    longPerfectCount: r.longPerfectCount ?? 0,
    longGoodCount: r.longGoodCount ?? 0,
    longMissCount: r.longMissCount ?? 0,
    completedAt: r.completedAt,
  }));
  storage.setItem(newKey, JSON.stringify(normalized));
  if (legacyKey !== newKey) {
    try {
      storage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function migrateLegacyCalibrationPure(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): void {
  const legacyKey = "rhythm-calibration-offset";
  const newKey = STORAGE_KEYS.CALIBRATION;
  if (legacyKey === newKey) return;
  const raw = storage.getItem(legacyKey);
  if (raw !== null) {
    storage.setItem(newKey, raw);
    try {
      storage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }
}

export function migrateCalibrationToV2Pure(
  storage: Pick<Storage, "getItem" | "setItem">
): CalibrationData {
  const v1Raw = storage.getItem(STORAGE_KEYS.CALIBRATION);
  const v2Raw = storage.getItem(STORAGE_KEYS.CALIBRATION_V2);

  if (v2Raw !== null) {
    try {
      const parsed = JSON.parse(v2Raw);
      if (parsed && typeof parsed.global === "number" && parsed.perSong) {
        return parsed as CalibrationData;
      }
    } catch {
      // invalid v2 data, will rebuild
    }
  }

  let globalOffset = 0;
  if (v1Raw !== null) {
    globalOffset = Number(v1Raw) || 0;
  }

  const v2Data: CalibrationData = {
    global: globalOffset,
    perSong: {},
  };

  storage.setItem(STORAGE_KEYS.CALIBRATION_V2, JSON.stringify(v2Data));
  return v2Data;
}

export function migrateLegacyTutorialPure(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): void {
  const legacyKey = "rhythm-tutorial-completed";
  const newKey = STORAGE_KEYS.TUTORIAL;
  if (legacyKey === newKey) return;
  const raw = storage.getItem(legacyKey);
  if (raw !== null) {
    storage.setItem(newKey, raw);
    try {
      storage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }
}

export function cleanOrphanedScoresPure(
  storage: Pick<Storage, "getItem" | "setItem">
): { cleaned: boolean; filteredScores: Record<string, number>; filteredRecords: PlayRecord[] } {
  let cleaned = false;
  const validSongIds = new Set(defaultSongs.map((s) => s.id));

  const scores = safeParseJSON<Record<string, number>>(
    storage.getItem(STORAGE_KEYS.BEST_SCORES),
    {}
  );
  const filteredScores: Record<string, number> = {};
  for (const key of Object.keys(scores)) {
    let valid = false;
    if (key.includes("__")) {
      const parsed = parseChartKey(key);
      if (parsed && validSongIds.has(parsed.songId) && typeof scores[key] === "number" && !Number.isNaN(scores[key])) {
        valid = true;
      }
    }
    if (valid) {
      filteredScores[key] = scores[key];
    } else {
      cleaned = true;
    }
  }
  if (cleaned) {
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(filteredScores));
  }

  const records = safeParseJSON<PlayRecord[]>(
    storage.getItem(STORAGE_KEYS.PLAY_RECORDS),
    []
  );
  const filteredRecords: PlayRecord[] = [];
  for (const r of records) {
    if (validSongIds.has(r.songId) && isValidPlayRecord(r)) {
      filteredRecords.push({
        ...r,
        difficulty: r.difficulty ?? "standard",
      });
    } else {
      cleaned = true;
    }
  }
  if (cleaned || records.length !== filteredRecords.length) {
    storage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(filteredRecords));
  }

  return { cleaned, filteredScores, filteredRecords };
}

class ResourceManager {
  private memoryCache: {
    songs: Song[] | null;
    charts: Record<string, Chart>;
    bestScores: Record<string, number>;
    bestSummaries: Record<string, BestPlaySummary>;
    playRecords: PlayRecord[];
    version: ResourceVersion | null;
    favoriteSongIds: Set<string>;
  } = {
    songs: null,
    charts: {},
    bestScores: {},
    bestSummaries: {},
    playRecords: [],
    version: null,
    favoriteSongIds: new Set(),
  };

  private initialized = false;

  getVersion(): ResourceVersion {
    return getCurrentVersion();
  }

  private readVersion(): ResourceVersion | null {
    const raw = localStorage.getItem(STORAGE_KEYS.VERSION);
    return safeParseJSON<ResourceVersion | null>(raw, null);
  }

  private writeVersion(version: ResourceVersion): void {
    localStorage.setItem(STORAGE_KEYS.VERSION, JSON.stringify(version));
    this.memoryCache.version = version;
  }

  checkIntegrity(): ResourceIntegrityReport {
    const report: ResourceIntegrityReport = {
      ok: true,
      missingSongs: [],
      missingCharts: [],
      corruptedSongs: [],
      corruptedCharts: [],
      corruptedScores: [],
      versionMismatch: false,
    };

    const storedVersion = this.readVersion();
    if (!isVersionCompatible(storedVersion)) {
      report.ok = false;
      report.versionMismatch = true;
    }

    const rawSongs = localStorage.getItem(STORAGE_KEYS.SONGS);
    if (!rawSongs) {
      report.ok = false;
      report.missingSongs = defaultSongs.map((s) => s.id);
    } else {
      const parsed = safeParseJSON<Song[]>(rawSongs, []);
      for (const def of defaultSongs) {
        const found = parsed.find((p) => p.id === def.id);
        if (!found) {
          report.ok = false;
          report.missingSongs.push(def.id);
        } else if (!isValidSong(found)) {
          report.ok = false;
          report.corruptedSongs.push(def.id);
        }
      }
    }

    const rawCharts = localStorage.getItem(STORAGE_KEYS.CHARTS);
    if (!rawCharts) {
      report.ok = false;
      for (const def of defaultSongs) {
        for (const diff of CHART_DIFFICULTIES) {
          report.missingCharts.push(makeChartKey(def.id, diff));
        }
      }
    } else {
      const parsed = safeParseJSON<Record<string, Chart>>(rawCharts, {});
      for (const def of defaultSongs) {
        for (const diff of CHART_DIFFICULTIES) {
          const key = makeChartKey(def.id, diff);
          const found = parsed[key];
          if (!found) {
            report.ok = false;
            report.missingCharts.push(key);
          } else if (!isValidChart(found)) {
            report.ok = false;
            report.corruptedCharts.push(key);
          }
        }
      }
    }

    const rawScores = localStorage.getItem(STORAGE_KEYS.BEST_SCORES);
    if (rawScores) {
      const parsed = safeParseJSON<Record<string, unknown>>(rawScores, {});
      for (const key of Object.keys(parsed)) {
        if (typeof parsed[key] !== "number" || Number.isNaN(parsed[key])) {
          report.ok = false;
          report.corruptedScores.push(key);
        }
      }
    }

    const rawRecords = localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
    if (rawRecords) {
      const parsed = safeParseJSON<unknown[]>(rawRecords, []);
      for (let i = 0; i < parsed.length; i++) {
        if (!isValidPlayRecord(parsed[i])) {
          report.ok = false;
          report.corruptedScores.push(`record-${i}`);
        }
      }
    }

    return report;
  }

  private writeDefaultSongs(): void {
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(defaultSongs));
    this.memoryCache.songs = [...defaultSongs];
  }

  private writeDefaultCharts(): void {
    const charts: Record<string, Chart> = {};
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        const key = makeChartKey(song.id, diff);
        charts[key] = buildChartForSong(song, diff);
      }
    }
    localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(charts));
    this.memoryCache.charts = { ...charts };
  }

  private writeDefaultBestScores(): void {
    const scores: Record<string, number> = {};
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        scores[makeScoreKey(song.id, diff)] = 0;
      }
    }
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    this.memoryCache.bestScores = { ...scores };
  }

  private migrateLegacyBestScores(): void {
    const result = migrateLegacyBestScoresPure(localStorage);
    this.memoryCache.bestScores = result;
  }

  private migrateLegacyRecords(): void {
    const result = migrateLegacyRecordsPure(localStorage);
    if (result) this.memoryCache.playRecords = result;
  }

  private migrateLegacyCalibration(): void {
    migrateLegacyCalibrationPure(localStorage);
  }

  private migrateCalibrationToV2(): void {
    migrateCalibrationToV2Pure(localStorage);
  }

  private readCalibrationData(): CalibrationData {
    const v2 = migrateCalibrationToV2Pure(localStorage);
    return v2;
  }

  private writeCalibrationData(data: CalibrationData): void {
    localStorage.setItem(STORAGE_KEYS.CALIBRATION_V2, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.CALIBRATION, String(Math.round(data.global)));
  }

  private migrateLegacyTutorial(): void {
    migrateLegacyTutorialPure(localStorage);
  }

  private cleanOrphanedScores(): boolean {
    const { cleaned, filteredScores, filteredRecords } = cleanOrphanedScoresPure(localStorage);
    if (cleaned) {
      this.memoryCache.bestScores = filteredScores;
    }
    this.memoryCache.playRecords = filteredRecords;

    return cleaned;
  }

  clearAllCache(): void {
    localStorage.removeItem(STORAGE_KEYS.SONGS);
    localStorage.removeItem(STORAGE_KEYS.CHARTS);
    localStorage.removeItem(STORAGE_KEYS.BEST_SCORES);
    localStorage.removeItem(STORAGE_KEYS.BEST_SUMMARIES);
    localStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION_V2);
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL);
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    localStorage.removeItem(STORAGE_KEYS.CONTROL_SETTINGS);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("rhythm-")) {
        localStorage.removeItem(key);
      }
    }

    this.memoryCache = {
      songs: null,
      charts: {},
      bestScores: {},
      bestSummaries: {},
      playRecords: [],
      version: null,
      favoriteSongIds: new Set(),
    };
    this.initialized = false;
  }

  resetScores(): void {
    this.writeDefaultBestScores();
    localStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    localStorage.removeItem(STORAGE_KEYS.BEST_SUMMARIES);
    this.memoryCache.playRecords = [];
    this.memoryCache.bestSummaries = {};
  }

  resetSettings(): void {
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION_V2);
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL);
    localStorage.removeItem(STORAGE_KEYS.CONTROL_SETTINGS);
  }

  initialize(): ResourceInitResult {
    const warnings: string[] = [];
    let recoveredFromCorruption = false;
    let cleanedStaleData = false;

    try {
      this.migrateLegacyBestScores();
      this.migrateLegacyRecords();
      this.migrateLegacyCalibration();
      this.migrateLegacyTutorial();
    } catch (e) {
      warnings.push("迁移旧数据时出现异常，已跳过");
    }

    const preservedScores = safeParseJSON<Record<string, number>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    const preservedRecords = safeParseJSON<PlayRecord[]>(
      localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS),
      []
    );

    const integrity = this.checkIntegrity();

    if (integrity.versionMismatch) {
      warnings.push("资源版本不匹配，正在重建歌曲和谱面（保留用户分数）");
      this.writeDefaultSongs();
      this.writeDefaultCharts();
      recoveredFromCorruption = true;
    } else {
      if (integrity.missingSongs.length > 0 || integrity.corruptedSongs.length > 0) {
        warnings.push(
          `修复 ${integrity.missingSongs.length + integrity.corruptedSongs.length} 首歌曲数据`
        );
        this.writeDefaultSongs();
        recoveredFromCorruption = true;
      } else {
        const songs = safeParseJSON<Song[]>(localStorage.getItem(STORAGE_KEYS.SONGS), []);
        this.memoryCache.songs = songs;
      }

      if (integrity.missingCharts.length > 0 || integrity.corruptedCharts.length > 0) {
        warnings.push(
          `修复 ${integrity.missingCharts.length + integrity.corruptedCharts.length} 个谱面数据`
        );
        this.writeDefaultCharts();
        recoveredFromCorruption = true;
      } else {
        const charts = safeParseJSON<Record<string, Chart>>(
          localStorage.getItem(STORAGE_KEYS.CHARTS),
          {}
        );
        this.memoryCache.charts = charts;
      }
    }

    const validSongIds = new Set(defaultSongs.map((s) => s.id));
    const mergedScores: Record<string, number> = {};
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        const key = makeScoreKey(song.id, diff);
        let score = 0;
        const preserved = preservedScores[key];
        if (typeof preserved === "number" && !Number.isNaN(preserved)) {
          score = preserved;
        } else if (diff === "standard") {
          const legacyPreserved = preservedScores[song.id];
          if (typeof legacyPreserved === "number" && !Number.isNaN(legacyPreserved)) {
            score = legacyPreserved;
          }
        }
        mergedScores[key] = score;
      }
    }
    for (const key of Object.keys(preservedScores)) {
      if (!mergedScores.hasOwnProperty(key)) {
        if (key.includes("__")) {
          const parsed = parseChartKey(key);
          if (parsed && validSongIds.has(parsed.songId)) {
            const val = preservedScores[key];
            if (typeof val === "number" && !Number.isNaN(val)) {
              mergedScores[key] = val;
            }
          }
        }
      }
    }
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(mergedScores));
    this.memoryCache.bestScores = mergedScores;

    const validRecords: PlayRecord[] = [];
    for (const r of preservedRecords) {
      if (isValidPlayRecord(r) && validSongIds.has(r.songId)) {
        validRecords.push({
          ...r,
          tapPerfectCount: r.tapPerfectCount ?? 0,
          tapGoodCount: r.tapGoodCount ?? 0,
          tapMissCount: r.tapMissCount ?? 0,
          longPerfectCount: r.longPerfectCount ?? 0,
          longGoodCount: r.longGoodCount ?? 0,
          longMissCount: r.longMissCount ?? 0,
        });
      }
    }
    localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(validRecords));
    this.memoryCache.playRecords = validRecords;

    if (this.cleanOrphanedScores()) {
      cleanedStaleData = true;
      warnings.push("已清理孤立或损坏的分数数据");
    }

    const version = getCurrentVersion();
    this.writeVersion(version);

    this.initialized = true;

    return {
      initialized: true,
      recoveredFromCorruption,
      cleanedStaleData,
      warnings,
      version,
    };
  }

  ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  getSongs(): Song[] {
    this.ensureInitialized();
    if (!this.memoryCache.songs) {
      const songs = safeParseJSON<Song[]>(localStorage.getItem(STORAGE_KEYS.SONGS), defaultSongs);
      this.memoryCache.songs = songs.length > 0 ? songs : [...defaultSongs];
    }
    return [...this.memoryCache.songs];
  }

  getSongById(songId: string): Song | undefined {
    return this.getSongs().find((s) => s.id === songId);
  }

  getChart(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
    this.ensureInitialized();
    const key = makeChartKey(songId, difficulty);
    if (!this.memoryCache.charts[key]) {
      const customCharts = safeParseJSON<Record<string, Chart>>(
        localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS),
        {}
      );
      if (customCharts[key] && isValidChart(customCharts[key])) {
        this.memoryCache.charts[key] = customCharts[key];
      } else {
        const all = safeParseJSON<Record<string, Chart>>(
          localStorage.getItem(STORAGE_KEYS.CHARTS),
          {}
        );
        if (all[key] && isValidChart(all[key])) {
          this.memoryCache.charts[key] = all[key];
        } else {
          const song = this.getSongById(songId);
          if (song) {
            const chart = buildChartForSong(song, difficulty);
            all[key] = chart;
            localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(all));
            this.memoryCache.charts[key] = chart;
          } else {
            throw new Error(`Song not found: ${songId}`);
          }
        }
      }
    }
    return this.memoryCache.charts[key];
  }

  isChartCustom(songId: string, difficulty: ChartDifficulty = "standard"): boolean {
    this.ensureInitialized();
    const key = makeChartKey(songId, difficulty);
    const customCharts = safeParseJSON<Record<string, Chart>>(
      localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS),
      {}
    );
    return !!customCharts[key] && isValidChart(customCharts[key]);
  }

  saveCustomChart(chart: Chart): void {
    this.ensureInitialized();
    const key = makeChartKey(chart.songId, chart.difficulty);
    const customCharts = safeParseJSON<Record<string, Chart>>(
      localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS),
      {}
    );
    customCharts[key] = chart;
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CHARTS, JSON.stringify(customCharts));
    this.memoryCache.charts[key] = chart;
  }

  restoreAutoGeneratedChart(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
    const key = makeChartKey(songId, difficulty);
    const customCharts = safeParseJSON<Record<string, Chart>>(
      localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS),
      {}
    );
    delete customCharts[key];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CHARTS, JSON.stringify(customCharts));
    delete this.memoryCache.charts[key];
    return this.rebuildChart(songId, difficulty);
  }

  getAutoGeneratedChart(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
    const song = this.getSongById(songId);
    if (!song) {
      throw new Error(`Song not found: ${songId}`);
    }
    return buildChartForSong(song, difficulty);
  }

  rebuildChart(songId: string, difficulty: ChartDifficulty = "standard"): Chart {
    const song = this.getSongById(songId);
    if (!song) {
      throw new Error(`Song not found: ${songId}`);
    }
    const chart = buildChartForSong(song, difficulty);
    const key = makeChartKey(songId, difficulty);
    const all = safeParseJSON<Record<string, Chart>>(
      localStorage.getItem(STORAGE_KEYS.CHARTS),
      {}
    );
    all[key] = chart;
    localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(all));
    this.memoryCache.charts[key] = chart;
    return chart;
  }

  rebuildAllChartsForSong(songId: string): void {
    for (const diff of CHART_DIFFICULTIES) {
      this.rebuildChart(songId, diff);
    }
  }

  rebuildAllCharts(): void {
    const songs = this.getSongs();
    for (const s of songs) {
      this.rebuildAllChartsForSong(s.id);
    }
  }

  getBestScore(songId: string, difficulty: ChartDifficulty = "standard"): number {
    this.ensureInitialized();
    const key = makeScoreKey(songId, difficulty);
    if (typeof this.memoryCache.bestScores[key] !== "number") {
      const all = safeParseJSON<Record<string, number>>(
        localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
        {}
      );
      this.memoryCache.bestScores = all;
    }
    return this.memoryCache.bestScores[key] || 0;
  }

  saveBestScore(songId: string, difficulty: ChartDifficulty, score: number): boolean {
    this.ensureInitialized();
    const key = makeScoreKey(songId, difficulty);
    const current = this.getBestScore(songId, difficulty);
    if (score <= current) return false;
    const all = safeParseJSON<Record<string, number>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    all[key] = Math.floor(score);
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(all));
    this.memoryCache.bestScores[key] = Math.floor(score);
    return true;
  }

  getPlayRecords(songId?: string, difficulty?: ChartDifficulty): PlayRecord[] {
    this.ensureInitialized();
    if (this.memoryCache.playRecords.length === 0) {
      const records = safeParseJSON<PlayRecord[]>(
        localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS),
        []
      );
      this.memoryCache.playRecords = records.filter(isValidPlayRecord);
    }
    const records = this.memoryCache.playRecords.map((r) => ({
      ...r,
      difficulty: r.difficulty ?? "standard",
      tapPerfectCount: r.tapPerfectCount ?? 0,
      tapGoodCount: r.tapGoodCount ?? 0,
      tapMissCount: r.tapMissCount ?? 0,
      longPerfectCount: r.longPerfectCount ?? 0,
      longGoodCount: r.longGoodCount ?? 0,
      longMissCount: r.longMissCount ?? 0,
    }));
    if (songId) {
      const filtered = records.filter((r) => r.songId === songId);
      if (difficulty) {
        return filtered.filter((r) => r.difficulty === difficulty);
      }
      return filtered;
    }
    if (difficulty) {
      return records.filter((r) => r.difficulty === difficulty);
    }
    return records;
  }

  savePlayRecord(record: PlayRecord): void {
    this.ensureInitialized();
    const all = this.getPlayRecords();
    all.push({
      ...record,
      difficulty: record.difficulty ?? "standard",
      tapPerfectCount: record.tapPerfectCount ?? 0,
      tapGoodCount: record.tapGoodCount ?? 0,
      tapMissCount: record.tapMissCount ?? 0,
      longPerfectCount: record.longPerfectCount ?? 0,
      longGoodCount: record.longGoodCount ?? 0,
      longMissCount: record.longMissCount ?? 0,
    });
    const grouped: Record<string, PlayRecord[]> = {};
    for (const r of all) {
      const groupKey = `${r.songId}__${r.difficulty ?? "standard"}`;
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(r);
    }
    const trimmed: PlayRecord[] = [];
    for (const key of Object.keys(grouped)) {
      const records = grouped[key].sort((a, b) => b.completedAt - a.completedAt);
      trimmed.push(...records.slice(0, MAX_RECORDS_PER_SONG));
    }
    localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(trimmed));
    this.memoryCache.playRecords = trimmed;
  }

  getBestPlaySummary(songId: string, difficulty: ChartDifficulty = "standard"): BestPlaySummary | null {
    this.ensureInitialized();
    const key = makeScoreKey(songId, difficulty);
    if (this.memoryCache.bestSummaries[key]) {
      return this.memoryCache.bestSummaries[key];
    }
    const all = safeParseJSON<Record<string, BestPlaySummary>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SUMMARIES),
      {}
    );
    this.memoryCache.bestSummaries = all;
    const found = all[key];
    return found && isValidBestPlaySummary(found) ? found : null;
  }

  saveBestPlaySummary(summary: BestPlaySummary): boolean {
    this.ensureInitialized();
    const key = makeScoreKey(summary.songId, summary.difficulty ?? "standard");
    const current = this.getBestPlaySummary(summary.songId, summary.difficulty ?? "standard");
    if (current && summary.score <= current.score) return false;
    const all = safeParseJSON<Record<string, BestPlaySummary>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SUMMARIES),
      {}
    );
    const normalized: BestPlaySummary = {
      ...summary,
      difficulty: summary.difficulty ?? "standard",
      checkpoints: summary.checkpoints ?? [],
    };
    all[key] = normalized;
    localStorage.setItem(STORAGE_KEYS.BEST_SUMMARIES, JSON.stringify(all));
    this.memoryCache.bestSummaries = all;
    return true;
  }

  getCalibrationOffset(): number {
    return this.readCalibrationData().global;
  }

  saveCalibrationOffset(offsetMs: number): void {
    const data = this.readCalibrationData();
    data.global = Math.round(offsetMs);
    this.writeCalibrationData(data);
  }

  resetCalibrationOffset(): void {
    const data = this.readCalibrationData();
    data.global = 0;
    this.writeCalibrationData(data);
  }

  getSongCalibrationOffset(songId: string): number | null {
    const data = this.readCalibrationData();
    const val = data.perSong[songId];
    return typeof val === "number" ? val : null;
  }

  saveSongCalibrationOffset(songId: string, offsetMs: number): void {
    const data = this.readCalibrationData();
    data.perSong[songId] = Math.round(offsetMs);
    this.writeCalibrationData(data);
  }

  resetSongCalibrationOffset(songId: string): void {
    const data = this.readCalibrationData();
    delete data.perSong[songId];
    this.writeCalibrationData(data);
  }

  getEffectiveCalibration(songId?: string | null): EffectiveCalibration {
    const data = this.readCalibrationData();
    if (songId && typeof data.perSong[songId] === "number") {
      return {
        value: data.perSong[songId],
        source: "song",
      };
    }
    return {
      value: data.global,
      source: "global",
    };
  }

  getAllSongCalibrations(): Record<string, number> {
    return { ...this.readCalibrationData().perSong };
  }

  resetAllSongCalibrations(): void {
    const data = this.readCalibrationData();
    data.perSong = {};
    this.writeCalibrationData(data);
  }

  isTutorialCompleted(): boolean {
    return localStorage.getItem(STORAGE_KEYS.TUTORIAL) === "1";
  }

  markTutorialCompleted(): void {
    localStorage.setItem(STORAGE_KEYS.TUTORIAL, "1");
  }

  resetTutorialStatus(): void {
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL);
  }

  getFavoriteSongIds(): string[] {
    this.ensureInitialized();
    if (this.memoryCache.favoriteSongIds.size === 0) {
      const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      const ids = safeParseJSON<string[]>(raw, []);
      this.memoryCache.favoriteSongIds = new Set(ids);
    }
    return [...this.memoryCache.favoriteSongIds];
  }

  isSongFavorite(songId: string): boolean {
    return this.getFavoriteSongIds().includes(songId);
  }

  toggleSongFavorite(songId: string): boolean {
    this.ensureInitialized();
    const ids = this.getFavoriteSongIds();
    const isFav = ids.includes(songId);
    let newIds: string[];
    if (isFav) {
      newIds = ids.filter((id) => id !== songId);
    } else {
      newIds = [...ids, songId];
    }
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newIds));
    this.memoryCache.favoriteSongIds = new Set(newIds);
    return !isFav;
  }

  resetFavorites(): void {
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    this.memoryCache.favoriteSongIds = new Set();
  }

  getControlSettings(): ControlSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTROL_SETTINGS);
    try {
      const parsed = JSON.parse(raw || "{}");
      if (
        parsed &&
        parsed.keyBindings &&
        typeof parsed.keyBindings.track0 === "string" &&
        typeof parsed.keyBindings.track1 === "string" &&
        typeof parsed.keyBindings.track2 === "string" &&
        typeof parsed.keyBindings.track3 === "string" &&
        (parsed.buttonLayout === "compact" || parsed.buttonLayout === "spacious")
      ) {
        return {
          keyBindings: { ...parsed.keyBindings },
          buttonLayout: parsed.buttonLayout,
        };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CONTROL_SETTINGS, keyBindings: { ...DEFAULT_KEY_BINDINGS } };
  }

  saveControlSettings(settings: ControlSettings): void {
    localStorage.setItem(STORAGE_KEYS.CONTROL_SETTINGS, JSON.stringify(settings));
  }

  getKeyBindings(): KeyBindings {
    return { ...this.getControlSettings().keyBindings };
  }

  saveKeyBindings(keyBindings: KeyBindings): void {
    const settings = this.getControlSettings();
    settings.keyBindings = { ...keyBindings };
    this.saveControlSettings(settings);
  }

  getButtonLayout(): ButtonLayout {
    return this.getControlSettings().buttonLayout;
  }

  saveButtonLayout(layout: ButtonLayout): void {
    const settings = this.getControlSettings();
    settings.buttonLayout = layout;
    this.saveControlSettings(settings);
  }

  resetControlSettings(): void {
    localStorage.removeItem(STORAGE_KEYS.CONTROL_SETTINGS);
  }

  validateKeyBinding(key: string, currentBindings: KeyBindings, trackIndex: number): { valid: boolean; error?: string } {
    const trimmed = key.trim().toLowerCase();

    if (!trimmed || trimmed.length === 0) {
      return { valid: false, error: "按键不能为空" };
    }

    if (trimmed.length > 1 && !["space", "enter", "tab", "shift", "control", "alt", "meta", "backspace", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(trimmed)) {
      return { valid: false, error: "请输入单个字符或特殊按键" };
    }

    const blockedKeys = ["escape", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"];
    if (blockedKeys.includes(trimmed)) {
      return { valid: false, error: "该按键为系统保留键，无法绑定" };
    }

    const trackKeys = ["track0", "track1", "track2", "track3"] as const;
    for (let i = 0; i < trackKeys.length; i++) {
      if (i === trackIndex) continue;
      if (currentBindings[trackKeys[i]].toLowerCase() === trimmed) {
        return { valid: false, error: `该按键已绑定到轨道 ${i + 1}` };
      }
    }

    return { valid: true };
  }

  saveReplayData(replay: ReplayData): void {
    this.ensureInitialized();
    const all = safeParseJSON<Record<string, ReplayData>>(
      localStorage.getItem(STORAGE_KEYS.REPLAY_DATA),
      {}
    );
    const key = `${replay.songId}__${replay.difficulty}__${replay.completedAt}`;
    all[key] = replay;
    const keys = Object.keys(all).sort((a, b) => {
      const tA = all[a].completedAt ?? 0;
      const tB = all[b].completedAt ?? 0;
      return tA - tB;
    });
    const maxPerSong = 5;
    const grouped: Record<string, string[]> = {};
    for (const k of keys) {
      const songKey = all[k].songId + "__" + all[k].difficulty;
      if (!grouped[songKey]) grouped[songKey] = [];
      grouped[songKey].push(k);
    }
    const trimmed: Record<string, ReplayData> = {};
    for (const songKey of Object.keys(grouped)) {
      const songKeys = grouped[songKey].slice(-maxPerSong);
      for (const k of songKeys) {
        trimmed[k] = all[k];
      }
    }
    localStorage.setItem(STORAGE_KEYS.REPLAY_DATA, JSON.stringify(trimmed));
  }

  getReplayData(songId: string, difficulty: ChartDifficulty, completedAt: number): ReplayData | null {
    this.ensureInitialized();
    const all = safeParseJSON<Record<string, ReplayData>>(
      localStorage.getItem(STORAGE_KEYS.REPLAY_DATA),
      {}
    );
    const key = `${songId}__${difficulty}__${completedAt}`;
    return all[key] ?? null;
  }

  getReplayDataList(songId: string, difficulty: ChartDifficulty): ReplayData[] {
    this.ensureInitialized();
    const all = safeParseJSON<Record<string, ReplayData>>(
      localStorage.getItem(STORAGE_KEYS.REPLAY_DATA),
      {}
    );
    const results: ReplayData[] = [];
    for (const key of Object.keys(all)) {
      const r = all[key];
      if (r.songId === songId && r.difficulty === difficulty) {
        results.push(r);
      }
    }
    return results.sort((a, b) => b.completedAt - a.completedAt);
  }
}

export const resourceManager = new ResourceManager();

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
