import { useRef } from "react";
import type {
  Chart,
  ChartDifficulty,
  EffectiveCalibration,
  GameStats,
  NoteType,
  JudgeType,
  ReplayData,
} from "../types";
import type { JudgeDetailEvent } from "../chartPlayer";
import type { SyncDiagnostics } from "../audioSyncEngine";
import { InputRecorder } from "../inputRecorder";
import { saveReplayData } from "../songs";

export interface UsePlayRecordingArgs {
  songId: string;
  difficulty: ChartDifficulty;
  isPractice: boolean;
}

export interface UsePlayRecordingResult {
  recorderRef: React.MutableRefObject<InputRecorder | null>;
  recorderHadPauseRef: React.MutableRefObject<boolean>;
  initRecorder: (calibration: EffectiveCalibration, chart: Chart) => void;
  recordInput: (
    type: "press" | "release",
    track: number,
    elapsedMs: number,
    calibratedMs: number,
    calibrationOffset: number,
    deviceBaseline: number
  ) => void;
  recordPause: (elapsedMs: number) => void;
  recordResume: (elapsedMs: number) => void;
  recordJudge: (detail: JudgeDetailEvent) => void;
  checkDiagnosticsDelta: (diag: SyncDiagnostics) => void;
  handleFinish: (finalStats: GameStats) => ReplayData | null;
  reset: () => void;
}

export function usePlayRecording({
  songId,
  difficulty,
  isPractice,
}: UsePlayRecordingArgs): UsePlayRecordingResult {
  const recorderRef = useRef<InputRecorder | null>(null);
  const recorderHadPauseRef = useRef(false);

  const initRecorder = (calibration: EffectiveCalibration, chart: Chart) => {
    recorderRef.current = new InputRecorder(
      songId,
      difficulty,
      calibration.value,
      calibration.source
    );
    recorderRef.current.setChartSnapshot(chart);
    recorderHadPauseRef.current = false;
  };

  const recordInput = (
    type: "press" | "release",
    track: number,
    elapsedMs: number,
    calibratedMs: number,
    calibrationOffset: number,
    deviceBaseline: number
  ) => {
    recorderRef.current?.recordInput(
      type,
      track,
      elapsedMs,
      calibratedMs,
      calibrationOffset,
      deviceBaseline
    );
  };

  const recordPause = (elapsedMs: number) => {
    recorderHadPauseRef.current = true;
    recorderRef.current?.recordPause(elapsedMs, Date.now());
  };

  const recordResume = (elapsedMs: number) => {
    if (recorderHadPauseRef.current) {
      recorderRef.current?.recordResume(elapsedMs, Date.now());
    }
  };

  const recordJudge = (detail: JudgeDetailEvent) => {
    recorderRef.current?.recordJudge(
      detail.noteId,
      detail.track,
      detail.noteType,
      detail.phase,
      detail.judge,
      detail.distanceMs,
      detail.elapsedMs,
      detail.calibratedElapsedMs
    );
  };

  const checkDiagnosticsDelta = (diag: SyncDiagnostics) => {
    recorderRef.current?.checkDiagnosticsDelta(diag);
  };

  const handleFinish = (finalStats: GameStats): ReplayData | null => {
    if (isPractice) return null;
    if (!recorderRef.current) return null;
    const now = Date.now();
    const replayData = recorderRef.current.buildReplayData(finalStats, now);
    saveReplayData(replayData);
    return replayData;
  };

  const reset = () => {
    recorderRef.current = null;
    recorderHadPauseRef.current = false;
  };

  return {
    recorderRef,
    recorderHadPauseRef,
    initRecorder,
    recordInput,
    recordPause,
    recordResume,
    recordJudge,
    checkDiagnosticsDelta,
    handleFinish,
    reset,
  };
}
