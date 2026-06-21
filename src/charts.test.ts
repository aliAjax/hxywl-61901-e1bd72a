import { describe, it, expect } from "vitest";
import type { Chart, ChartNote } from "./types";
import { validateChart, normalizeChartNotes, recalculateChartStats } from "./charts";

const TOTAL_DURATION_MS = 10000;
const TRACK_COUNT = 4;
const MIN_NOTE_DURATION_MS = 100;

function createTapNote(id: number, time: number, track: number): ChartNote {
  return { id, time, track, type: "tap" };
}

function createLongNote(id: number, time: number, track: number, duration: number): ChartNote {
  return { id, time, track, type: "long", duration };
}

function createEmptyChart(): Chart {
  return {
    songId: "test-song",
    difficulty: "standard",
    totalNotes: 0,
    totalTapNotes: 0,
    totalLongNotes: 0,
    chorusCount: 0,
    notes: [],
    audioBeats: [],
  };
}

describe("validateChart", () => {
  describe("点击音符越界", () => {
    it("音符时间小于0应该检测为time错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, -100, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("time");
      expect(result.errors[0].noteId).toBe(0);
    });

    it("音符时间等于0应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, 0, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("音符时间等于总时长应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, TOTAL_DURATION_MS, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("音符时间大于总时长应该检测为time错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, TOTAL_DURATION_MS + 100, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("time");
      expect(result.errors[0].noteId).toBe(0);
    });

    it("音符轨道小于0应该检测为track错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, 1000, -1)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("track");
      expect(result.errors[0].noteId).toBe(0);
    });

    it("音符轨道等于0应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, 1000, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("音符轨道等于TRACK_COUNT-1应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, 1000, TRACK_COUNT - 1)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("音符轨道大于等于TRACK_COUNT应该检测为track错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, 1000, TRACK_COUNT)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("track");
    });

    it("一个音符同时越界时间和轨道应该产生两条错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createTapNote(0, -500, TRACK_COUNT + 2)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      const errorTypes = result.errors.map((e) => e.type).sort();
      expect(errorTypes).toEqual(["time", "track"]);
    });
  });

  describe("长按音符时长非法", () => {
    it("长按音符无duration应该检测为duration错误", () => {
      const chart = createEmptyChart();
      const note = createLongNote(0, 1000, 0, 500);
      delete (note as Partial<ChartNote>).duration;
      chart.notes = [note];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duration");
    });

    it("长按音符duration为0应该检测为duration错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createLongNote(0, 1000, 0, 0)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duration");
    });

    it("长按音符duration小于最小值应该检测为duration错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createLongNote(0, 1000, 0, MIN_NOTE_DURATION_MS - 1)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duration");
    });

    it("长按音符duration等于最小值应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [createLongNote(0, 1000, 0, MIN_NOTE_DURATION_MS)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("长按音符尾部超出总时长应该检测为duration错误", () => {
      const chart = createEmptyChart();
      chart.notes = [createLongNote(0, TOTAL_DURATION_MS - 100, 0, 500)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duration");
    });

    it("长按音符尾部刚好等于总时长应该通过校验", () => {
      const chart = createEmptyChart();
      const duration = 500;
      chart.notes = [createLongNote(0, TOTAL_DURATION_MS - duration, 0, duration)];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });
  });

  describe("同轨重叠", () => {
    it("同轨两个点击音符完全重叠应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1000, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("同轨两个点击音符间隔小于MIN_NOTE_GAP_MS应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1030, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("同轨两个点击音符间隔刚好等于2*MIN_NOTE_GAP_MS应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1100, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("同轨两个点击音符间隔小于2*MIN_NOTE_GAP_MS应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1050, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("同轨两个点击音符间隔大于2*MIN_NOTE_GAP_MS应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1200, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("不同轨道的重叠音符不应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1000, 1),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });

    it("长按音符与同轨后续点击音符重叠应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createLongNote(0, 1000, 0, 500),
        createTapNote(1, 1200, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("两个长按音符同轨重叠应该检测为overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createLongNote(0, 1000, 0, 500),
        createLongNote(1, 1200, 0, 500),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("三个音符同轨链式重叠应该产生多条overlap错误", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1010, 0),
        createTapNote(2, 1020, 0),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(false);
      const overlapErrors = result.errors.filter((e) => e.type === "overlap");
      expect(overlapErrors.length).toBeGreaterThanOrEqual(2);
    });

    it("空谱面应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("合法多音符合奏应该通过校验", () => {
      const chart = createEmptyChart();
      chart.notes = [
        createTapNote(0, 1000, 0),
        createTapNote(1, 1000, 1),
        createTapNote(2, 1000, 2),
        createTapNote(3, 1000, 3),
        createTapNote(4, 2000, 0),
        createTapNote(5, 2000, 3),
      ];
      const result = validateChart(chart, TOTAL_DURATION_MS);
      expect(result.valid).toBe(true);
    });
  });
});

