import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "./types";
import type { ActiveNote, GameStats, JudgeType } from "./types";
import {
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  saveSongBestScore,
  savePlayRecord,
} from "./songs";
import { ChartPlayer, type SpawnedNote } from "./chartPlayer";
import { getChartForSong } from "./charts";

interface GamePlayProps {
  song: Song;
  onBack: () => void;
  onOpenScorebook: (songId?: string | null) => void;
}

const TRACK_COUNT = 4;
const TRACK_LABELS = ["D", "F", "J", "K"];
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

export default function GamePlay({ song, onBack, onOpenScorebook }: GamePlayProps) {
  const playerRef = useRef<ChartPlayer | null>(null);
  const [started, setStarted] = useState(false);

  const [activeNotes, setActiveNotes] = useState<Map<number, ActiveNote>>(new Map());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [lastJudge, setLastJudge] = useState<JudgeType>(null);
  const [lastJudgeTrack, setLastJudgeTrack] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pressedTracks, setPressedTracks] = useState<boolean[]>(
    new Array(TRACK_COUNT).fill(false)
  );
  const [savedRecord, setSavedRecord] = useState(false);

  const bestScore = useMemo(() => getSongBestScore(song.id), [song.id]);
  const finalStatsRef = useRef<GameStats | null>(null);

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
          });
          return next;
        });
      },
      onNoteUpdate: (id: number, y: number) => {
        setActiveNotes((prev) => {
          const existing = prev.get(id);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(id, { ...existing, y });
          return next;
        });
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
      },
      onJudge: (judge: JudgeType, track: number) => {
        setLastJudge(judge);
        setLastJudgeTrack(track);
        setTimeout(() => {
          setLastJudge((cur) => (cur === judge ? null : cur));
        }, 300);
      },
      onStatsChange: (stats: GameStats) => {
        setScore(Math.floor(stats.score));
        setCombo(stats.combo);
        setMaxCombo(stats.maxCombo);
        setPerfectCount(stats.perfectCount);
        setGoodCount(stats.goodCount);
        setMissCount(stats.missCount);
      },
      onTimeUpdate: (elapsedMs: number) => {
        setElapsed(elapsedMs);
      },
      onFinish: (finalStats: GameStats) => {
        finalStatsRef.current = finalStats;
        setFinished(true);
        setPaused(false);
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
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setLastJudge(null);
    finalStatsRef.current = null;
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
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setLastJudge(null);
    finalStatsRef.current = null;
    playerRef.current?.restart();
  }

  function judgeNote(track: number) {
    if (!playerRef.current) return;
    if (!playerRef.current.isPlaying()) return;

    setPressedTracks((prev) => {
      const next = [...prev];
      next[track] = true;
      return next;
    });

    playerRef.current.judgeTrack(track);

    setTimeout(() => {
      setPressedTracks((prev) => {
        const next = [...prev];
        next[track] = false;
        return next;
      });
    }, 100);
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
      const idx = TRACK_LABELS.findIndex((l) => l.toLowerCase() === key);
      if (idx !== -1) {
        e.preventDefault();
        judgeNote(idx);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished]);

  const progressPercent = Math.min(
    100,
    (elapsed / (song.duration * 1000)) * 100
  );

  const isPlaying = started && !paused && !finished;

  const chart = useMemo(() => getChartForSong(song.id), [song.id]);
  const totalNotes = chart.totalNotes;

  return (
    <div className="game-play">
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

      <div className="play-area">
        <div className="tracks-container">
          {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => (
            <div
              key={trackIdx}
              className={`track ${pressedTracks[trackIdx] ? "pressed" : ""}`}
              style={{ borderColor: TRACK_COLORS[trackIdx] + "55" }}
            >
              {Array.from(activeNotes.values())
                .filter((n) => n.track === trackIdx && !n.judged)
                .map((note) => {
                  const color1 = TRACK_COLORS[trackIdx];
                  const color2 =
                    TRACK_COLORS[(trackIdx + 1) % TRACK_COLORS.length];
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
              className={`judge-display judge-${lastJudge}`}
              key={lastJudge + "-" + lastJudgeTrack + "-" + Math.random()}
            >
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
              谱面 {totalNotes} 音符
            </div>
          )}
        </div>
      </div>

      <div className="track-buttons">
        {TRACK_LABELS.map((label, idx) => {
          const color = TRACK_COLORS[idx];
          return (
            <button
              key={idx}
              className={
                "track-btn " + (pressedTracks[idx] ? "pressed" : "")
              }
              style={{
                background:
                  "linear-gradient(180deg, " + color + "aa, " + color + ")",
                boxShadow: pressedTracks[idx]
                  ? "0 0 30px " + color
                  : "none",
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                judgeNote(idx);
              }}
              onMouseDown={() => judgeNote(idx)}
              disabled={!isPlaying}
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
              🎼 已加载谱面 · 共 {totalNotes} 音符
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
