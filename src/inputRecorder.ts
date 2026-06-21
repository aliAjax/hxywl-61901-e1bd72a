import type {
  ReplayData,
  ReplayInputEvent,
  ReplayPauseNode,
  ReplaySyncEvent,
  ReplayJudgeEvent,
  GameStats,
  CalibrationSource,
  ChartDifficulty,
  JudgeType,
  NoteType,
} from "./types";

const REPLAY_SCHEMA_VERSION = 1;

export class InputRecorder {
  private songId: string;
  private difficulty: ChartDifficulty;
  private inputEvents: ReplayInputEvent[] = [];
  private pauseNodes: ReplayPauseNode[] = [];
  private syncEvents: ReplaySyncEvent[] = [];
  private judgeEvents: ReplayJudgeEvent[] = [];
  private calibrationAtStart: { value: number; source: CalibrationSource };
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
    return {
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
