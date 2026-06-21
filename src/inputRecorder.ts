import type {
  ReplayData,
  ReplayChartSnapshot,
  ReplayInputEvent,
  ReplayPauseNode,
  ReplaySyncEvent,
  ReplayJudgeEvent,
  GameStats,
  CalibrationSource,
  ChartDifficulty,
  JudgeType,
  NoteType,
  Chart,
} from "./types";

const REPLAY_SCHEMA_VERSION = 2;

export class InputRecorder {
  private songId: string;
  private difficulty: ChartDifficulty;
  private inputEvents: ReplayInputEvent[] = [];
  private pauseNodes: ReplayPauseNode[] = [];
  private syncEvents: ReplaySyncEvent[] = [];
  private judgeEvents: ReplayJudgeEvent[] = [];
  private calibrationAtStart: { value: number; source: CalibrationSource };
  private chartSnapshot: ReplayChartSnapshot | null = null;
  private prevDiagLowFrame = 0;
  private prevDiagResync = 0;
  private prevDiagVisibility = 0;

  constructor(
    songId: string,
    difficulty: ChartDifficulty,
    calibrationValue: number,
    calibrationSource: CalibrationSource
  ) {
    this.songId = songId;
    this.difficulty = difficulty;
    this.calibrationAtStart = { value: calibrationValue, source: calibrationSource };
  }

  setChartSnapshot(chart: Chart) {
    this.chartSnapshot = {
      songId: chart.songId,
      difficulty: chart.difficulty,
      totalNotes: chart.totalNotes,
      totalTapNotes: chart.totalTapNotes,
      totalLongNotes: chart.totalLongNotes,
      notes: chart.notes.map((n) => ({
        id: n.id,
        time: n.time,
        track: n.track,
        type: n.type,
        duration: n.duration,
      })),
    };
  }

  recordInput(
    type: "press" | "release",
    track: number,
    elapsedMs: number,
    calibratedElapsedMs: number,
    calibrationOffsetMs: number,
    deviceBaselineOffsetMs: number
  ) {
    this.inputEvents.push({
      type,
      track,
      elapsedMs,
      calibratedElapsedMs,
      calibrationOffsetMs,
      deviceBaselineOffsetMs,
    });
  }

  recordPause(elapsedMs: number, timestamp: number) {
    this.pauseNodes.push({ type: "pause", elapsedMs, timestamp });
  }

  recordResume(elapsedMs: number, timestamp: number) {
    this.pauseNodes.push({ type: "resume", elapsedMs, timestamp });
  }

  recordSyncEvent(type: ReplaySyncEvent["type"], elapsedMs: number, detail?: string) {
    this.syncEvents.push({ type, elapsedMs, detail });
  }

  recordJudge(
    noteId: number,
    track: number,
    noteType: NoteType,
    phase: "start" | "end",
    judge: JudgeType,
    distanceMs: number,
    elapsedMs: number,
    calibratedElapsedMs: number
  ) {
    this.judgeEvents.push({
      noteId,
      track,
      noteType,
      phase,
      judge,
      distanceMs,
      elapsedMs,
      calibratedElapsedMs,
    });
  }

  checkDiagnosticsDelta(diag: {
    lowFrameEvents: number;
    resyncCount: number;
    visibilityChanges: number;
    totalElapsedMs: number;
  }) {
    if (diag.lowFrameEvents > this.prevDiagLowFrame) {
      this.recordSyncEvent("low_frame", diag.totalElapsedMs);
      this.prevDiagLowFrame = diag.lowFrameEvents;
    }
    if (diag.resyncCount > this.prevDiagResync) {
      this.recordSyncEvent("resync", diag.totalElapsedMs);
      this.prevDiagResync = diag.resyncCount;
    }
    if (diag.visibilityChanges > this.prevDiagVisibility) {
      this.recordSyncEvent("visibility_change", diag.totalElapsedMs);
      this.prevDiagVisibility = diag.visibilityChanges;
    }
  }

  buildReplayData(finalStats: GameStats, completedAt: number): ReplayData {
    const data: ReplayData = {
      schemaVersion: REPLAY_SCHEMA_VERSION,
      songId: this.songId,
      difficulty: this.difficulty,
      inputEvents: [...this.inputEvents],
      pauseNodes: [...this.pauseNodes],
      syncEvents: [...this.syncEvents],
      judgeEvents: [...this.judgeEvents],
      finalStats: { ...finalStats },
      calibrationAtStart: { ...this.calibrationAtStart },
      completedAt,
    };
    if (this.chartSnapshot) {
      data.chartSnapshot = { ...this.chartSnapshot, notes: [...this.chartSnapshot.notes] };
    }
    return data;
  }

  reset() {
    this.inputEvents = [];
    this.pauseNodes = [];
    this.syncEvents = [];
    this.judgeEvents = [];
    this.prevDiagLowFrame = 0;
    this.prevDiagResync = 0;
    this.prevDiagVisibility = 0;
  }
}