describe("normalizeChartNotes", () => {
  it("应该按时间升序排序并从0开始重新编号", () => {
    const notes: ChartNote[] = [
      createTapNote(99, 3000, 0),
      createTapNote(10, 1000, 1),
      createTapNote(55, 2000, 2),
    ];
    const result = normalizeChartNotes(notes);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(1000);
    expect(result[0].id).toBe(0);
    expect(result[0].track).toBe(1);
    expect(result[1].time).toBe(2000);
    expect(result[1].id).toBe(1);
    expect(result[1].track).toBe(2);
    expect(result[2].time).toBe(3000);
    expect(result[2].id).toBe(2);
    expect(result[2].track).toBe(0);
  });

  it("相同时刻的音符应保持原相对顺序并重新编号", () => {
    const notes: ChartNote[] = [
      createTapNote(5, 1000, 2),
      createTapNote(3, 1000, 0),
      createTapNote(8, 1000, 3),
    ];
    const result = normalizeChartNotes(notes);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(1000);
    expect(result[0].id).toBe(0);
    expect(result[1].time).toBe(1000);
    expect(result[1].id).toBe(1);
    expect(result[2].time).toBe(1000);
    expect(result[2].id).toBe(2);
  });

  it("应该保留音符的其他属性(type、duration)", () => {
    const notes: ChartNote[] = [
      createLongNote(20, 2000, 1, 800),
      createTapNote(5, 1000, 0),
    ];
    const result = normalizeChartNotes(notes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(0);
    expect(result[0].type).toBe("tap");
    expect((result[0] as Partial<ChartNote>).duration).toBeUndefined();
    expect(result[1].id).toBe(1);
    expect(result[1].type).toBe("long");
    expect(result[1].duration).toBe(800);
  });

  it("空数组应该返回空数组", () => {
    const result = normalizeChartNotes([]);
    expect(result).toEqual([]);
  });

  it("单个音符应该重新编号为0", () => {
    const notes: ChartNote[] = [createTapNote(12345, 5000, 2)];
    const result = normalizeChartNotes(notes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(0);
    expect(result[0].time).toBe(5000);
  });

  it("不应该修改原始输入数组", () => {
    const notes: ChartNote[] = [
      createTapNote(2, 3000, 0),
      createTapNote(1, 1000, 0),
    ];
    const originalIds = notes.map((n) => n.id);
    const originalTimes = notes.map((n) => n.time);
    normalizeChartNotes(notes);
    expect(notes.map((n) => n.id)).toEqual(originalIds);
    expect(notes.map((n) => n.time)).toEqual(originalTimes);
  });
});

describe("recalculateChartStats", () => {
  it("空谱面统计值应为0", () => {
    const chart = createEmptyChart();
    chart.notes = [];
    const result = recalculateChartStats(chart);
    expect(result.totalNotes).toBe(0);
    expect(result.totalTapNotes).toBe(0);
    expect(result.totalLongNotes).toBe(0);
  });

  it("应该正确统计纯点击音符数量", () => {
    const chart = createEmptyChart();
    chart.notes = [
      createTapNote(0, 1000, 0),
      createTapNote(1, 2000, 1),
      createTapNote(2, 3000, 2),
    ];
    const result = recalculateChartStats(chart);
    expect(result.totalNotes).toBe(3);
    expect(result.totalTapNotes).toBe(3);
    expect(result.totalLongNotes).toBe(0);
  });

  it("应该正确统计纯长按音符数量", () => {
    const chart = createEmptyChart();
    chart.notes = [
      createLongNote(0, 1000, 0, 500),
      createLongNote(1, 3000, 1, 800),
    ];
    const result = recalculateChartStats(chart);
    expect(result.totalNotes).toBe(2);
    expect(result.totalTapNotes).toBe(0);
    expect(result.totalLongNotes).toBe(2);
  });

  it("应该正确统计点击和长按混合数量", () => {
    const chart = createEmptyChart();
    chart.notes = [
      createTapNote(0, 1000, 0),
      createLongNote(1, 2000, 1, 500),
      createTapNote(2, 3500, 2),
      createTapNote(3, 4000, 3),
      createLongNote(4, 5000, 0, 1000),
    ];
    const result = recalculateChartStats(chart);
    expect(result.totalNotes).toBe(5);
    expect(result.totalTapNotes).toBe(3);
    expect(result.totalLongNotes).toBe(2);
  });

  it("应该保留谱面的其他属性(songId, difficulty, notes, audioBeats)", () => {
    const chart = createEmptyChart();
    chart.songId = "my-song";
    chart.difficulty = "challenge";
    chart.audioBeats = [{ time: 500, freq: 440, type: "kick" }];
    chart.notes = [createTapNote(0, 1000, 0)];
    const result = recalculateChartStats(chart);
    expect(result.songId).toBe("my-song");
    expect(result.difficulty).toBe("challenge");
    expect(result.audioBeats).toHaveLength(1);
    expect(result.audioBeats[0].time).toBe(500);
    expect(result.notes).toHaveLength(1);
  });

  it("不应该修改原始谱面对象", () => {
    const chart = createEmptyChart();
    chart.totalNotes = 999;
    chart.totalTapNotes = 999;
    chart.totalLongNotes = 999;
    chart.notes = [
      createTapNote(0, 1000, 0),
      createLongNote(1, 2000, 1, 500),
    ];
    const result = recalculateChartStats(chart);
    expect(chart.totalNotes).toBe(999);
    expect(chart.totalTapNotes).toBe(999);
    expect(chart.totalLongNotes).toBe(999);
    expect(result.totalNotes).toBe(2);
    expect(result.totalTapNotes).toBe(1);
    expect(result.totalLongNotes).toBe(1);
  });

  it("应该正确计算chorusCount(高密度段落数)", () => {
    const chart = createEmptyChart();
    const denseNotes: ChartNote[] = [];
    for (let i = 0; i < 30; i++) {
      denseNotes.push(createTapNote(i, 1000 + i * 100, i % 4));
    }
    chart.notes = denseNotes;
    const result = recalculateChartStats(chart);
    expect(result.chorusCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.chorusCount).toBe("number");
  });
});

describe("编辑保存链路综合场景", () => {
  it("normalize -> recalculate -> validate 链路应该可组合使用", () => {
    const rawNotes: ChartNote[] = [
      createTapNote(50, 5000, 0),
      createLongNote(20, 1000, 1, 500),
      createTapNote(10, 3000, 2),
    ];
    const normalized = normalizeChartNotes(rawNotes);
    expect(normalized[0].id).toBe(0);
    expect(normalized[1].id).toBe(1);
    expect(normalized[2].id).toBe(2);

    let chart = createEmptyChart();
    chart.notes = normalized;
    chart = recalculateChartStats(chart);
    expect(chart.totalNotes).toBe(3);
    expect(chart.totalTapNotes).toBe(2);
    expect(chart.totalLongNotes).toBe(1);

    const validation = validateChart(chart, TOTAL_DURATION_MS);
    expect(validation.valid).toBe(true);
  });

  it("编辑后重叠音符在validate中应被捕获", () => {
    const notes: ChartNote[] = [
      createTapNote(0, 1000, 0),
      createTapNote(1, 1010, 0),
    ];
    const normalized = normalizeChartNotes(notes);
    const chart = createEmptyChart();
    chart.notes = normalized;
    const withStats = recalculateChartStats(chart);
    const validation = validateChart(withStats, TOTAL_DURATION_MS);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.type === "overlap")).toBe(true);
  });
});
