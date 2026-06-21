import { describe, it, expect } from "vitest";
import type {
  Song,
  Chart,
  PlayRecord,
  BestPlaySummary,
  ResourceVersion,
  ChartDifficulty,
  ChartNote,
} from "./types";
import {
  makeChartKey,
  parseChartKey,
  getCurrentVersion,
  isVersionCompatible,
  safeParseJSON,
  isValidSong,
  isValidChart,
  isValidPlayRecord,
  isValidBestPlaySummary,
  defaultSongs,
  CHART_DIFFICULTIES,
} from "./resourceManager";

function createValidSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "test-001",
    title: "测试曲目",
    artist: "测试艺术家",
    bpm: 120,
    difficulty: "normal",
    difficultyLevel: 5,
    duration: 100,
    coverColor: "#000000",
    accentColor: "#ffffff",
    previewPattern: [0, 1, 2, 3],
    ...overrides,
  };
}

function createValidChart(overrides: Partial<Chart> = {}): Chart {
  const notes: ChartNote[] = [
    { id: 0, time: 1000, track: 0, type: "tap" },
    { id: 1, time: 2000, track: 1, type: "long", duration: 500 },
  ];
  return {
    songId: "test-001",
    difficulty: "standard",
    totalNotes: 2,
    totalTapNotes: 1,
    totalLongNotes: 1,
    chorusCount: 0,
    notes,
    audioBeats: [{ time: 1000, freq: 440, type: "kick" }],
    ...overrides,
  };
}

function createValidPlayRecord(overrides: Partial<PlayRecord> = {}): PlayRecord {
  return {
    songId: "test-001",
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
    completedAt: Date.now(),
    ...overrides,
  };
}

function createValidBestPlaySummary(
  overrides: Partial<BestPlaySummary> = {}
): BestPlaySummary {
  return {
    songId: "test-001",
    difficulty: "standard",
    score: 50000,
    maxCombo: 100,
    perfectCount: 90,
    goodCount: 8,
    missCount: 2,
    tapPerfectCount: 70,
    tapGoodCount: 6,
    tapMissCount: 1,
    longPerfectCount: 20,
    longGoodCount: 2,
    longMissCount: 1,
    checkpoints: [
      {
        progressPercent: 50,
        elapsedMs: 50000,
        score: 25000,
        combo: 50,
        perfectCount: 45,
        goodCount: 4,
        missCount: 1,
      },
    ],
    completedAt: Date.now(),
    ...overrides,
  };
}

describe("makeChartKey / parseChartKey", () => {
  it("makeChartKey 应为 songId 和 difficulty 生成稳定的键", () => {
    const key1 = makeChartKey("song-a", "standard");
    const key2 = makeChartKey("song-a", "standard");
    expect(key1).toBe(key2);
    expect(key1).toContain("song-a");
    expect(key1).toContain("standard");
  });

  it("不同难度应生成不同键", () => {
    const keys = CHART_DIFFICULTIES.map((d) => makeChartKey("same-song", d));
    const unique = new Set(keys);
    expect(unique.size).toBe(CHART_DIFFICULTIES.length);
  });

  it("parseChartKey 应正确反解合法键", () => {
    const songId = "my-cool-song";
    const difficulty: ChartDifficulty = "challenge";
    const key = makeChartKey(songId, difficulty);
    const parsed = parseChartKey(key);
    expect(parsed).not.toBeNull();
    expect(parsed?.songId).toBe(songId);
    expect(parsed?.difficulty).toBe(difficulty);
  });

  it("parseChartKey 对于缺少分隔符的键应返回 null", () => {
    expect(parseChartKey("songwithoutdifficulty")).toBeNull();
  });

  it("parseChartKey 对于分隔符数量不对应返回 null", () => {
    expect(parseChartKey("a__b__c")).toBeNull();
  });

  it("parseChartKey 对于非法难度应返回 null", () => {
    expect(parseChartKey("song-001__impossible")).toBeNull();
  });

  it("所有默认歌曲和所有难度的键都能正确反解", () => {
    for (const song of defaultSongs) {
      for (const diff of CHART_DIFFICULTIES) {
        const key = makeChartKey(song.id, diff);
        const parsed = parseChartKey(key);
        expect(parsed).not.toBeNull();
        expect(parsed?.songId).toBe(song.id);
        expect(parsed?.difficulty).toBe(diff);
      }
    }
  });
});

