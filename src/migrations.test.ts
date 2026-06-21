import { describe, it, expect, beforeEach } from "vitest";
import type { PlayRecord, CalibrationData, ChartDifficulty } from "./types";
import {
  STORAGE_KEYS,
  makeScoreKey,
  makeChartKey,
  getCurrentVersion,
  isVersionCompatible,
  safeParseJSON,
  migrateLegacyBestScoresPure,
  migrateLegacyRecordsPure,
  migrateLegacyCalibrationPure,
  migrateCalibrationToV2Pure,
  migrateLegacyTutorialPure,
  cleanOrphanedScoresPure,
  defaultSongs,
  CHART_DIFFICULTIES,
} from "./resourceManager";

class MockStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    const v = this.data.get(key);
    return v === undefined ? null : v;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  get size(): number {
    return this.data.size;
  }
}

function createValidPlayRecord(
  overrides: Partial<PlayRecord> = {}
): PlayRecord {
  return {
    songId: defaultSongs[0].id,
    difficulty: "standard",
    score: 10000,
    maxCombo: 50,
    perfectCount: 40,
    goodCount: 8,
    missCount: 2,
    tapPerfectCount: 30,
    tapGoodCount: 5,
    tapMissCount: 1,
    longPerfectCount: 10,
    longGoodCount: 3,
    longMissCount: 1,
    completedAt: 1700000000000,
    ...overrides,
  };
}

describe("migrateLegacyBestScoresPure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("迁移前无任何 legacy 数据，应初始化所有歌曲和难度的分数为 0", () => {
    const result = migrateLegacyBestScoresPure(storage);
    const expectedKeyCount = defaultSongs.length * CHART_DIFFICULTIES.length;
    expect(Object.keys(result).length).toBe(expectedKeyCount);
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        const key = makeScoreKey(song.id, diff);
        expect(result[key]).toBe(0);
      }
    }
  });

  it("legacy 单键 `rhythm-best-{songId}` 分数应迁移到 standard 难度", () => {
    const targetSong = defaultSongs[1];
    const legacyScore = 99999;
    storage.setItem(`rhythm-best-${targetSong.id}`, String(legacyScore));

    const result = migrateLegacyBestScoresPure(storage);
    expect(result[makeScoreKey(targetSong.id, "standard")]).toBe(legacyScore);
    expect(storage.getItem(`rhythm-best-${targetSong.id}`)).toBeNull();
  });

  it("legacy BEST_SCORES 中无分隔符的旧键（songId 直接作键）应转到 standard 难度", () => {
    const targetSong = defaultSongs[2];
    const oldScore = 55555;
    storage.setItem(
      STORAGE_KEYS.BEST_SCORES,
      JSON.stringify({ [targetSong.id]: oldScore })
    );

    const result = migrateLegacyBestScoresPure(storage);
    expect(result[makeScoreKey(targetSong.id, "standard")]).toBe(oldScore);
  });

  it("legacy BEST_SCORES 中已有新格式 `songId__difficulty` 键应保留原值", () => {
    const targetSong = defaultSongs[0];
    const newScore = 88888;
    storage.setItem(
      STORAGE_KEYS.BEST_SCORES,
      JSON.stringify({ [makeScoreKey(targetSong.id, "challenge")]: newScore })
    );

    const result = migrateLegacyBestScoresPure(storage);
    expect(result[makeScoreKey(targetSong.id, "challenge")]).toBe(newScore);
  });

  it("legacy 单键与 BEST_SCORES 新格式同时存在时，BEST_SCORES 应优先覆盖", () => {
    const targetSong = defaultSongs[0];
    storage.setItem(`rhythm-best-${targetSong.id}`, "1000");
    storage.setItem(
      STORAGE_KEYS.BEST_SCORES,
      JSON.stringify({ [makeScoreKey(targetSong.id, "standard")]: 9999 })
    );

    const result = migrateLegacyBestScoresPure(storage);
    expect(result[makeScoreKey(targetSong.id, "standard")]).toBe(9999);
  });

  it("迁移完成后应写入 BEST_SCORES 存储键并可被读取", () => {
    migrateLegacyBestScoresPure(storage);
    const persisted = safeParseJSON<Record<string, number>>(
      storage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    const expectedCount = defaultSongs.length * CHART_DIFFICULTIES.length;
    expect(Object.keys(persisted).length).toBe(expectedCount);
  });

  it("空 BEST_SCORES 和 legacy 单键混合多首歌曲应全部正确迁移", () => {
    for (let i = 0; i < Math.min(3, defaultSongs.length); i++) {
      storage.setItem(
        `rhythm-best-${defaultSongs[i].id}`,
        String((i + 1) * 1000)
      );
    }
    const result = migrateLegacyBestScoresPure(storage);
    for (let i = 0; i < Math.min(3, defaultSongs.length); i++) {
      expect(result[makeScoreKey(defaultSongs[i].id, "standard")]).toBe(
        (i + 1) * 1000
      );
      expect(storage.getItem(`rhythm-best-${defaultSongs[i].id}`)).toBeNull();
    }
  });
});

