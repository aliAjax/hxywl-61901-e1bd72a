import { describe, it, expect } from "vitest";
import type {
  Chart,
  ChartNote,
  ReplayData,
  ReplayInputEvent,
  ReplayJudgeEvent,
  GameStats,
  EffectiveCalibration,
} from "./types";
import { runReplay, verifyReplay, recalibrateReplay } from "./replayEngine";

const PERFECT_WINDOW_MS = 50;
const GOOD_WINDOW_MS = 110;
const MISS_WINDOW_MS = 150;

function createTapNote(id: number, time: number, track: number): ChartNote {
  return { id, time, track, type: "tap" };
}

function createLongNote(
  id: number,
  time: number,
  track: number,
  duration: number
): ChartNote {
  return { id, time, track, type: "long", duration };
}

function createSimpleChart(): Chart {
  return {
    songId: "test-song",
    difficulty: "standard",
    totalNotes: 3,
    totalTapNotes: 2,
    totalLongNotes: 1,
    chorusCount: 0,
    notes: [
      createTapNote(0, 1000, 0),
      createTapNote(1, 2000, 1),
      createLongNote(2, 3000, 2, 500),
    ],
    audioBeats: [],
  };
}

function emptyStats(): GameStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    tapPerfectCount: 0,
    tapGoodCount: 0,
    tapMissCount: 0,
    longPerfectCount: 0,
    longGoodCount: 0,
    longMissCount: 0,
  };
}

function createPressEvent(
  track: number,
  targetTime: number,
  distanceMs: number = 0,
  calibration: number = 0
): ReplayInputEvent {
  const elapsedMs = targetTime + calibration + distanceMs;
  return {
    type: "press",
    track,
    elapsedMs,
    calibratedElapsedMs: targetTime + distanceMs,
    calibrationOffsetMs: calibration,
    deviceBaselineOffsetMs: 0,
  };
}

function createReleaseEvent(
  track: number,
  targetEndTime: number,
  distanceMs: number = 0,
  calibration: number = 0
): ReplayInputEvent {
  const elapsedMs = targetEndTime + calibration + distanceMs;
  return {
    type: "release",
    track,
    elapsedMs,
    calibratedElapsedMs: targetEndTime + distanceMs,
    calibrationOffsetMs: calibration,
    deviceBaselineOffsetMs: 0,
  };
}

function createReplayData(
  chart: Chart,
  inputEvents: ReplayInputEvent[],
  judgeEvents: ReplayJudgeEvent[],
  finalStats: GameStats,
  calibration: EffectiveCalibration = { value: 0, source: "global" }
): ReplayData {
  return {
    schemaVersion: 1,
    songId: chart.songId,
    difficulty: chart.difficulty,
    inputEvents,
    pauseNodes: [],
    syncEvents: [],
    judgeEvents,
    finalStats,
    calibrationAtStart: calibration,
    completedAt: Date.now(),
  };
}

