import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Song,
  ChartDifficulty,
  BestPlaySummary,
  ScoreCheckpoint,
  LiveComparisonState,
  GameStats,
} from "../types";
import {
  getBestPlaySummary,
  computeLiveComparison,
} from "../songs";

export interface UseBestPlayComparisonArgs {
  song: Song;
  difficulty: ChartDifficulty;
  isPractice: boolean;
  currentStatsRef: React.MutableRefObject<GameStats>;
}

export interface ComparisonAnalysis {
  tap: {
    current: number;
    best: number;
    diff: number;
    perfectDiff: number;
    goodDiff: number;
    missDiff: number;
  };
  long: {
    current: number;
    best: number;
    diff: number;
    perfectDiff: number;
    goodDiff: number;
    missDiff: number;
  };
  overall: {
    current: number;
    best: number;
    diff: number;
  };
  scoreDiff: number;
  comboDiff: number;
}

export interface UseBestPlayComparisonResult {
  showBestComparison: boolean;
  setShowBestComparison: (show: boolean) => void;
  bestPlaySummary: BestPlaySummary | null;
  checkpoints: ScoreCheckpoint[];
  setCheckpoints: React.Dispatch<React.SetStateAction<ScoreCheckpoint[]>>;
  liveComparison: LiveComparisonState | null;
  lastCheckpointPercentRef: React.MutableRefObject<number>;
  comparisonAnalysis: ComparisonAnalysis | null;
  handleProgressUpdate: (progress: number, elapsedMs: number) => void;
  reset: () => void;
}

const CHECKPOINT_INTERVAL_PERCENT = 5;

export function useBestPlayComparison({
  song,
  difficulty,
  isPractice,
  currentStatsRef,
}: UseBestPlayComparisonArgs): UseBestPlayComparisonResult {
  const [showBestComparison, setShowBestComparison] = useState(true);
  const [bestPlaySummary, setBestPlaySummary] = useState<BestPlaySummary | null>(null);
  const [checkpoints, setCheckpoints] = useState<ScoreCheckpoint[]>([]);
  const [liveComparison, setLiveComparison] = useState<LiveComparisonState | null>(null);

  const lastCheckpointPercentRef = useRef<number>(-1);
  const showBestComparisonRef = useRef(showBestComparison);
  const bestPlaySummaryRef = useRef<BestPlaySummary | null>(bestPlaySummary);
  const comparisonBaselineRef = useRef<BestPlaySummary | null>(null);

  useEffect(() => {
    showBestComparisonRef.current = showBestComparison;
  }, [showBestComparison]);

  useEffect(() => {
    bestPlaySummaryRef.current = bestPlaySummary;
  }, [bestPlaySummary]);

  useEffect(() => {
    const summary = getBestPlaySummary(song.id, difficulty);
    setBestPlaySummary(summary);
    bestPlaySummaryRef.current = summary;
    comparisonBaselineRef.current = summary;
  }, [song.id, difficulty]);

  const calcAcc = (p: number, g: number, m: number) => {
    const total = p + g + m;
    if (total === 0) return 0;
    return ((p + g * 0.5) / total) * 100;
  };

  const comparisonAnalysis = useMemo<ComparisonAnalysis | null>(() => {
    const baseline = comparisonBaselineRef.current;
    if (!baseline || isPractice) return null;
    const stats = currentStatsRef.current;

    const tapAccCur = calcAcc(stats.tapPerfectCount, stats.tapGoodCount, stats.tapMissCount);
    const tapAccBest = calcAcc(
      baseline.tapPerfectCount,
      baseline.tapGoodCount,
      baseline.tapMissCount
    );
    const longAccCur = calcAcc(stats.longPerfectCount, stats.longGoodCount, stats.longMissCount);
    const longAccBest = calcAcc(
      baseline.longPerfectCount,
      baseline.longGoodCount,
      baseline.longMissCount
    );
    const overallAccCur = calcAcc(stats.perfectCount, stats.goodCount, stats.missCount);
    const overallAccBest = calcAcc(
      baseline.perfectCount,
      baseline.goodCount,
      baseline.missCount
    );
    const scoreDiff = stats.score - baseline.score;
    const comboDiff = stats.maxCombo - baseline.maxCombo;

    return {
      tap: {
        current: tapAccCur,
        best: tapAccBest,
        diff: tapAccCur - tapAccBest,
        perfectDiff: stats.tapPerfectCount - baseline.tapPerfectCount,
        goodDiff: stats.tapGoodCount - baseline.tapGoodCount,
        missDiff: stats.tapMissCount - baseline.tapMissCount,
      },
      long: {
        current: longAccCur,
        best: longAccBest,
        diff: longAccCur - longAccBest,
        perfectDiff: stats.longPerfectCount - baseline.longPerfectCount,
        goodDiff: stats.longGoodCount - baseline.longGoodCount,
        missDiff: stats.longMissCount - baseline.longMissCount,
      },
      overall: {
        current: overallAccCur,
        best: overallAccBest,
        diff: overallAccCur - overallAccBest,
      },
      scoreDiff,
      comboDiff,
    };
  }, [isPractice, currentStatsRef]);

  const handleProgressUpdate = (progress: number, elapsedMs: number) => {
    if (!isPractice) {
      const bucketedProgress =
        Math.floor(progress / CHECKPOINT_INTERVAL_PERCENT) * CHECKPOINT_INTERVAL_PERCENT;
      if (
        bucketedProgress > 0 &&
        bucketedProgress > lastCheckpointPercentRef.current &&
        bucketedProgress <= 100
      ) {
        lastCheckpointPercentRef.current = bucketedProgress;
        const stats = currentStatsRef.current;
        const checkpoint: ScoreCheckpoint = {
          progressPercent: bucketedProgress,
          elapsedMs,
          score: Math.floor(stats.score),
          combo: stats.combo,
          perfectCount: stats.perfectCount,
          goodCount: stats.goodCount,
          missCount: stats.missCount,
        };
        setCheckpoints((prev) => [...prev, checkpoint]);
      }
    }
    if (
      showBestComparisonRef.current &&
      bestPlaySummaryRef.current &&
      bestPlaySummaryRef.current.checkpoints.length > 0
    ) {
      const comparison = computeLiveComparison(
        bestPlaySummaryRef.current,
        currentStatsRef.current,
        progress
      );
      setLiveComparison(comparison);
    }
  };

  const reset = () => {
    setCheckpoints([]);
    setLiveComparison(null);
    lastCheckpointPercentRef.current = -1;
  };

  return {
    showBestComparison,
    setShowBestComparison,
    bestPlaySummary,
    checkpoints,
    setCheckpoints,
    liveComparison,
    lastCheckpointPercentRef,
    comparisonAnalysis,
    handleProgressUpdate,
    reset,
  };
}
