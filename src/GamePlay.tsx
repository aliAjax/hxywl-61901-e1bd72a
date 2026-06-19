import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "./types";
import {
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  saveSongBestScore,
  savePlayRecord,
} from "./songs";

interface GamePlayProps {
  song: Song;
  onBack: () => void;
  onOpenScorebook: (songId?: string | null) => void;
}

interface Note {
  id: number;
  track: number;
  y: number;
  judged: boolean;
}

type JudgeType = "perfect" | "good" | "miss" | null;

const TRACK_COUNT = 4;
const TRACK_LABELS = ["D", "F", "J", "K"];
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

export default function GamePlay({ song, onBack, onOpenScorebook }: GamePlayProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [lastJudge, setLastJudge] = useState<JudgeType>(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pressedTracks, setPressedTracks] = useState<boolean[]>(
    new Array(TRACK_COUNT).fill(false)
  );
  const noteIdRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const spawnTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const bestScore = useMemo(() => getSongBestScore(song.id), [song.id]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, []);

  function playHit(frequency: number = 440, duration: number = 0.1) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "square";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // silent fail
    }
  }

  function startGame() {
    setNotes([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setLastJudge(null);
    setFinished(false);
    setElapsed(0);
    setPlaying(true);
    noteIdRef.current = 0;
    elapsedRef.current = 0;
    startTimeRef.current = performance.now();

    const spawnInterval = Math.max(250, (60000 / song.bpm) * 0.5);

    spawnTimerRef.current = window.setInterval(() => {
      if (elapsedRef.current < song.duration * 1000) {
        const notesToSpawn = Math.max(
          1,
          Math.floor(song.difficultyLevel / 4)
        );
        const usedTracks = new Set<number>();
        for (let i = 0; i < notesToSpawn; i++) {
          let track: number;
          do {
            track = song.previewPattern[
              noteIdRef.current % song.previewPattern.length
            ];
            noteIdRef.current++;
          } while (usedTracks.has(track) && usedTracks.size < TRACK_COUNT);
          usedTracks.add(track);
          setNotes((prev) => [
            ...prev,
            { id: noteIdRef.current, track, y: -60, judged: false },
          ]);
        }
      }
    }, spawnInterval);

    const fallSpeed = 180 + song.bpm * 0.8 + song.difficultyLevel * 8;
    const hitZoneY = 480;

    const loop = () => {
      const now = performance.now();
      elapsedRef.current = now - startTimeRef.current;
      setElapsed(elapsedRef.current);

      setNotes((prev) => {
        const next: Note[] = [];
        let missThisFrame = 0;
        for (const note of prev) {
          const newY = note.y + fallSpeed * (16 / 1000);
          if (!note.judged && newY > hitZoneY + 60) {
            missThisFrame++;
            continue;
          }
          if (newY < 700) {
            next.push({ ...note, y: newY });
          }
        }
        if (missThisFrame > 0) {
          setCombo(0);
          setMissCount((c) => c + missThisFrame);
          setLastJudge("miss");
          setTimeout(() => setLastJudge(null), 300);
        }
        return next;
      });

      if (elapsedRef.current >= song.duration * 1000 + 3000) {
        if (spawnTimerRef.current) {
          clearInterval(spawnTimerRef.current);
        }
        setPlaying(false);
        setFinished(true);
        return;
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
  }

  function judgeNote(track: number) {
    setPressedTracks((prev) => {
      const next = [...prev];
      next[track] = true;
      return next;
    });

    const hitZoneY = 480;
    const perfectRange = 40;
    const goodRange = 80;

    setNotes((prev) => {
      let judged = false;
      const next = prev.map((note) => {
        if (note.track === track && !note.judged && !judged) {
          const distance = Math.abs(note.y - hitZoneY);
          if (distance < goodRange) {
            judged = true;
            const isPerfect = distance < perfectRange;
            const gain = isPerfect ? 300 : 150;
            setScore((s) => s + gain * (1 + Math.floor(combo / 10) * 0.1));
            setCombo((c) => {
              const nc = c + 1;
              setMaxCombo((mc) => Math.max(mc, nc));
              return nc;
            });
            if (isPerfect) {
              setPerfectCount((c) => c + 1);
              setLastJudge("perfect");
            } else {
              setGoodCount((c) => c + 1);
              setLastJudge("good");
            }
            setTimeout(() => setLastJudge(null), 300);
            playHit(440 + track * 110, 0.08);
            return { ...note, judged: true };
          }
        }
        return note;
      });
      return next;
    });

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
      if (!playing) return;
      const key = e.key.toLowerCase();
      const idx = TRACK_LABELS.findIndex((l) => l.toLowerCase() === key);
      if (idx !== -1) {
        e.preventDefault();
        judgeNote(idx);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playing, combo]);

  useEffect(() => {
    if (finished) {
      const finalScore = Math.floor(score);
      if (finalScore > 0) {
        saveSongBestScore(song.id, finalScore);
      }
      savePlayRecord({
        songId: song.id,
        score: finalScore,
        maxCombo,
        perfectCount,
        goodCount,
        missCount,
        completedAt: Date.now(),
      });
    }
  }, [finished, score, song.id, maxCombo, perfectCount, goodCount, missCount]);

  const progressPercent = Math.min(100, (elapsed / (song.duration * 1000)) * 100);

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
            <strong>{Math.floor(score).toLocaleString()}</strong>
          </div>
          <div>
            <div>
              <small>连击</small>
              <strong className="combo-num">{combo}</strong>
            </div>
            </div>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: progressPercent + "%",
            background: "linear-gradient(90deg, " + song.coverColor + ", " + song.accentColor + ")",
          }}
        />
        <span className="progress-time">
          {formatDuration(Math.floor(elapsed / 1000))} / {formatDuration(song.duration)}
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
              {notes
                .filter((n) => n.track === trackIdx && !n.judged)
                .map((note) => {
                  const color1 = TRACK_COLORS[trackIdx];
                  const color2 = TRACK_COLORS[(trackIdx + 1) % TRACK_COLORS.length];
                  return (
                    <div
                      key={note.id}
                      className="note"
                      style={{
                        top: note.y,
                        background: "linear-gradient(180deg, " + color1 + ", " + color2 + ")",
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
            <div className={`judge-display judge-${lastJudge}`}>
              {lastJudge === "perfect"
                ? "PERFECT!"
                : lastJudge === "good"
                ? "GOOD"
                : "MISS"}
            </div>
          )}

          {combo >= 5 && (
            <div className="combo-display">
              <span className="combo-text">{combo}</span>
              <span className="combo-label">COMBO</span>
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
              className={"track-btn " + (pressedTracks[idx] ? "pressed" : "")}
              style={{
                background: "linear-gradient(180deg, " + color + "aa, " + color + ")",
                boxShadow: pressedTracks[idx] ? "0 0 30px " + color : "none",
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                judgeNote(idx);
              }}
              onMouseDown={() => judgeNote(idx)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!playing && !finished && (
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
            <button className="start-game-btn" onClick={startGame}>
              开始演奏
            </button>
          </div>
        </div>
      )}

      {finished && (
        <div className="result-overlay">
          <div className="result-content">
            <h2>演奏完成！</h2>
            <div className="result-score">
              <small>最终得分</small>
              <strong>{Math.floor(score).toLocaleString()}</strong>
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
              <button className="result-btn primary" onClick={startGame}>
                再来一次
              </button>
              <button className="result-btn" onClick={() => onOpenScorebook(song.id)}>
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
