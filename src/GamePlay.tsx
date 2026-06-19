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
} from "./songs";
import { ChartPlayer, type SpawnedNote, TRACK_HEIGHT, HIT_ZONE_BOTTOM } from "./chartPlayer";
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
  const [started, setStarted] = useState(false);

  const [activeNotes, setActiveNotes] = useState<Map<number, ActiveNote>>(new Map());
  const [noteEndYs, setNoteEndYs] = useState<Map<number, number>>(new Map());
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

  const bestScore = useMemo(() => getSongBestScore(song.id), [song.id]);
  const finalStatsRef = useRef<GameStats | null>(null);
  const activePointersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const handleResize = () => {
      setOrientation(getOrientation());
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
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
        if (spawned.type === "long" && spawned.endTime !== undefined) {
          setNoteEndYs((prev) => {
            const next = new Map(prev);
            next.set(spawned.id, -60);
            return next;
          });
        }
      },
      onNoteUpdate: (id: number, y: number, endY?: number) => {
        setActiveNotes((prev) => {
          const existing = prev.get(id);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(id, { ...existing, y });
          return next;
        });
        if (endY !== undefined) {
          setNoteEndYs((prev) => {
            const next = new Map(prev);
            next.set(id, endY);
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
        setNoteEndYs((prev) => {
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
    setNoteEndYs(new Map());
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

  function handleResume() {
    if (!playerRef.current) return;
    if (playerRef.current.isPaused()) {
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
    setNoteEndYs(new Map());
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

    if (playerRef.current.isPlaying()) {
      playerRef.current.judgeTrackRelease(track);
    }
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

  const hitZoneY = TRACK_HEIGHT - HIT_ZONE_BOTTOM - 25;

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
          className="tracks-container"
          style={isPortrait ? { height: "auto", aspectRatio: undefined } : {}}
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
                  const endY = noteEndYs.get(note.id);

                  if (note.type === "long" && endY !== undefined) {
                    const noteTop = Math.min(note.y, endY);
                    const noteBottom = Math.max(note.y, endY);
                    const noteHeight = Math.max(28, noteBottom - noteTop);
                    return (
                      <div key={note.id}>
                        <div
                          className={`note-long-tail ${note.longHolding ? "holding" : ""}`}
                          style={{
                            top: noteTop,
                            height: noteHeight,
                            background: `linear-gradient(180deg, ${color1}60, ${color2}80)`,
                            borderColor: color1,
                          }}
                        />
                        <div
                          className="note note-long-head"
                          style={{
                            top: endY,
                            background:
                              "linear-gradient(180deg, " + color1 + ", " + color2 + ")",
                            boxShadow: "0 0 20px " + color1 + "80",
                          }}
                        />
                        <div
                          className="note note-long-start"
                          style={{
                            top: note.y,
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
                        top: note.y,
                        background:
                          "linear-gradient(180deg, " + color1 + ", " + color2 + ")",
                        boxShadow: "0 0 20px " + color1 + "80",
                      }}
                    />
                  );
                })}
              <div
                className="hit-zone"
                style={{ borderColor: TRACK_COLORS[trackIdx] }}
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
          <div className="start-content">
            <button className="overlay-back-btn" onClick={onBack}>
              ← 返回选曲
            </button>
            <h2>{song.title}</h2>
            <p>{song.artist}</p>
            <div className="start-info">
              <span>BPM: {song.bpm}</span>
              <span>最高分: {bestScore.toLocaleString()}</span>
            </div>
            <div className="chart-info-tag">
              🎼 已加载谱面 · 共 {totalTapNotes} 点击 + {totalLongNotes} 长按
            </div>
            <div className="mobile-hint">
              📱 点击下方轨道按钮或直接点击轨道游玩
            </div>
            <button className="start-game-btn" onClick={handleStart}>
              开始演奏
            </button>
          </div>
        </div>
      )}

      {paused && started && !finished && (
        <div className="pause-overlay">
          <div className="pause-content">
            <div className="pause-indicator">❚❚</div>
            <h2>已暂停</h2>
            <p>按空格键或 ESC 继续</p>
            <div className="pause-stats">
              <div>
                <small>当前分数</small>
                <strong>{score.toLocaleString()}</strong>
              </div>
              <div>
                <small>连击</small>
                <strong className="combo-num">{combo}</strong>
              </div>
            </div>
            <div className="result-actions">
              <button
                className="result-btn primary"
                onClick={handleResume}
              >
                ▶ 继续游戏
              </button>
              <button className="result-btn" onClick={handleRestart}>
                🔄 重新开始
              </button>
              <button className="result-btn" onClick={onBack}>
                ← 返回选曲
              </button>
            </div>
          </div>
        </div>
      )}

      {finished && (
        <div className="result-overlay">
          <div className="result-content">
            <h2>演奏完成！</h2>
            <div className="result-score">
              <small>最终得分</small>
              <strong>{score.toLocaleString()}</strong>
              {score >= bestScore && score > 0 && (
                <span className="new-record">新纪录！</span>
              )}
            </div>

            <div className="result-summary-section">
              <h3 className="result-section-title">总览</h3>
              <div className="result-stats">
                <div>
                  <small>Perfect</small>
                  <strong className="perfect-text">{perfectCount}</strong>
                </div>
                <div>
                  <small>Good</small>
                  <strong className="good-text">{goodCount}</strong>
                </div>
                <div>
                  <small>Miss</small>
                  <strong className="miss-text">{missCount}</strong>
                </div>
                <div>
                  <small>最大连击</small>
                  <strong>{maxCombo}</strong>
                </div>
              </div>
            </div>

            <div className="result-summary-section">
              <h3 className="result-section-title">点击音符</h3>
              <div className="result-stats result-stats-small">
                <div>
                  <small>Perfect</small>
                  <strong className="perfect-text">{tapPerfectCount}</strong>
                  <span className="stat-total">/ {totalTapNotes}</span>
                </div>
                <div>
                  <small>Good</small>
                  <strong className="good-text">{tapGoodCount}</strong>
                </div>
                <div>
                  <small>Miss</small>
                  <strong className="miss-text">{tapMissCount}</strong>
                </div>
              </div>
            </div>

            <div className="result-summary-section">
              <h3 className="result-section-title">长按音符</h3>
              <div className="result-stats result-stats-small">
                <div>
                  <small>Perfect</small>
                  <strong className="perfect-text">{longPerfectCount}</strong>
                  <span className="stat-total">/ {totalLongNotes}</span>
                </div>
                <div>
                  <small>Good</small>
                  <strong className="good-text">{longGoodCount}</strong>
                </div>
                <div>
                  <small>Miss</small>
                  <strong className="miss-text">{longMissCount}</strong>
                </div>
              </div>
            </div>

            <div className="result-actions">
              <button className="result-btn primary" onClick={handleRestart}>
                再来一次
              </button>
              <button
                className="result-btn"
                onClick={() => onOpenScorebook(song.id)}
              >
                📋 查看成绩册
              </button>
              <button className="result-btn" onClick={onBack}>
                返回选曲
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
