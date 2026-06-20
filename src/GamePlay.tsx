import { useEffect, useMemo, useRef, useState } from "react";
import type { Song, PracticeSegment, EffectiveCalibration } from "./types";
import type { ActiveNote, GameStats, JudgeType, NoteType } from "./types";
import {
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  saveSongBestScore,
  savePlayRecord,
  getCalibrationOffset,
  getEffectiveCalibration,
  saveSongCalibrationOffset,
  resetSongCalibrationOffset,
  getSongCalibrationOffset,
} from "./songs";
import {
  ChartPlayer, type SpawnedNote, HIT_ZONE_RELATIVE, type NoteVisualUpdate
} from "./chartPlayer";
import type { SyncDiagnostics } from "./audioSyncEngine";
import { getChartForSong } from "./charts";

interface GamePlayProps {
  song: Song;
  onBack: () => void;
  onOpenScorebook: (songId?: string | null) => void;
  practiceSegment?: PracticeSegment | null;
}

const TRACK_COUNT = 4;
const TRACK_LABELS = ["1", "2", "3", "4"];
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

type Orientation = "portrait" | "landscape";

function getOrientation(): Orientation {
  if (typeof window === "undefined") return "portrait";
  const w = window.innerWidth;
  const h = window.innerHeight;
  return h >= w ? "portrait" : "landscape";
}

