import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "./types";
import type { ActiveNote, GameStats, JudgeType, NoteType } from "./types";
import {
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  saveSongBestScore,
  savePlayRecord,
  getCalibrationOffset,
} from "./songs";
import { ChartPlayer, type SpawnedNote, HIT_ZONE_RELATIVE, type NoteVisualUpdate } from "./chartPlayer";
import { getChartForSong } from "./charts";

interface GamePlayProps {
  song: Song;
  onBack: () => void;
  onOpenScorebook: (songId?: string | null) => void;
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

export default function GamePlay({ song, onBack, onOpenScorebook }: GamePlayProps) {
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
  const [elapsed, setElapsed] = useState(0);
  const [pressedTracks, setPressedTracks] = useState<boolean[]>(
    new Array(TRACK_COUNT).fill(false)
  );
  const [savedRecord, setSavedRecord] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(getOrientation());
  const [trackHeightPx, setTrackHeightPx] = useState(0);

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
    });
    playerRef.current = player;

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [song.id]);

  useEffect(() => {
    if (finished && !savedRecord && finalStatsRef.current) {
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
      setSavedRecord(true);
    }
  }, [finished, savedRecord, song.id]);

  function handleStart() {
    setStarted(true);
    setFinished(false);
    setSavedRecord(false);
    setPaused(false);
    setElapsed(0);
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
    setElapsed(0);
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

  const progressPercent = Math.min(
    100,
    (elapsed / (song.duration * 1000)) * 100
  );

  const isPlaying = started && !paused && !finished;

  const chart = useMemo(() => getChartForSong(song.id), [song.id]);
  const totalNotes = chart.totalNotes;
  const totalTapNotes = chart.totalTapNotes ?? 0;
  const totalLongNotes = chart.totalLongNotes ?? 0;

  const isPortrait = orientation === "portrait";

  const H = trackHeightPx || 560;
  const hitLineY = H * HIT_ZONE_RELATIVE;

  function progressToTop(p: number): number {
    return p * hitLineY;
  }

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
        <span className="progress-time">
          {formatDuration(Math.floor(elapsed / 1000))} /{" "}
          {formatDuration(song.duration)}
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
              谱面 {totalTapNotes} 点击 + {totalLongNotes} 长按
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

      {!started && !finished && (
        <div className="start-overlay">
          <div className="start-card">
            <div className="cover-colors" style={{
              background: "linear-gradient(135deg, " + song.coverColor + ", " + song.accentColor + ")",
            }} />
            <h2>{song.title}</h2>
            <div className="meta">
              <span style={{ backgroundColor: difficultyColors[song.difficulty] }}>
                {difficultyLabels[song.difficulty]} Lv.{song.difficultyLevel}
              </span>
              <span>{song.artist}</span>
              <span>{formatDuration(song.duration)}</span>
            </div>
            <p className="start-tip">
              移动端竖屏推荐玩法：双手握住设备，用拇指点击对应编号按钮。<br />
              橙色方块（短）点击，彩色长条（长按）按到底再松开。
            </p>
            <p className="best-score">
              最高分：<strong>{bestScore.toLocaleString()}</strong>
            </p>
            <p className="start-keys">
              <strong>触屏</strong>：按下方彩色按钮　|　<strong>键盘</strong>：D / F / J / K
            </p>
            <button className="start-btn" onClick={handleStart}>
              ▶ 开始演奏
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
            <h2>演奏结束</h2>
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
            <div className="result-calibration">
              <span className="result-calibration-label">延迟校准</span>
              <strong className="result-calibration-value">
                {(() => {
                  const off = getCalibrationOffset();
                  return off === 0 ? "0 ms" : off > 0 ? `+${off} ms` : `${off} ms`;
                })()}
              </strong>
            </div>
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
              <button
                className="ghost-btn"
                onClick={() => onOpenScorebook(song.id)}
              >
                📖 成绩册
              </button>
              <button className="start-btn" onClick={handleRestart}>
                ↺ 再来一次
              </button>
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