describe("getCurrentVersion / isVersionCompatible", () => {
  it("getCurrentVersion 应返回当前版本结构", () => {
    const v = getCurrentVersion();
    expect(typeof v.schemaVersion).toBe("number");
    expect(typeof v.songsVersion).toBe("number");
    expect(typeof v.chartsVersion).toBe("number");
    expect(typeof v.scoresVersion).toBe("number");
  });

  it("当前版本应与自身兼容", () => {
    expect(isVersionCompatible(getCurrentVersion())).toBe(true);
  });

  it("null 版本不应兼容", () => {
    expect(isVersionCompatible(null)).toBe(false);
  });

  it("schemaVersion 不一致应不兼容", () => {
    const v = getCurrentVersion();
    expect(isVersionCompatible({ ...v, schemaVersion: v.schemaVersion + 1 })).toBe(false);
  });

  it("songsVersion 不一致应不兼容", () => {
    const v = getCurrentVersion();
    expect(isVersionCompatible({ ...v, songsVersion: v.songsVersion + 1 })).toBe(false);
  });

  it("chartsVersion 不一致应不兼容", () => {
    const v = getCurrentVersion();
    expect(isVersionCompatible({ ...v, chartsVersion: v.chartsVersion + 1 })).toBe(false);
  });

  it("scoresVersion 不一致应不兼容", () => {
    const v = getCurrentVersion();
    expect(isVersionCompatible({ ...v, scoresVersion: v.scoresVersion + 1 })).toBe(false);
  });
});