describe("migrateLegacyRecordsPure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("没有 legacy play-records 数据应返回 null，不产生写入", () => {
    const result = migrateLegacyRecordsPure(storage);
    expect(result).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.PLAY_RECORDS)).toBeNull();
  });

  it("有 legacy play-records 数据时应迁移到新键并补齐缺失的分类统计字段", () => {
    const raw: Partial<PlayRecord>[] = [
      {
        songId: defaultSongs[0].id,
        score: 100,
        maxCombo: 10,
        perfectCount: 5,
        goodCount: 3,
        missCount: 2,
        completedAt: 1700000000000,
      },
    ];
    storage.setItem("rhythm-play-records", JSON.stringify(raw));

    const result = migrateLegacyRecordsPure(storage);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].difficulty).toBe("standard");
    expect(result![0].tapPerfectCount).toBe(0);
    expect(result![0].tapMissCount).toBe(0);
    expect(result![0].longPerfectCount).toBe(0);
    expect(result![0].longMissCount).toBe(0);
    const stored = safeParseJSON<PlayRecord[]>(
      storage.getItem(STORAGE_KEYS.PLAY_RECORDS),
      []
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].difficulty).toBe("standard");
  });

  it("已有 difficulty 的记录应保留原难度，不会被覆盖为 standard", () => {
    const raw: PlayRecord[] = [
      createValidPlayRecord({ difficulty: "challenge" }),
    ];
    storage.setItem("rhythm-play-records", JSON.stringify(raw));
    const result = migrateLegacyRecordsPure(storage);
    expect(result![0].difficulty).toBe("challenge");
  });

  it("已有分类统计字段的记录应保留原值", () => {
    const raw: PlayRecord[] = [
      createValidPlayRecord({
        tapPerfectCount: 99,
        longMissCount: 7,
      }),
    ];
    storage.setItem("rhythm-play-records", JSON.stringify(raw));
    const result = migrateLegacyRecordsPure(storage);
    expect(result![0].tapPerfectCount).toBe(99);
    expect(result![0].longMissCount).toBe(7);
  });

  it("多笔记录迁移后顺序应保持不变", () => {
    const r0 = createValidPlayRecord({ completedAt: 1000, score: 10 });
    const r1 = createValidPlayRecord({ completedAt: 2000, score: 20 });
    const r2 = createValidPlayRecord({ completedAt: 3000, score: 30 });
    storage.setItem(
      "rhythm-play-records",
      JSON.stringify([r0, r1, r2])
    );
    const result = migrateLegacyRecordsPure(storage);
    expect(result).toHaveLength(3);
    expect(result![0].completedAt).toBe(1000);
    expect(result![1].completedAt).toBe(2000);
    expect(result![2].completedAt).toBe(3000);
  });
});

describe("migrateLegacyCalibrationPure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("无 legacy 校准值时不写入任何值", () => {
    migrateLegacyCalibrationPure(storage);
    expect(storage.getItem(STORAGE_KEYS.CALIBRATION)).toBeNull();
  });

  it("legacy 校准值应存在于新键中", () => {
    storage.setItem("rhythm-calibration-offset", "-42");
    migrateLegacyCalibrationPure(storage);
    expect(storage.getItem(STORAGE_KEYS.CALIBRATION)).toBe("-42");
  });
});

