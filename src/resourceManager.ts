import type {
  Song,
  PlayRecord,
  Chart,
  ChartNote,
  NoteType,
  ResourceVersion,
  ResourceIntegrityReport,
  ResourceInitResult,
} from "./types";

const CURRENT_SCHEMA_VERSION = 1;
const CURRENT_SONGS_VERSION = 1;
const CURRENT_CHARTS_VERSION = 1;
const CURRENT_SCORES_VERSION = 1;

const STORAGE_KEYS = {
  VERSION: "rhythm-resource-version",
  SONGS: "rhythm-songs",
  CHARTS: "rhythm-charts",
  BEST_SCORES: "rhythm-best-scores",
  PLAY_RECORDS: "rhythm-play-records",
  CALIBRATION: "rhythm-calibration-offset",
  TUTORIAL: "rhythm-tutorial-completed",
} as const;

const TRACK_COUNT = 4;
const MELODY_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const MAX_RECORDS_PER_SONG = 10;

export const defaultSongs: Song[] = [
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

function buildChartForSong(song: Song): Chart {
  const rng = new SeededRandom(song.id);
  const notes: ChartNote[] = [];
  const audioBeats: Chart["audioBeats"] = [];
  const beatMs = 60000 / song.bpm;
  const totalDuration = song.duration * 1000;

  const noteDensity = Math.min(
    1,
    0.12 + song.difficultyLevel * 0.065
  );
  const doubleChance = Math.min(0.5, song.difficultyLevel * 0.04);
  const longNoteChance = Math.min(0.35, 0.05 + song.difficultyLevel * 0.03);
  const introMs = 2000;
  const outroMs = 2000;
  let noteId = 0;

  const subdivision = song.difficultyLevel <= 3 ? 2 : song.difficultyLevel <= 7 ? 4 : 8;
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
      spawnNote = rng.next() < noteDensity * 0.8;
    } else {
      spawnNote = rng.next() < noteDensity * 0.35;
    }

    if (spawnNote) {
      const baseTrack = pattern[Math.floor(noteId / 2) % pattern.length];
      let track = baseTrack;
      if (!onStrongBeat && rng.next() < 0.3) {
        track = (track + 1 + rng.nextInt(0, 1)) % TRACK_COUNT;
      }

      if (skipUntil[track] && t < skipUntil[track]) {
        continue;
      }

      let noteType: NoteType = "tap";
      let noteDuration: number | undefined = undefined;

      if (onStrongBeat && rng.next() < longNoteChance) {
        noteType = "long";
        noteDuration = longDurations[rng.nextInt(0, longDurations.length - 1)];
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

  return {
    songId: song.id,
    totalNotes: notes.length,
    totalTapNotes,
    totalLongNotes,
    notes,
    audioBeats: audioBeats.sort((a, b) => a.time - b.time),
  };
}

function getCurrentVersion(): ResourceVersion {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    songsVersion: CURRENT_SONGS_VERSION,
    chartsVersion: CURRENT_CHARTS_VERSION,
    scoresVersion: CURRENT_SCORES_VERSION,
  };
}

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isValidSong(song: unknown): song is Song {
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

function isValidChart(chart: unknown): chart is Chart {
  if (!chart || typeof chart !== "object") return false;
  const c = chart as Record<string, unknown>;
  return (
    typeof c.songId === "string" &&
    typeof c.totalNotes === "number" &&
    typeof c.totalTapNotes === "number" &&
    typeof c.totalLongNotes === "number" &&
    Array.isArray(c.notes) &&
    Array.isArray(c.audioBeats)
  );
}

function isValidPlayRecord(record: unknown): record is PlayRecord {
  if (!record || typeof record !== "object") return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.songId === "string" &&
    typeof r.score === "number" &&
    typeof r.maxCombo === "number" &&
    typeof r.perfectCount === "number" &&
    typeof r.goodCount === "number" &&
    typeof r.missCount === "number" &&
    typeof r.completedAt === "number"
  );
}

class ResourceManager {
  private memoryCache: {
    songs: Song[] | null;
    charts: Record<string, Chart>;
    bestScores: Record<string, number>;
    playRecords: PlayRecord[];
    version: ResourceVersion | null;
  } = {
    songs: null,
    charts: {},
    bestScores: {},
    playRecords: [],
    version: null,
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

  private isVersionCompatible(stored: ResourceVersion | null): boolean {
    if (!stored) return false;
    return (
      stored.schemaVersion === CURRENT_SCHEMA_VERSION &&
      stored.songsVersion === CURRENT_SONGS_VERSION &&
      stored.chartsVersion === CURRENT_CHARTS_VERSION &&
      stored.scoresVersion === CURRENT_SCORES_VERSION
    );
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
    if (!this.isVersionCompatible(storedVersion)) {
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
      report.missingCharts = defaultSongs.map((s) => s.id);
    } else {
      const parsed = safeParseJSON<Record<string, Chart>>(rawCharts, {});
      for (const def of defaultSongs) {
        const found = parsed[def.id];
        if (!found) {
          report.ok = false;
          report.missingCharts.push(def.id);
        } else if (!isValidChart(found)) {
          report.ok = false;
          report.corruptedCharts.push(def.id);
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
      charts[song.id] = buildChartForSong(song);
    }
    localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(charts));
    this.memoryCache.charts = { ...charts };
  }

  private writeDefaultBestScores(): void {
    const scores: Record<string, number> = {};
    for (const song of defaultSongs) {
      scores[song.id] = 0;
    }
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    this.memoryCache.bestScores = { ...scores };
  }

  private migrateLegacyBestScores(): void {
    const scores: Record<string, number> = {};
    for (const song of defaultSongs) {
      const legacyKey = `rhythm-best-${song.id}`;
      const legacy = Number(localStorage.getItem(legacyKey) || 0);
      scores[song.id] = legacy;
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
    }
    const existing = safeParseJSON<Record<string, number>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    const merged = { ...scores, ...existing };
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(merged));
    this.memoryCache.bestScores = { ...merged };
  }

  private migrateLegacyRecords(): void {
    const legacyKey = "rhythm-play-records";
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      const parsed = safeParseJSON<PlayRecord[]>(raw, []);
      const normalized: PlayRecord[] = parsed.map((r) => ({
        songId: r.songId,
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
      localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(normalized));
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
      this.memoryCache.playRecords = normalized;
    }
  }

  private migrateLegacyCalibration(): void {
    const legacyKey = "rhythm-calibration-offset";
    const raw = localStorage.getItem(legacyKey);
    if (raw !== null) {
      localStorage.setItem(STORAGE_KEYS.CALIBRATION, raw);
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
    }
  }

  private migrateLegacyTutorial(): void {
    const legacyKey = "rhythm-tutorial-completed";
    const raw = localStorage.getItem(legacyKey);
    if (raw !== null) {
      localStorage.setItem(STORAGE_KEYS.TUTORIAL, raw);
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
    }
  }

  private cleanOrphanedScores(): boolean {
    let cleaned = false;
    const validSongIds = new Set(defaultSongs.map((s) => s.id));

    const scores = safeParseJSON<Record<string, number>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    const filteredScores: Record<string, number> = {};
    for (const key of Object.keys(scores)) {
      if (validSongIds.has(key) && typeof scores[key] === "number" && !Number.isNaN(scores[key])) {
        filteredScores[key] = scores[key];
      } else {
        cleaned = true;
      }
    }
    if (cleaned) {
      localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(filteredScores));
      this.memoryCache.bestScores = filteredScores;
    }

    const records = safeParseJSON<PlayRecord[]>(
      localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS),
      []
    );
    const filteredRecords: PlayRecord[] = [];
    for (const r of records) {
      if (validSongIds.has(r.songId) && isValidPlayRecord(r)) {
        filteredRecords.push(r);
      } else {
        cleaned = true;
      }
    }
    if (cleaned || records.length !== filteredRecords.length) {
      localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(filteredRecords));
      this.memoryCache.playRecords = filteredRecords;
    }

    return cleaned;
  }

  clearAllCache(): void {
    localStorage.removeItem(STORAGE_KEYS.SONGS);
    localStorage.removeItem(STORAGE_KEYS.CHARTS);
    localStorage.removeItem(STORAGE_KEYS.BEST_SCORES);
    localStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL);

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
      playRecords: [],
      version: null,
    };
    this.initialized = false;
  }

  resetScores(): void {
    this.writeDefaultBestScores();
    localStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    this.memoryCache.playRecords = [];
  }

  resetSettings(): void {
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL);
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
      const preserved = preservedScores[song.id];
      mergedScores[song.id] =
        typeof preserved === "number" && !Number.isNaN(preserved) ? preserved : 0;
    }
    for (const key of Object.keys(preservedScores)) {
      if (!mergedScores.hasOwnProperty(key) && validSongIds.has(key)) {
        const val = preservedScores[key];
        if (typeof val === "number" && !Number.isNaN(val)) {
          mergedScores[key] = val;
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

  getChart(songId: string): Chart {
    this.ensureInitialized();
    if (!this.memoryCache.charts[songId]) {
      const all = safeParseJSON<Record<string, Chart>>(
        localStorage.getItem(STORAGE_KEYS.CHARTS),
        {}
      );
      if (all[songId] && isValidChart(all[songId])) {
        this.memoryCache.charts[songId] = all[songId];
      } else {
        const song = this.getSongById(songId);
        if (song) {
          const chart = buildChartForSong(song);
          all[songId] = chart;
          localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(all));
          this.memoryCache.charts[songId] = chart;
        } else {
          throw new Error(`Song not found: ${songId}`);
        }
      }
    }
    return this.memoryCache.charts[songId];
  }

  rebuildChart(songId: string): Chart {
    const song = this.getSongById(songId);
    if (!song) {
      throw new Error(`Song not found: ${songId}`);
    }
    const chart = buildChartForSong(song);
    const all = safeParseJSON<Record<string, Chart>>(
      localStorage.getItem(STORAGE_KEYS.CHARTS),
      {}
    );
    all[songId] = chart;
    localStorage.setItem(STORAGE_KEYS.CHARTS, JSON.stringify(all));
    this.memoryCache.charts[songId] = chart;
    return chart;
  }

  getBestScore(songId: string): number {
    this.ensureInitialized();
    if (typeof this.memoryCache.bestScores[songId] !== "number") {
      const all = safeParseJSON<Record<string, number>>(
        localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
        {}
      );
      this.memoryCache.bestScores = all;
    }
    return this.memoryCache.bestScores[songId] || 0;
  }

  saveBestScore(songId: string, score: number): boolean {
    this.ensureInitialized();
    const current = this.getBestScore(songId);
    if (score <= current) return false;
    const all = safeParseJSON<Record<string, number>>(
      localStorage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    all[songId] = Math.floor(score);
    localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(all));
    this.memoryCache.bestScores[songId] = Math.floor(score);
    return true;
  }

  getPlayRecords(songId?: string): PlayRecord[] {
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
      tapPerfectCount: r.tapPerfectCount ?? 0,
      tapGoodCount: r.tapGoodCount ?? 0,
      tapMissCount: r.tapMissCount ?? 0,
      longPerfectCount: r.longPerfectCount ?? 0,
      longGoodCount: r.longGoodCount ?? 0,
      longMissCount: r.longMissCount ?? 0,
    }));
    if (songId) {
      return records.filter((r) => r.songId === songId);
    }
    return records;
  }

  savePlayRecord(record: PlayRecord): void {
    this.ensureInitialized();
    const all = this.getPlayRecords();
    all.push({
      ...record,
      tapPerfectCount: record.tapPerfectCount ?? 0,
      tapGoodCount: record.tapGoodCount ?? 0,
      tapMissCount: record.tapMissCount ?? 0,
      longPerfectCount: record.longPerfectCount ?? 0,
      longGoodCount: record.longGoodCount ?? 0,
      longMissCount: record.longMissCount ?? 0,
    });
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
    localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(trimmed));
    this.memoryCache.playRecords = trimmed;
  }

  getCalibrationOffset(): number {
    return Number(localStorage.getItem(STORAGE_KEYS.CALIBRATION) || 0);
  }

  saveCalibrationOffset(offsetMs: number): void {
    localStorage.setItem(STORAGE_KEYS.CALIBRATION, String(Math.round(offsetMs)));
  }

  resetCalibrationOffset(): void {
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
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