describe("safeParseJSON", () => {
  it("解析合法 JSON 字符串应返回对象", () => {
    const obj = { a: 1, b: "x" };
    const result = safeParseJSON(JSON.stringify(obj), null);
    expect(result).toEqual(obj);
  });

  it("输入 null 应返回 fallback", () => {
    const fallback = { ok: true };
    expect(safeParseJSON(null, fallback)).toBe(fallback);
  });

  it("空字符串应返回 fallback", () => {
    expect(safeParseJSON("", 42)).toBe(42);
  });

  it("损坏的 JSON 应返回 fallback 而不抛异常", () => {
    expect(safeParseJSON("{not valid json", "fallback")).toBe("fallback");
  });

  it("泛型类型应正确匹配 fallback", () => {
    const arr: number[] = safeParseJSON<number[]>("oops", [1, 2, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe("isValidSong", () => {
  it("完整合法歌曲应通过校验", () => {
    expect(isValidSong(createValidSong())).toBe(true);
  });

  it("null 不应通过校验", () => {
    expect(isValidSong(null)).toBe(false);
  });

  it("非对象不应通过校验", () => {
    expect(isValidSong(42)).toBe(false);
    expect(isValidSong("string")).toBe(false);
  });

  it("缺少 id 字段不应通过校验", () => {
    const s = createValidSong();
    delete (s as Partial<Song>).id;
    expect(isValidSong(s)).toBe(false);
  });

  it("id 非字符串不应通过校验", () => {
    expect(isValidSong(createValidSong({ id: 123 as unknown as string }))).toBe(false);
  });

  it("缺少 title 字段不应通过校验", () => {
    const s = createValidSong();
    delete (s as Partial<Song>).title;
    expect(isValidSong(s)).toBe(false);
  });

  it("bpm 非数字不应通过校验", () => {
    expect(isValidSong(createValidSong({ bpm: "fast" as unknown as number }))).toBe(false);
  });

  it("previewPattern 非数组不应通过校验", () => {
    expect(isValidSong(createValidSong({ previewPattern: "not array" as unknown as number[] }))).toBe(false);
  });

  it("默认歌曲列表全部应通过校验", () => {
    for (const song of defaultSongs) {
      expect(isValidSong(song)).toBe(true);
    }
  });
});

describe("isValidChart", () => {
  it("完整合法谱面应通过校验", () => {
    expect(isValidChart(createValidChart())).toBe(true);
  });

  it("缺少 songId 不应通过校验", () => {
    const c = createValidChart();
    delete (c as Partial<Chart>).songId;
    expect(isValidChart(c)).toBe(false);
  });

  it("totalNotes 非数字不应通过校验", () => {
    expect(isValidChart(createValidChart({ totalNotes: "many" as unknown as number }))).toBe(false);
  });

  it("notes 非数组不应通过校验", () => {
    expect(isValidChart(createValidChart({ notes: "not array" as unknown as ChartNote[] }))).toBe(false);
  });

  it("audioBeats 非数组不应通过校验", () => {
    expect(isValidChart(createValidChart({ audioBeats: null as unknown as Chart["audioBeats"] }))).toBe(false);
  });

  it("允许 difficulty 为 undefined（向后兼容）", () => {
    const c = createValidChart();
    delete (c as Partial<Chart>).difficulty;
    expect(isValidChart(c)).toBe(true);
  });
});

describe("isValidPlayRecord", () => {
  it("完整合法游玩记录应通过校验", () => {
    expect(isValidPlayRecord(createValidPlayRecord())).toBe(true);
  });

  it("缺少 songId 不应通过校验", () => {
    const r = createValidPlayRecord();
    delete (r as Partial<PlayRecord>).songId;
    expect(isValidPlayRecord(r)).toBe(false);
  });

  it("score 非数字不应通过校验", () => {
    expect(isValidPlayRecord(createValidPlayRecord({ score: "high" as unknown as number }))).toBe(false);
  });

  it("completedAt 非数字不应通过校验", () => {
    expect(isValidPlayRecord(createValidPlayRecord({ completedAt: "now" as unknown as number }))).toBe(false);
  });

  it("允许 difficulty 为 undefined（向后兼容）", () => {
    const r = createValidPlayRecord();
    delete (r as Partial<PlayRecord>).difficulty;
    expect(isValidPlayRecord(r)).toBe(true);
  });

  it("缺少分类统计(tapPerfectCount等)仍可通过（老版本数据兼容）", () => {
    const r = createValidPlayRecord();
    delete (r as Partial<PlayRecord>).tapPerfectCount;
    delete (r as Partial<PlayRecord>).longMissCount;
    expect(isValidPlayRecord(r)).toBe(true);
  });
});

describe("isValidBestPlaySummary", () => {
  it("完整合法最佳成绩摘要应通过校验", () => {
    expect(isValidBestPlaySummary(createValidBestPlaySummary())).toBe(true);
  });

  it("缺少 score 不应通过校验", () => {
    const s = createValidBestPlaySummary();
    delete (s as Partial<BestPlaySummary>).score;
    expect(isValidBestPlaySummary(s)).toBe(false);
  });

  it("tapPerfectCount 非数字不应通过校验", () => {
    expect(
      isValidBestPlaySummary(
        createValidBestPlaySummary({ tapPerfectCount: "x" as unknown as number })
      )
    ).toBe(false);
  });

  it("checkpoints 非数组不应通过校验", () => {
    expect(
      isValidBestPlaySummary(
        createValidBestPlaySummary({ checkpoints: "bad" as unknown as BestPlaySummary["checkpoints"] })
      )
    ).toBe(false);
  });

  it("允许 difficulty 为 undefined（向后兼容）", () => {
    const s = createValidBestPlaySummary();
    delete (s as Partial<BestPlaySummary>).difficulty;
    expect(isValidBestPlaySummary(s)).toBe(true);
  });
});