describe("migrateCalibrationToV2Pure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("完全无数据时应创建空 V2 结构", () => {
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(0);
    expect(result.perSong).toEqual({});
    const stored = safeParseJSON<CalibrationData | null>(
      storage.getItem(STORAGE_KEYS.CALIBRATION_V2),
      null
    );
    expect(stored).not.toBeNull();
    expect(stored!.global).toBe(0);
    expect(typeof stored!.perSong).toBe("object");
  });

  it("存在 V1 全局校准时应正确提取为 V2 的 global", () => {
    storage.setItem(STORAGE_KEYS.CALIBRATION, "75");
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(75);
    expect(result.perSong).toEqual({});
  });

  it("V1 校准值为非数字时 V2 global 应回退到 0", () => {
    storage.setItem(STORAGE_KEYS.CALIBRATION, "not-a-number");
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(0);
  });

  it("已有合法 V2 数据时不覆盖，直接返回原值", () => {
    const existing: CalibrationData = {
      global: -30,
      perSong: { "song-001": 15, "song-002": -10 },
    };
    storage.setItem(
      STORAGE_KEYS.CALIBRATION,
      "999"
    );
    storage.setItem(
      STORAGE_KEYS.CALIBRATION_V2,
      JSON.stringify(existing)
    );
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(-30);
    expect(result.perSong["song-001"]).toBe(15);
    expect(result.perSong["song-002"]).toBe(-10);
  });

  it("V2 数据损坏（无法解析或缺字段）时应重建", () => {
    storage.setItem(STORAGE_KEYS.CALIBRATION, "25");
    storage.setItem(STORAGE_KEYS.CALIBRATION_V2, "{ broken json!!!");
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(25);
    expect(result.perSong).toEqual({});
  });

  it("V2 数据缺少 global 字段类型时应重建", () => {
    storage.setItem(STORAGE_KEYS.CALIBRATION, "60");
    storage.setItem(
      STORAGE_KEYS.CALIBRATION_V2,
      JSON.stringify({ perSong: {} })
    );
    const result = migrateCalibrationToV2Pure(storage);
    expect(result.global).toBe(60);
  });
});

describe("migrateLegacyTutorialPure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("无 legacy 数据时不写入", () => {
    migrateLegacyTutorialPure(storage);
    expect(storage.getItem(STORAGE_KEYS.TUTORIAL)).toBeNull();
  });

  it("legacy tutorial 状态应保留在新键中", () => {
    storage.setItem("rhythm-tutorial-completed", "1");
    migrateLegacyTutorialPure(storage);
    expect(storage.getItem(STORAGE_KEYS.TUTORIAL)).toBe("1");
  });
});

describe("cleanOrphanedScoresPure", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("完全没有数据时 cleaned 为 false", () => {
    const { cleaned } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(false);
  });

  it("全是合法分数数据时 cleaned 为 false，不修改存储", () => {
    const validSongId = defaultSongs[0].id;
    const validScores: Record<string, number> = {};
    for (const diff of CHART_DIFFICULTIES as ChartDifficulty[]) {
      validScores[makeScoreKey(validSongId, diff)] = 100 + Math.random() * 100;
    }
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(validScores));
    storage.setItem(
      STORAGE_KEYS.PLAY_RECORDS,
      JSON.stringify([createValidPlayRecord()])
    );
    const { cleaned, filteredScores, filteredRecords } =
      cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(false);
    expect(Object.keys(filteredScores).length).toBe(CHART_DIFFICULTIES.length);
    expect(filteredRecords).toHaveLength(1);
  });

  it("不存在的 songId 分数条目应被清理", () => {
    const scores: Record<string, number> = {
      [makeScoreKey(defaultSongs[0].id, "standard")]: 1000,
      [makeScoreKey("nonexistent-song-xyz", "standard")]: 9999,
      [makeScoreKey(defaultSongs[1].id, "challenge")]: 500,
    };
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    const { cleaned, filteredScores } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredScores["nonexistent-song-xyz__standard"]).toBeUndefined();
    expect(Object.keys(filteredScores)).toHaveLength(2);
  });

  it("键格式不合法（无 __ 分隔）的分数应被清理", () => {
    const scores: Record<string, number> = {
      [makeScoreKey(defaultSongs[0].id, "standard")]: 1000,
      "weird-no-separator-key": 999,
    };
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    const { cleaned, filteredScores } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredScores["weird-no-separator-key"]).toBeUndefined();
    expect(Object.keys(filteredScores)).toHaveLength(1);
  });

  it("值为 NaN 或非数字的分数应被清理", () => {
    const scores: Record<string, unknown> = {
      [makeScoreKey(defaultSongs[0].id, "standard")]: 1000,
      [makeScoreKey(defaultSongs[1].id, "standard")]: Number.NaN,
      [makeScoreKey(defaultSongs[2].id, "casual")]: "not-a-number",
    };
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    const { cleaned, filteredScores } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredScores[makeScoreKey(defaultSongs[1].id, "standard")]).toBeUndefined();
    expect(filteredScores[makeScoreKey(defaultSongs[2].id, "casual")]).toBeUndefined();
    expect(Object.keys(filteredScores)).toHaveLength(1);
  });

  it("非法难度后缀的分数键应被 parseChartKey 正确拒绝并清理", () => {
    const scores: Record<string, number> = {
      [makeScoreKey(defaultSongs[0].id, "standard")]: 1000,
      [`${defaultSongs[0].id}__impossible`]: 500,
    };
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    const { cleaned, filteredScores } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredScores[`${defaultSongs[0].id}__impossible`]).toBeUndefined();
    expect(Object.keys(filteredScores)).toHaveLength(1);
  });

  it("不存在 songId 的游玩记录应被清理", () => {
    const records: PlayRecord[] = [
      createValidPlayRecord({ songId: defaultSongs[0].id, score: 100 }),
      createValidPlayRecord({ songId: "ghost-song", score: 999 }),
    ];
    storage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(records));
    const { cleaned, filteredRecords } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredRecords).toHaveLength(1);
    expect(filteredRecords[0].songId).toBe(defaultSongs[0].id);
  });

  it("字段破损的游玩记录应被清理", () => {
    const badRecord: unknown = {
      songId: defaultSongs[0].id,
      score: "oops",
      completedAt: "not-a-number",
    };
    const records: unknown[] = [
      createValidPlayRecord(),
      badRecord,
    ];
    storage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(records));
    const { cleaned, filteredRecords } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);
    expect(filteredRecords).toHaveLength(1);
  });

  it("记录缺少 difficulty 时默认补为 standard 并保留", () => {
    const raw: Partial<PlayRecord> = {
      songId: defaultSongs[0].id,
      score: 5000,
      maxCombo: 10,
      perfectCount: 5,
      goodCount: 3,
      missCount: 2,
      completedAt: 1700000000000,
    };
    storage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify([raw]));
    const { cleaned, filteredRecords } = cleanOrphanedScoresPure(storage);
    expect(filteredRecords).toHaveLength(1);
    expect(filteredRecords[0].difficulty).toBe("standard");
  });

  it("分数和记录同时存在脏数据时应一起清理并写入 BEST_SCORES & PLAY_RECORDS", () => {
    const scores: Record<string, number> = {
      [makeScoreKey(defaultSongs[0].id, "standard")]: 1000,
      "orphan__standard": 999,
    };
    const records: PlayRecord[] = [
      createValidPlayRecord(),
      createValidPlayRecord({ songId: "ghost" }),
    ];
    storage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(scores));
    storage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(records));

    const { cleaned } = cleanOrphanedScoresPure(storage);
    expect(cleaned).toBe(true);

    const storedScores = safeParseJSON<Record<string, number>>(
      storage.getItem(STORAGE_KEYS.BEST_SCORES),
      {}
    );
    const storedRecords = safeParseJSON<PlayRecord[]>(
      storage.getItem(STORAGE_KEYS.PLAY_RECORDS),
      []
    );
    expect(Object.keys(storedScores)).toHaveLength(1);
    expect(storedRecords).toHaveLength(1);
  });
});

