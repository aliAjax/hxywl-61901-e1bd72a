import { useEffect, useState } from "react";
import type { EffectiveCalibration } from "../types";
import {
  getEffectiveCalibration,
  getCalibrationOffset,
  getSongCalibrationOffset,
  saveSongCalibrationOffset,
  resetSongCalibrationOffset,
} from "../songs";

export interface UseGameCalibrationArgs {
  songId: string;
  refreshPlayerCalibration: () => void;
}

export interface UseGameCalibrationResult {
  effectiveCalibration: EffectiveCalibration;
  songCalibration: number | null;
  showSongCalibration: boolean;
  tempSongOffset: number;
  setShowSongCalibration: (show: boolean) => void;
  setTempSongOffset: (value: number | ((prev: number) => number)) => void;
  handleOpenSongCalibration: () => void;
  handleSaveSongCalibration: () => void;
  handleResetSongCalibration: () => void;
  handleUseGlobalCalibration: () => void;
  formatOffset: (ms: number) => string;
}

export function useGameCalibration({
  songId,
  refreshPlayerCalibration,
}: UseGameCalibrationArgs): UseGameCalibrationResult {
  const [effectiveCalibration, setEffectiveCalibration] = useState<EffectiveCalibration>(
    getEffectiveCalibration()
  );
  const [songCalibration, setSongCalibration] = useState<number | null>(null);
  const [showSongCalibration, setShowSongCalibration] = useState(false);
  const [tempSongOffset, setTempSongOffset] = useState(0);

  useEffect(() => {
    const songOffset = getSongCalibrationOffset(songId);
    setSongCalibration(songOffset);
    setTempSongOffset(songOffset ?? getCalibrationOffset());

    const refresh = () => {
      setEffectiveCalibration(getEffectiveCalibration(songId));
      setSongCalibration(getSongCalibrationOffset(songId));
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [songId]);

  const formatOffset = (ms: number): string => {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  };

  const handleOpenSongCalibration = () => {
    setTempSongOffset(effectiveCalibration.value);
    setShowSongCalibration(true);
  };

  const handleSaveSongCalibration = () => {
    saveSongCalibrationOffset(songId, tempSongOffset);
    setSongCalibration(tempSongOffset);
    setEffectiveCalibration(getEffectiveCalibration(songId));
    refreshPlayerCalibration();
    setShowSongCalibration(false);
  };

  const handleResetSongCalibration = () => {
    resetSongCalibrationOffset(songId);
    setSongCalibration(null);
    setEffectiveCalibration(getEffectiveCalibration(songId));
    refreshPlayerCalibration();
  };

  const handleUseGlobalCalibration = () => {
    setTempSongOffset(getCalibrationOffset());
  };

  return {
    effectiveCalibration,
    songCalibration,
    showSongCalibration,
    tempSongOffset,
    setShowSongCalibration,
    setTempSongOffset,
    handleOpenSongCalibration,
    handleSaveSongCalibration,
    handleResetSongCalibration,
    handleUseGlobalCalibration,
    formatOffset,
  };
}