export default function GamePlay({ song, onBack, onOpenScorebook, practiceSegment }: GamePlayProps) {
  const playerRef = useRef<ChartPlayer | null>(null);
  const tracksContainerRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);

  const [activeNotes, setActiveNotes] = useState<Map<number, ActiveNote>>(new Map());
  const [noteProgress, setNoteProgress] = useState<Map<number, number>>(new Map());
  const [noteEndProgress, setNoteEndProgress] = useState<Map<number, number>>(new Map());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [tapPerfectCount, setTapPerfectCount] = useState(0);
  const [tapGoodCount, setTapGoodCount] = useState(0);
  const [tapMissCount, setTapMissCount] = useState(0);
  const [longPerfectCount, setLongPerfectCount] = useState(0);
  const [longGoodCount, setLongGoodCount] = useState(0);
  const [longMissCount, setLongMissCount] = useState(0);
  const [lastJudge, setLastJudge] = useState<JudgeType>(null);
  const [lastJudgeTrack, setLastJudgeTrack] = useState(0);
  const [lastJudgeNoteType, setLastJudgeNoteType] = useState<NoteType>("tap");
  const [judgeKey, setJudgeKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(practiceSegment?.startMs ?? 0);
  const [pressedTracks, setPressedTracks] = useState<boolean[]>(
    new Array(TRACK_COUNT).fill(false)
  );
  const [savedRecord, setSavedRecord] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(getOrientation());
  const [trackHeightPx, setTrackHeightPx] = useState(0);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnostics | null>(null);
  const [showSyncDebug, setShowSyncDebug] = useState(false);
  const [effectiveCalibration, setEffectiveCalibration] = useState<EffectiveCalibration>(
    getEffectiveCalibration()
  );
  const [songCalibration, setSongCalibration] = useState<number | null>(null);
  const [showSongCalibration, setShowSongCalibration] = useState(false);
  const [tempSongOffset, setTempSongOffset] = useState(0);

  const isPractice = !!practiceSegment;
  const bestScore = useMemo(() => getSongBestScore(song.id), [song.id]);
  const finalStatsRef = useRef<GameStats | null>(null);
  const activePointersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const measure = () => {
      if (tracksContainerRef.current) {
        const rect = tracksContainerRef.current.getBoundingClientRect();
        setTrackHeightPx(rect.height);
      }
    };
    measure();
    const handleResize = () => {
      setOrientation(getOrientation());
      setTimeout(measure, 10);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    if (ro && tracksContainerRef.current) {
      ro.observe(tracksContainerRef.current);
    }
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (ro) ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const player = new ChartPlayer(song, {
      onNoteSpawn: (spawned: SpawnedNote) => {
        setActiveNotes((prev) => {
          const next = new Map(prev);
          next.set(spawned.id, {
            id: spawned.id,
            track: spawned.track,
            spawnTime: 0,
            targetTime: spawned.targetTime,
            y: -60,
            judged: false,
            type: spawned.type,
            duration: spawned.duration,
            longHolding: false,
            longStartJudged: false,
            longEndTime: spawned.endTime,
          });
          return next;
        });
        setNoteProgress((prev) => {
          const next = new Map(prev);
          next.set(spawned.id, -0.05);
          return next;
        });
        if (spawned.type === "long" && spawned.endTime !== undefined) {
          setNoteEndProgress((prev) => {
            const next = new Map(prev);
            next.set(spawned.id, -0.05);
            return next;
          });
        }
      },
      onNoteUpdate: (update: NoteVisualUpdate) => {
        const { id, progress, endProgress } = update;
        setNoteProgress((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.set(id, progress);
          return next;
        });
        if (endProgress !== undefined) {
          setNoteEndProgress((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.set(id, endProgress);
            return next;
          });
        }
      },
      onNoteJudge: (noteId: number, judge: JudgeType) => {
        setActiveNotes((prev) => {
          const existing = prev.get(noteId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(noteId, { ...existing, judged: true });
          return next;
        });
      },
      onNoteRemove: (id: number) => {
        setActiveNotes((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setNoteProgress((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setNoteEndProgress((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      },
      onJudge: (judge: JudgeType, track: number, noteType?: NoteType) => {
        setLastJudge(judge);
        setLastJudgeTrack(track);
        setLastJudgeNoteType(noteType || "tap");
        setJudgeKey((k) => k + 1);
        const currentJudge = judge;
        setTimeout(() => {
          setLastJudge((cur) => (cur === currentJudge ? null : cur));
        }, 320);
      },
      onStatsChange: (stats: GameStats) => {
        setScore(Math.floor(stats.score));
        setCombo(stats.combo);
        setMaxCombo(stats.maxCombo);
        setPerfectCount(stats.perfectCount);
        setGoodCount(stats.goodCount);
        setMissCount(stats.missCount);
        setTapPerfectCount(stats.tapPerfectCount);
        setTapGoodCount(stats.tapGoodCount);
        setTapMissCount(stats.tapMissCount);
        setLongPerfectCount(stats.longPerfectCount);
        setLongGoodCount(stats.longGoodCount);
        setLongMissCount(stats.longMissCount);
      },
      onTimeUpdate: (elapsedMs: number) => {
        setElapsed(elapsedMs);
      },
      onFinish: (finalStats: GameStats) => {
        finalStatsRef.current = finalStats;
        setFinished(true);
        setPaused(false);
      },
      onLongNoteHoldChange: (noteId: number, isHolding: boolean) => {
        setActiveNotes((prev) => {
          const existing = prev.get(noteId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(noteId, { ...existing, longHolding: isHolding });
          return next;
        });
      },
      onSyncDiagnostics: (diag: SyncDiagnostics) => {
        setSyncDiagnostics(diag);
      },
      onStateChange: (state) => {
        if (state === "paused") {
          setPaused(true);
        } else if (state === "playing") {
          setPaused(false);
        } else if (state === "finished") {
          setPaused(false);
        }
      },
    }, {
      practiceStartMs: practiceSegment?.startMs,
      practiceEndMs: practiceSegment?.endMs,
    });
    playerRef.current = player;

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [song.id, practiceSegment?.startMs, practiceSegment?.endMs]);

  useEffect(() => {
    const songOffset = getSongCalibrationOffset(song.id);
    setSongCalibration(songOffset);
    setTempSongOffset(songOffset ?? getCalibrationOffset());

    const refresh = () => {
      setEffectiveCalibration(getEffectiveCalibration(song.id));
      setSongCalibration(getSongCalibrationOffset(song.id));
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
  }, [song.id]);

  useEffect(() => {
    if (finished && !savedRecord && finalStatsRef.current) {
      if (!isPractice) {
        const finalScore = finalStatsRef.current.score;
        if (finalScore > 0) {
          saveSongBestScore(song.id, finalScore);
        }
        savePlayRecord({
          songId: song.id,
          score: finalScore,
          maxCombo: finalStatsRef.current.maxCombo,
          perfectCount: finalStatsRef.current.perfectCount,
          goodCount: finalStatsRef.current.goodCount,
          missCount: finalStatsRef.current.missCount,
          tapPerfectCount: finalStatsRef.current.tapPerfectCount,
          tapGoodCount: finalStatsRef.current.tapGoodCount,
          tapMissCount: finalStatsRef.current.tapMissCount,
          longPerfectCount: finalStatsRef.current.longPerfectCount,
          longGoodCount: finalStatsRef.current.longGoodCount,
          longMissCount: finalStatsRef.current.longMissCount,
          completedAt: Date.now(),
        });
      }
      setSavedRecord(true);
    }
  }, [finished, savedRecord, song.id, isPractice]);

  function handleStart() {
    setStarted(true);
    setFinished(false);
    setSavedRecord(false);
    setPaused(false);
    setElapsed(practiceSegment?.startMs ?? 0);
    setActiveNotes(new Map());
    setNoteProgress(new Map());
    setNoteEndProgress(new Map());
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setTapPerfectCount(0);
    setTapGoodCount(0);
    setTapMissCount(0);
    setLongPerfectCount(0);
    setLongGoodCount(0);
    setLongMissCount(0);
    setLastJudge(null);
    setJudgeKey(0);
    setPressedTracks(new Array(TRACK_COUNT).fill(false));
    finalStatsRef.current = null;
    activePointersRef.current.clear();
    playerRef.current?.start();
  }

  function handlePauseToggle() {
    if (!playerRef.current) return;
    if (playerRef.current.isPlaying()) {
      playerRef.current.pause();
      setPaused(true);
    } else if (playerRef.current.isPaused()) {
      playerRef.current.resume();
      setPaused(false);
    }
  }

  function handleRestart() {
    setFinished(false);
    setSavedRecord(false);
    setPaused(false);
    setElapsed(practiceSegment?.startMs ?? 0);
    setActiveNotes(new Map());
    setNoteProgress(new Map());
    setNoteEndProgress(new Map());
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setTapPerfectCount(0);
    setTapGoodCount(0);
    setTapMissCount(0);
    setLongPerfectCount(0);
    setLongGoodCount(0);
    setLongMissCount(0);
    setLastJudge(null);
    setJudgeKey(0);
    setPressedTracks(new Array(TRACK_COUNT).fill(false));
    finalStatsRef.current = null;
    activePointersRef.current.clear();
    playerRef.current?.restart();
  }

  function handleTrackPress(track: number) {
    if (!playerRef.current) return;
    if (!playerRef.current.isPlaying()) return;

    setPressedTracks((prev) => {
      const next = [...prev];
      next[track] = true;
      return next;
    });

    playerRef.current.judgeTrackPress(track);
  }

  function handleTrackRelease(track: number) {
    if (!playerRef.current) return;

    setPressedTracks((prev) => {
      const next = [...prev];
      next[track] = false;
      return next;
    });

    playerRef.current.judgeTrackRelease(track);
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "escape") {
        if (started && !finished) {
          handlePauseToggle();
        }
        return;
      }
      if (key === " ") {
        if (!started || finished) {
          e.preventDefault();
          handleStart();
        } else if (!finished) {
          e.preventDefault();
          handlePauseToggle();
        }
        return;
      }
      if (key === "f12") {
        e.preventDefault();
        setShowSyncDebug((prev) => !prev);
        return;
      }
      const keyLabels = ["d", "f", "j", "k"];
      const idx = keyLabels.findIndex((l) => l === key);
      if (idx !== -1) {
        e.preventDefault();
        if (!e.repeat) {
          handleTrackPress(idx);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const keyLabels = ["d", "f", "j", "k"];
      const idx = keyLabels.findIndex((l) => l === key);
      if (idx !== -1) {
        handleTrackRelease(idx);
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished]);

  function handleTrackPointerDown(e: React.PointerEvent, track: number) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, track);
    handleTrackPress(track);
  }

  function handleTrackPointerUp(e: React.PointerEvent, track: number) {
    e.preventDefault();
    activePointersRef.current.delete(e.pointerId);
    handleTrackRelease(track);
  }

  function handleTrackPointerCancel(e: React.PointerEvent, track: number) {
    e.preventDefault();
    activePointersRef.current.delete(e.pointerId);
    handleTrackRelease(track);
  }

  const effectiveDurationMs = practiceSegment
    ? practiceSegment.endMs
    : song.duration * 1000;
  const effectiveStartMs = practiceSegment ? practiceSegment.startMs : 0;

  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      ((elapsed - effectiveStartMs) / (effectiveDurationMs - effectiveStartMs)) * 100
    )
  );

  const isPlaying = started && !paused && !finished;

  const chart = useMemo(() => getChartForSong(song.id), [song.id]);
  const segmentNotes = useMemo(() => {
    if (!practiceSegment) return chart.notes;
    return chart.notes.filter(
      (n) => n.time >= practiceSegment.startMs && n.time <= practiceSegment.endMs
    );
  }, [chart.notes, practiceSegment]);
  const totalNotes = segmentNotes.length;
  const totalTapNotes = segmentNotes.filter((n) => n.type === "tap").length;
  const totalLongNotes = segmentNotes.filter((n) => n.type === "long").length;

  const isPortrait = orientation === "portrait";

  const H = trackHeightPx || 560;
  const hitLineY = H * HIT_ZONE_RELATIVE;

  const formatOffset = (ms: number): string => {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  };

  function progressToTop(p: number): number {
    return p * hitLineY;
  }

  const practiceDurationSec = practiceSegment
    ? Math.round((practiceSegment.endMs - practiceSegment.startMs) / 1000)
    : 0;

  return (
    <div className={`game-play ${isPortrait ? "mobile-portrait" : "mobile-landscape"}`}>
      <div className="play-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回选曲
        </button>
        <div className="play-song-info">
          <h2 className="play-song-title">{song.title}</h2>
          <span
            className="play-song-diff"
            style={{ backgroundColor: difficultyColors[song.difficulty] }}
          >
            {difficultyLabels[song.difficulty]} Lv.{song.difficultyLevel}
          </span>
          {isPractice && (
            <span className="practice-badge-header">分段练习</span>
          )}
        </div>
        <div className="play-stats-mini">
          <div>
            <small>分数</small>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div>
            <small>连击</small>
            <strong className="combo-num">{combo}</strong>
          </div>
          {started && !finished && (
            <button
              className={"pause-btn " + (paused ? "paused" : "")}
              onClick={handlePauseToggle}
              title={paused ? "继续 (Space)" : "暂停 (Esc / Space)"}
            >
              {paused ? "▶" : "❚❚"}
            </button>
          )}
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: progressPercent + "%",
            background:
              "linear-gradient(90deg, " + song.coverColor + ", " + song.accentColor + ")",
          }}
        />
        <span
          className={`progress-time progress-calibration ${effectiveCalibration.source === "song" ? "calibration-song" : ""}`}
          title={effectiveCalibration.source === "song" ? "使用单曲校准" : "使用全局校准"}
        >
          🎯 {formatOffset(effectiveCalibration.value)}
          {effectiveCalibration.source === "song" ? " ♪" : ""}
        </span>
        <span className="progress-time">
          {formatDuration(Math.floor(Math.max(0, elapsed - effectiveStartMs) / 1000))} /{" "}
          {formatDuration(Math.floor((effectiveDurationMs - effectiveStartMs) / 1000))}
        </span>
      </div>

      <div className={`play-area ${isPortrait ? "portrait-area" : "landscape-area"}`}>
        <div
          ref={tracksContainerRef}
          className="tracks-container"
        >
          {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => (
            <div
              key={trackIdx}
              className={`track ${pressedTracks[trackIdx] ? "pressed" : ""}`}
              style={{ borderColor: TRACK_COLORS[trackIdx] + "55" }}
              data-track-index={trackIdx}
              onPointerDown={(e) => handleTrackPointerDown(e, trackIdx)}
              onPointerUp={(e) => handleTrackPointerUp(e, trackIdx)}
              onPointerCancel={(e) => handleTrackPointerCancel(e, trackIdx)}
              onPointerLeave={(e) => {
                if (activePointersRef.current.has(e.pointerId)) {
                  handleTrackPointerCancel(e, trackIdx);
                }
              }}
            >
              {Array.from(activeNotes.values())
                .filter((n) => n.track === trackIdx && !n.judged)
                .map((note) => {
                  const color1 = TRACK_COLORS[trackIdx];
                  const color2 = TRACK_COLORS[(trackIdx + 1) % TRACK_COLORS.length];
                  const p = noteProgress.get(note.id) ?? -0.05;
                  const endP = noteEndProgress.get(note.id);
                  const noteTop = progressToTop(p);

                  if (note.type === "long" && endP !== undefined) {
                    const endTop = progressToTop(endP);
                    const tailTop = Math.min(noteTop, endTop);
                    const tailBottom = Math.max(noteTop, endTop);
                    const tailHeight = Math.max(18, tailBottom - tailTop + 28);
                    return (
                      <div key={note.id}>
                        <div
                          className={`note-long-tail ${note.longHolding ? "holding" : ""}`}
                          style={{
                            top: tailTop,
                            height: tailHeight,
                            background: `linear-gradient(180deg, ${color1}60, ${color2}80)`,
                            borderColor: color1,
                          }}
                        />
                        <div
                          className="note note-long-head"
                          style={{
                            top: endTop,
                            background:
                              "linear-gradient(180deg, " + color1 + ", " + color2 + ")",
                            boxShadow: "0 0 20px " + color1 + "80",
                          }}
                        />
                        <div
                          className="note note-long-start"
                          style={{
                            top: noteTop,
                            background:
                              "linear-gradient(180deg, " + color2 + ", " + color1 + ")",
                            boxShadow: "0 0 16px " + color1 + "60",
                            opacity: note.longStartJudged ? 0.3 : 1,
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={note.id}
                      className="note"
                      style={{
                        top: noteTop,
                        background:
                          "linear-gradient(180deg, " + color1 + ", " + color2 + ")",
                        boxShadow: "0 0 20px " + color1 + "80",
                      }}
                    />
                  );
                })}
              <div
                className="hit-zone"
                style={{
                  top: hitLineY - 25,
                  borderColor: TRACK_COLORS[trackIdx],
                }}
              >
                <span className="hit-label">{TRACK_LABELS[trackIdx]}</span>
              </div>
            </div>
          ))}

          {lastJudge && (
            <div
              className={`judge-display judge-${lastJudge} ${lastJudgeNoteType === "long" ? "judge-long" : ""}`}
              key={lastJudge + "-" + lastJudgeTrack + "-" + judgeKey}
            >
              <span className="judge-type-label">
                {lastJudgeNoteType === "long" ? "长按 " : ""}
              </span>
              {lastJudge === "perfect"
                ? "PERFECT!"
                : lastJudge === "good"
                ? "GOOD"
                : "MISS"}
            </div>
          )}

          {combo >= 5 && isPlaying && (
            <div className="combo-display">
              <span className="combo-text">{combo}</span>
              <span className="combo-label">COMBO</span>
            </div>
          )}

          {totalNotes > 0 && (
            <div className="note-progress-tag">
              {isPractice ? "练习段" : "谱面"} {totalTapNotes} 点击 + {totalLongNotes} 长按
            </div>
          )}
        </div>
      </div>

      <div className={`track-buttons ${isPortrait ? "portrait-buttons" : "landscape-buttons"}`}>
        {TRACK_LABELS.map((label, idx) => {
          const color = TRACK_COLORS[idx];
          return (
            <button
              key={idx}
              className={
                "track-btn touch-track-btn " +
                (pressedTracks[idx] ? "pressed" : "")
              }
              style={{
                background:
                  "linear-gradient(180deg, " + color + "aa, " + color + ")",
                boxShadow: pressedTracks[idx]
                  ? "0 0 30px " + color
                  : "none",
              }}
              data-track-index={idx}
              disabled={!isPlaying}
              onPointerDown={(e) => handleTrackPointerDown(e, idx)}
              onPointerUp={(e) => handleTrackPointerUp(e, idx)}
              onPointerCancel={(e) => handleTrackPointerCancel(e, idx)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showSyncDebug && syncDiagnostics && (
        <div className="sync-debug-panel">
          <div className="sync-debug-header">
            <span>🔧 同步诊断</span>
            <button
              className="sync-debug-close"
              onClick={() => setShowSyncDebug(false)}
            >
              ✕
            </button>
          </div>
          <div className="sync-debug-grid">
            <div className="sync-debug-item">
              <small>时钟源</small>
              <strong className={syncDiagnostics.clockSource}>
                {syncDiagnostics.clockSource === "wall"
                  ? "🎯 系统时钟"
                  : syncDiagnostics.clockSource === "audio"
                  ? "🎵 音频时钟"
                  : "⚡ 混合同步"}
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>音频漂移</small>
              <strong
                className={
                  Math.abs(syncDiagnostics.audioClockDriftMs) < 20
                    ? "drift-good"
                    : Math.abs(syncDiagnostics.audioClockDriftMs) < 40
                    ? "drift-warning"
                    : "drift-bad"
                }
              >
                {syncDiagnostics.audioClockDriftMs.toFixed(1)} ms
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>已播放</small>
              <strong>{(syncDiagnostics.totalElapsedMs / 1000).toFixed(1)} s</strong>
            </div>
            <div className="sync-debug-item">
              <small>音频时间</small>
              <strong>{(syncDiagnostics.audioElapsedMs / 1000).toFixed(1)} s</strong>
            </div>
            <div className="sync-debug-item">
              <small>平均帧时</small>
              <strong
                className={
                  syncDiagnostics.avgFrameTimeMs < 18
                    ? "drift-good"
                    : syncDiagnostics.avgFrameTimeMs < 30
                    ? "drift-warning"
                    : "drift-bad"
                }
              >
                {syncDiagnostics.avgFrameTimeMs.toFixed(1)} ms
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>低帧率事件</small>
              <strong className={syncDiagnostics.lowFrameEvents > 0 ? "drift-warning" : "drift-good"}>
                {syncDiagnostics.lowFrameEvents}
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>重同步次数</small>
              <strong className={syncDiagnostics.resyncCount > 5 ? "drift-warning" : "drift-good"}>
                {syncDiagnostics.resyncCount}
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>页面切换</small>
              <strong>{syncDiagnostics.visibilityChanges}</strong>
            </div>
            <div className="sync-debug-item">
              <small>平滑偏移</small>
              <strong>{syncDiagnostics.currentAudioOffsetMs.toFixed(1)} ms</strong>
            </div>
            <div className="sync-debug-item">
              <small>校准偏移</small>
              <strong>
                {syncDiagnostics?.calibrationValueMs ?? 0} ms
                {syncDiagnostics?.calibrationSource === "song" ? " ♪" : ""}
              </strong>
            </div>
            <div className="sync-debug-item">
              <small>校准来源</small>
              <strong className={syncDiagnostics?.calibrationSource === "song" ? "drift-warning" : ""}>
                {syncDiagnostics?.calibrationSource === "song" ? "🎵 单曲校准" : "🌐 全局校准"}
              </strong>
            </div>
          </div>
          <div className="sync-debug-hint">按 F12 关闭此面板</div>
        </div>
      )}

      {!showSyncDebug && started && !finished && (
        <button
          className="sync-debug-toggle"
          onClick={() => setShowSyncDebug(true)}
          title="显示同步诊断 (F12)"
        >
          🔧
        </button>
      )}

      {!started && !finished && (
        <div className="start-overlay">
          <div className="start-card">
            <div className="cover-colors" style={{
              background: "linear-gradient(135deg, " + song.coverColor + ", " + song.accentColor + ")",
            }} />
            <h2>{song.title}</h2>
            {isPractice && (
              <div className="practice-start-badge">🎯 分段练习 · {practiceDurationSec}s</div>
            )}
            <div className="meta">
              <span style={{ backgroundColor: difficultyColors[song.difficulty] }}>
                {difficultyLabels[song.difficulty]} Lv.{song.difficultyLevel}
              </span>
              <span>{song.artist}</span>
              <span>{formatDuration(song.duration)}</span>
            </div>
            {isPractice ? (
              <p className="start-tip">
                练习模式：仅演奏选定片段，成绩不计入最高分。<br />
                结束后可重新练习同一段。
              </p>
            ) : (
              <p className="start-tip">
                移动端竖屏推荐玩法：双手握住设备，用拇指点击对应编号按钮。<br />
                橙色方块（短）点击，彩色长条（长按）按到底再松开。
              </p>
            )}
            {!isPractice && (
              <p className="best-score">
                最高分：<strong>{bestScore.toLocaleString()}</strong>
              </p>
            )}
            <p className="start-keys">
              <strong>触屏</strong>：按下方彩色按钮　|　<strong>键盘</strong>：D / F / J / K
            </p>
            <button className="start-btn" onClick={handleStart}>
              ▶ {isPractice ? "开始练习" : "开始演奏"}
            </button>
            <small className="start-shortcut">按空格键快速开始</small>
          </div>
        </div>
      )}

      {paused && !finished && (
        <div className="pause-overlay">
          <div className="pause-card">
            <h2>已暂停</h2>
            <button className="start-btn" onClick={handlePauseToggle}>
              ▶ 继续演奏
            </button>
            <button className="ghost-btn" onClick={handleRestart}>
              ↺ 重新开始
            </button>
            <button className="ghost-btn" onClick={onBack}>
              ← 返回选曲
            </button>
          </div>
        </div>
      )}

      {finished && (
        <div className="result-overlay">
          <div className="result-card">
            {isPractice && (
              <div className="practice-result-badge">🎯 练习记录</div>
            )}
            <h2>{isPractice ? "练习结束" : "演奏结束"}</h2>
            <div className="result-score">{score.toLocaleString()}</div>
            <div className="result-grade">
              {perfectCount === totalNotes && totalNotes > 0
                ? "🏆 PERFECT 全中"
                : missCount === 0
                ? "⭐ FULL COMBO"
                : score >= 50000
                ? "✓ 良好"
                : "继续加油！"}
            </div>
            {isPractice && (
              <div className="practice-result-hint">
                练习成绩不计入正式最高分
              </div>
            )}
            <div className="result-calibration">
              <span className="result-calibration-label">
                延迟校准
                {effectiveCalibration.source === "song" ? (
                  <span className="result-calibration-source-badge song-badge">🎵 单曲</span>
                ) : (
                  <span className="result-calibration-source-badge global-badge">🌐 全局</span>
                )}
              </span>
              <strong className="result-calibration-value">
                {formatOffset(effectiveCalibration.value)}
              </strong>
            </div>

            {!isPractice && (
              <div className="result-song-calibration">
                {songCalibration !== null ? (
                  <div className="song-calibration-info">
                    <span>当前歌曲已设置独立校准值</span>
                    <button
                      className="ghost-btn small-btn"
                      onClick={() => {
                        resetSongCalibrationOffset(song.id);
                        setSongCalibration(null);
                        setEffectiveCalibration(getEffectiveCalibration(song.id));
                        playerRef.current?.refreshCalibration();
                      }}
                    >
                      🔄 清除单曲校准
                    </button>
                  </div>
                ) : (
                  <div className="song-calibration-actions">
                    <button
                      className="ghost-btn small-btn"
                      onClick={() => {
                        setTempSongOffset(effectiveCalibration.value);
                        setShowSongCalibration(true);
                      }}
                    >
                      🎯 为本歌单独设置校准
                    </button>
                  </div>
                )}
              </div>
            )}

            {showSongCalibration && (
              <div className="song-calibration-panel">
                <div className="song-calibration-header">
                  <strong>设置单曲校准值</strong>
                  <button
                    className="ghost-btn small-btn"
                    onClick={() => setShowSongCalibration(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="song-calibration-controls">
                  <button
                    className="calibration-adjust-btn"
                    onClick={() => setTempSongOffset((v) => v - 5)}
                  >
                    −
                  </button>
                  <div className="calibration-value-display large">
                    <strong>{formatOffset(tempSongOffset)}</strong>
                    <small>
                      {tempSongOffset === 0
                        ? "无偏移"
                        : tempSongOffset > 0
                        ? "判定提前"
                        : "判定延后"}
                    </small>
                  </div>
                  <button
                    className="calibration-adjust-btn"
                    onClick={() => setTempSongOffset((v) => v + 5)}
                  >
                    +
                  </button>
                </div>
                <div className="song-calibration-actions-row">
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setTempSongOffset(getCalibrationOffset());
                    }}
                  >
                    ↺ 使用全局值 ({formatOffset(getCalibrationOffset())})
                  </button>
                  <button
                    className="start-btn"
                    onClick={() => {
                      saveSongCalibrationOffset(song.id, tempSongOffset);
                      setSongCalibration(tempSongOffset);
                      setEffectiveCalibration(getEffectiveCalibration(song.id));
                      playerRef.current?.refreshCalibration();
                      setShowSongCalibration(false);
                    }}
                  >
                    💾 保存为本歌校准
                  </button>
                </div>
                <p className="song-calibration-hint">
                  正值：系统判定时间提前，适合点击偏晚的玩家<br />
                  负值：系统判定时间延后，适合点击偏早的玩家
                </p>
              </div>
            )}
            <div className="result-stats">
              <div className="result-summary-section">
                <div className="result-section-title">总览</div>
                <div>
                  <span className="perfect">PERFECT</span>{" "}
                  <strong>{perfectCount}</strong> / {totalNotes}
                </div>
                <div>
                  <span className="good">GOOD</span>{" "}
                  <strong>{goodCount}</strong>
                </div>
                <div>
                  <span className="miss">MISS</span>{" "}
                  <strong>{missCount}</strong>
                </div>
                <div>
                  最大连击 <strong className="combo-num">{maxCombo}</strong>
                </div>
              </div>

              {totalTapNotes > 0 && (
                <div className="result-summary-section">
                  <div className="result-section-title">点击音符</div>
                  <div className="result-stats-small">
                    <span className="perfect">P</span>{" "}
                    <strong>{tapPerfectCount}</strong>
                  </div>
                  <div className="result-stats-small">
                    <span className="good">G</span>{" "}
                    <strong>{tapGoodCount}</strong>
                  </div>
                  <div className="result-stats-small">
                    <span className="miss">M</span>{" "}
                    <strong>{tapMissCount}</strong>
                  </div>
                  <div className="result-stats-small subtle">
                    共 {totalTapNotes} 个
                  </div>
                </div>
              )}

              {totalLongNotes > 0 && (
                <div className="result-summary-section">
                  <div className="result-section-title">长按音符</div>
                  <div className="result-stats-small">
                    <span className="perfect">P</span>{" "}
                    <strong>{longPerfectCount}</strong>
                  </div>
                  <div className="result-stats-small">
                    <span className="good">G</span>{" "}
                    <strong>{longGoodCount}</strong>
                  </div>
                  <div className="result-stats-small">
                    <span className="miss">M</span>{" "}
                    <strong>{longMissCount}</strong>
                  </div>
                  <div className="result-stats-small subtle">
                    共 {totalLongNotes} 个
                  </div>
                </div>
              )}
            </div>
            <div className="result-actions">
              <button className="ghost-btn" onClick={onBack}>
                ← 返回选曲
              </button>
              {!isPractice && (
                <button
                  className="ghost-btn"
                  onClick={() => onOpenScorebook(song.id)}
                >
                  📖 成绩册
                </button>
              )}
              {isPractice ? (
                <button className="start-btn" onClick={handleRestart}>
                  ↺ 重新练习同一段
                </button>
              ) : (
                <button className="start-btn" onClick={handleRestart}>
                  ↺ 再来一次
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {typeof window !== "undefined" &&
        (("ontouchstart" in window) || (navigator.maxTouchPoints > 0)) &&
        isPlaying && (
          <div className="mobile-hint">
            竖屏：拇指点击下方按钮 ①②③④
          </div>
        )}
    </div>
  );
}