describe("版本兼容性组合", () => {
  it("版本号的四项任何一项单独改变都应判定为不兼容", () => {
    const base = getCurrentVersion();
    expect(isVersionCompatible(base)).toBe(true);

    const variants = [
      { ...base, schemaVersion: base.schemaVersion + 1 },
      { ...base, songsVersion: base.songsVersion + 1 },
      { ...base, chartsVersion: base.chartsVersion + 1 },
      { ...base, scoresVersion: base.scoresVersion + 1 },
      { ...base, schemaVersion: base.schemaVersion - 1 },
    ];
    for (const v of variants) {
      expect(isVersionCompatible(v)).toBe(false);
    }
  });

  it("getCurrentVersion 返回值的四项类型均为数字", () => {
    const v = getCurrentVersion();
    for (const key of ["schemaVersion", "songsVersion", "chartsVersion", "scoresVersion"] as const) {
      expect(typeof v[key]).toBe("number");
      expect(Number.isFinite(v[key])).toBe(true);
      expect(v[key]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("存储键名与契约稳定性", () => {
  it("STORAGE_KEYS 前缀和关键名称应稳定，不与 legacy 冲突", () => {
    expect(STORAGE_KEYS.VERSION).toBe("rhythm-resource-version");
    expect(STORAGE_KEYS.SONGS).toBe("rhythm-songs");
    expect(STORAGE_KEYS.CHARTS).toBe("rhythm-charts");
    expect(STORAGE_KEYS.BEST_SCORES).toBe("rhythm-best-scores");
    expect(STORAGE_KEYS.PLAY_RECORDS).toBe("rhythm-play-records");
    expect(STORAGE_KEYS.CALIBRATION).toBe("rhythm-calibration-offset");
    expect(STORAGE_KEYS.CALIBRATION_V2).toBe("rhythm-calibration-data");
    expect(STORAGE_KEYS.TUTORIAL).toBe("rhythm-tutorial-completed");
  });

  it("makeChartKey 与 makeScoreKey 的输出格式应一致（同一首同一难度）", () => {
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        const ck = makeChartKey(song.id, diff);
        const sk = makeScoreKey(song.id, diff);
        expect(ck).toBe(sk);
        expect(ck).toContain("__");
        expect(ck.split("__")).toHaveLength(2);
      }
    }
  });
});