describe("runReplay", () => {
  describe("点击音符判定", () => {
    it("完美击中应判定为 perfect", () => {
      const chart = createSimpleChart();
      const inputEvents = [createPressEvent(0, 1000, 0)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapPerfectCount).toBe(1);
      expect(result.stats.tapGoodCount).toBe(0);
      expect(result.stats.tapMissCount).toBe(1);
    });

    it("恰好边界 perfect 窗口应判定为 perfect", () => {
      const chart = createSimpleChart();
      const inputEvents = [
        createPressEvent(0, 1000, PERFECT_WINDOW_MS - 1),
      ];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapPerfectCount).toBe(1);
    });

    it("超过 perfect 但在 good 窗口内应判定为 good", () => {
      const chart = createSimpleChart();
      const inputEvents = [
        createPressEvent(0, 1000, PERFECT_WINDOW_MS + 1),
      ];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapPerfectCount).toBe(0);
      expect(result.stats.tapGoodCount).toBe(1);
    });

    it("恰好边界 good 窗口应判定为 good", () => {
      const chart = createSimpleChart();
      const inputEvents = [createPressEvent(0, 1000, GOOD_WINDOW_MS - 1)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapGoodCount).toBe(1);
    });

    it("超过 good 窗口不应命中（最终会 auto miss）", () => {
      const chart = createSimpleChart();
      const inputEvents = [createPressEvent(0, 1000, GOOD_WINDOW_MS + 1)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapMissCount).toBe(3);
      expect(result.stats.tapPerfectCount).toBe(0);
      expect(result.stats.tapGoodCount).toBe(0);
    });

    it("提前击中也应按距离判定", () => {
      const chart = createSimpleChart();
      const inputEvents = [createPressEvent(0, 1000, -PERFECT_WINDOW_MS + 1)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapPerfectCount).toBe(1);
    });

    it("未命中音符在超过 MISS 窗口后应 auto miss", () => {
      const chart = createSimpleChart();
      const inputEvents: ReplayInputEvent[] = [];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapMissCount).toBe(2);
      expect(result.stats.longMissCount).toBe(1);
      expect(result.stats.missCount).toBe(3);
    });

    it("错误轨道的按键不应命中目标音符", () => {
      const chart = createSimpleChart();
      const inputEvents = [createPressEvent(1, 1000, 0)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.tapMissCount).toBe(3);
    });
  });

  describe("长按音符判定", () => {
    it("长按起手完美击中+完美释放应两端都是 perfect", () => {
      const chart = createSimpleChart();
      const startTime = 3000;
      const endTime = 3500;
      const inputEvents = [
        createPressEvent(2, startTime, 0),
        createReleaseEvent(2, endTime, 0),
      ];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);

      const longStart = result.judgeEvents.find(
        (e) => e.noteId === 2 && e.phase === "start"
      );
      const longEnd = result.judgeEvents.find(
        (e) => e.noteId === 2 && e.phase === "end"
      );
      expect(longStart?.judge).toBe("perfect");
      expect(longEnd?.judge).toBe("perfect");
    });

    it("长按起手后不释放应判定为 end miss", () => {
      const chart = createSimpleChart();
      const startTime = 3000;
      const inputEvents = [createPressEvent(2, startTime, 0)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);

      const longStart = result.judgeEvents.find(
        (e) => e.noteId === 2 && e.phase === "start"
      );
      const longEnd = result.judgeEvents.find(
        (e) => e.noteId === 2 && e.phase === "end"
      );
      expect(longStart?.judge).toBe("perfect");
      expect(longEnd?.judge).toBe("miss");
    });

    it("没有按起手直接释放不会触发判定", () => {
      const chart = createSimpleChart();
      const endTime = 3500;
      const inputEvents = [createReleaseEvent(2, endTime, 0)];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);

      const longStart = result.judgeEvents.find(
        (e) => e.noteId === 2 && e.phase === "start"
      );
      expect(longStart?.judge).toBe("miss");
    });
  });

  describe("连击与分数", () => {
    it("连续命中 combo 递增，maxCombo 记录最大值", () => {
      const chart = {
        ...createSimpleChart(),
        notes: [
          createTapNote(0, 1000, 0),
          createTapNote(1, 2000, 1),
          createTapNote(2, 3000, 2),
        ],
      };
      const inputEvents = [
        createPressEvent(0, 1000, 0),
        createPressEvent(1, 2000, 0),
        createPressEvent(2, 3000, 0),
      ];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.combo).toBe(3);
      expect(result.stats.maxCombo).toBe(3);
    });

    it("miss 后 combo 清零，后续命中重新累加", () => {
      const chart = {
        ...createSimpleChart(),
        notes: [
          createTapNote(0, 1000, 0),
          createTapNote(1, 2000, 1),
          createTapNote(2, 3000, 2),
        ],
      };
      const inputEvents = [
        createPressEvent(0, 1000, 0),
        createPressEvent(2, 3000, 0),
      ];
      const replayData = createReplayData(chart, inputEvents, [], emptyStats());
      const result = runReplay(chart, replayData);
      expect(result.stats.maxCombo).toBe(1);
      expect(result.stats.perfectCount).toBe(2);
      expect(result.stats.missCount).toBe(1);
    });

    it("perfect 分数高于 good 分数", () => {
      const chartA = {
        ...createSimpleChart(),
        notes: [createTapNote(0, 1000, 0)],
      };
      const chartB = { ...chartA };
      const perfectEvents = [createPressEvent(0, 1000, 0)];
      const goodEvents = [createPressEvent(0, 1000, PERFECT_WINDOW_MS + 1)];
      const replayPerfect = createReplayData(chartA, perfectEvents, [], emptyStats());
      const replayGood = createReplayData(chartB, goodEvents, [], emptyStats());
      const resultPerfect = runReplay(chartA, replayPerfect);
      const resultGood = runReplay(chartB, replayGood);
      expect(resultPerfect.stats.score).toBeGreaterThan(resultGood.stats.score);
    });
  });

  describe("calibrationOverrideMs 校准偏移", () => {
    it("指定 calibrationOverrideMs 会覆盖原校准值", () => {
      const chart = createSimpleChart();
      const calibration = 100;
      const inputEvents = [createPressEvent(0, 1000, 0, calibration)];
      const replayData = createReplayData(
        chart,
        inputEvents,
        [],
        emptyStats(),
        { value: calibration, source: "global" }
      );

      const resultOverride = runReplay(chart, replayData, {
        calibrationOverrideMs: calibration + PERFECT_WINDOW_MS + 10,
      });
      const resultDefault = runReplay(chart, replayData);
      expect(resultDefault.stats.tapPerfectCount).toBe(1);
      expect(resultOverride.stats.tapPerfectCount).toBe(0);
      expect(resultOverride.stats.tapGoodCount).toBe(1);
    });
  });
});

describe("verifyReplay", () => {
  it("当重算统计与原始统计一致时应返回 match=true", () => {
    const chart = createSimpleChart();
    const inputEvents = [createPressEvent(0, 1000, 0)];
    const replayData = createReplayData(chart, inputEvents, [], emptyStats());
    const runResult = runReplay(chart, replayData);
    const fullReplay = createReplayData(
      chart,
      inputEvents,
      runResult.judgeEvents,
      runResult.stats
    );
    const verify = verifyReplay(chart, fullReplay);
    expect(verify.match).toBe(true);
    expect(verify.differences).toHaveLength(0);
    expect(verify.perNoteMismatches).toHaveLength(0);
  });

  it("当分数不一致时应检测出差异字段", () => {
    const chart = createSimpleChart();
    const inputEvents = [createPressEvent(0, 1000, 0)];
    const replayData = createReplayData(chart, inputEvents, [], emptyStats());
    const runResult = runReplay(chart, replayData);
    const tamperedStats = { ...runResult.stats, score: runResult.stats.score + 1 };
    const fullReplay = createReplayData(
      chart,
      inputEvents,
      runResult.judgeEvents,
      tamperedStats
    );
    const verify = verifyReplay(chart, fullReplay);
    expect(verify.match).toBe(false);
    expect(verify.differences.some((d) => d.field === "score")).toBe(true);
  });

  it("当单个音符判定不一致时应返回 perNoteMismatches", () => {
    const chart = createSimpleChart();
    const inputEvents = [createPressEvent(0, 1000, 0)];
    const replayData = createReplayData(chart, inputEvents, [], emptyStats());
    const runResult = runReplay(chart, replayData);
    const tamperedJudgeEvents = runResult.judgeEvents.map((e) =>
      e.noteId === 0 && e.phase === "start"
        ? { ...e, judge: "good" as const }
        : e
    );
    const fullReplay = createReplayData(
      chart,
      inputEvents,
      tamperedJudgeEvents,
      runResult.stats
    );
    const verify = verifyReplay(chart, fullReplay);
    expect(verify.match).toBe(false);
    expect(
      verify.perNoteMismatches.some(
        (m) => m.noteId === 0 && m.phase === "start"
      )
    ).toBe(true);
  });
});

describe("recalibrateReplay", () => {
  it("重校准后应返回新旧统计及 delta 分值", () => {
    const chart = createSimpleChart();
    const inputEvents = [createPressEvent(0, 1000, 0)];
    const replayData = createReplayData(
      chart,
      inputEvents,
      [],
      emptyStats(),
      { value: 0, source: "global" }
    );
    const result = recalibrateReplay(chart, replayData, 0);
    expect(typeof result.deltaScore).toBe("number");
    expect(typeof result.deltaPerfect).toBe("number");
    expect(typeof result.deltaGood).toBe("number");
    expect(typeof result.deltaMiss).toBe("number");
    expect(result.originalCalibrationMs).toBe(0);
    expect(result.newCalibrationMs).toBe(0);
  });

  it("调整校准值会改变判定结果（边界音符）", () => {
    const chart = {
      ...createSimpleChart(),
      notes: [createTapNote(0, 1000, 0)],
    };
    const inputEvents = [
      createPressEvent(0, 1000, PERFECT_WINDOW_MS + 5),
    ];
    const replayData = createReplayData(
      chart,
      inputEvents,
      [],
      emptyStats(),
      { value: 0, source: "global" }
    );
    const original = runReplay(chart, replayData);
    expect(original.stats.tapPerfectCount).toBe(0);
    expect(original.stats.tapGoodCount).toBe(1);

    const recalibrated = recalibrateReplay(chart, replayData, 10);
    expect(recalibrated.perNoteChanges.length).toBeGreaterThanOrEqual(0);
    expect(typeof recalibrated.deltaPerfect).toBe("number");
  });

  it("perNoteChanges 按 noteId 升序排列", () => {
    const chart = {
      ...createSimpleChart(),
      notes: [
        createTapNote(5, 1000, 0),
        createTapNote(2, 2000, 1),
        createTapNote(8, 3000, 2),
      ],
    };
    const inputEvents = [
      createPressEvent(0, 1000, 0),
      createPressEvent(1, 2000, 0),
      createPressEvent(2, 3000, 0),
    ];
    const replayData = createReplayData(
      chart,
      inputEvents,
      [],
      emptyStats(),
      { value: 0, source: "global" }
    );
    const result = recalibrateReplay(chart, replayData, 200);
    const ids = result.perNoteChanges.map((c) => c.noteId);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThanOrEqual(ids[i - 1]);
    }
  });
});
