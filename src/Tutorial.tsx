import { useEffect, useMemo, useRef, useState } from "react";
import {
  difficultyLabels,
  difficultyColors,
  formatDuration,
  markTutorialCompleted,
  tutorialSteps,
  tutorialSong,
} from "./songs";
import type { TutorialStep } from "./songs";

interface TutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface Note {
  id: number;
  track: number;
  y: number;
  judged: boolean;
  forceMiss?: boolean;
}

type JudgeType = "perfect" | "good" | "miss" | null;

const TRACK_COUNT = 4;
const TRACK_LABELS = ["D", "F", "J", "K"];
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

export default function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [lastJudge, setLastJudge] = useState<JudgeType>(null);
  const [finished, setFinished] = useState(false);
  const [pressedTracks, setPressedTracks] = useState<boolean[]>(
    new Array(TRACK_COUNT).fill(false)
  );
  const [hitsNeeded, setHitsNeeded] = useState(0);
  const [hitsDone, setHitsDone] = useState(0);
  const [showFinalResult, setShowFinalResult] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const noteIdRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const spawnTimerRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const spawnCountRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentStep: TutorialStep | undefined = tutorialSteps[stepIndex];

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
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

  function goToNextStep() {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    spawnCountRef.current = 0;
    setHitsDone(0);
    setHitsNeeded(0);

    if (stepIndex >= tutorialSteps.length - 1) {
      setFinished(true);
      markTutorialCompleted();
      setShowFinalResult(true);
      return;
    }

    setStepIndex((prev: number) => prev + 1);
  }

  useEffect(() => {
    if (!currentStep || isRestarting) return;

    setNotes([]);
    noteIdRef.current = 0;
    spawnCountRef.current = 0;

    if (currentStep.requireUserAction && currentStep.autoSpawnPattern) {
      setHitsNeeded(currentStep.autoSpawnPattern.length);
      setHitsDone(0);
      startSpawnLoop(currentStep);
    } else if (currentStep.autoSpawnPattern) {
      startSpawnLoop(currentStep);
      if (currentStep.waitMs) {
        stepTimerRef.current = window.setTimeout(goToNextStep, currentStep.waitMs);
      }
    } else if (currentStep.waitMs) {
      stepTimerRef.current = window.setTimeout(goToNextStep, currentStep.waitMs);
    }

    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, isRestarting]);

  useEffect(() => {
    if (isRestarting) {
      const t = window.setTimeout(() => setIsRestarting(false), 100);
      return () => clearTimeout(t);
    }
  }, [isRestarting]);

  function startSpawnLoop(step: TutorialStep) {
    if (!step.autoSpawnPattern || !step.autoSpawnInterval) return;
    const pattern = step.autoSpawnPattern;
    let localIdx = 0;
    const totalSpawns = step.requireUserAction ? pattern.length * 999 : pattern.length;

    if (step.requireUserAction) {
      spawnTimerRef.current = window.setInterval(() => {
        if (spawnCountRef.current >= pattern.length) {
          if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
          }
          return;
        }
        const track = pattern[localIdx % pattern.length];
        noteIdRef.current++;
        setNotes((prev) => [
          ...prev,
          {
            id: noteIdRef.current,
            track,
            y: -60,
            judged: false,
            forceMiss: step.forceMiss,
          },
        ]);
        spawnCountRef.current++;
        localIdx++;
      }, step.autoSpawnInterval);
    } else {
      spawnTimerRef.current = window.setInterval(() => {
        if (spawnCountRef.current >= totalSpawns) {
          if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
          }
          return;
        }
        const track = pattern[localIdx % pattern.length];
        noteIdRef.current++;
        setNotes((prev) => [
          ...prev,
          {
            id: noteIdRef.current,
            track,
            y: -60,
            judged: false,
            forceMiss: step.forceMiss,
          },
        ]);
        spawnCountRef.current++;
        localIdx++;
      }, step.autoSpawnInterval);
    }
  }

  const fallSpeed = 140;
  const hitZoneY = 480;

  useEffect(() => {
    const loop = () => {
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
      gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  function judgeNote(track: number) {
    if (!currentStep) return;
    if (currentStep.forceMiss) return;

    setPressedTracks((prev) => {
      const next = [...prev];
      next[track] = true;
      return next;
    });

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

            if (currentStep.requireUserAction) {
              setHitsDone((h) => {
                const newHits = h + 1;
                if (newHits >= hitsNeeded) {
                  setTimeout(goToNextStep, 600);
                }
                return newHits;
              });
            }

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
      if (finished) return;
      const key = e.key.toLowerCase();
      const idx = TRACK_LABELS.findIndex((l) => l.toLowerCase() === key);
      if (idx !== -1) {
        e.preventDefault();
        judgeNote(idx);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, hitsNeeded, currentStep, finished]);

  function handleRestart() {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setStepIndex(0);
    setNotes([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setLastJudge(null);
    setFinished(false);
    setShowFinalResult(false);
    setHitsNeeded(0);
    setHitsDone(0);
    noteIdRef.current = 0;
    spawnCountRef.current = 0;
    setIsRestarting(true);
  }

  function handleSkip() {
    markTutorialCompleted();
    onSkip();
  }

  const progressPercent = ((stepIndex + 1) / tutorialSteps.length) * 100;

  const stepProgressText = useMemo(() => {
    if (!currentStep?.requireUserAction) return `${stepIndex + 1} / ${tutorialSteps.length}`;
    return `${stepIndex + 1} / ${tutorialSteps.length}  (${hitsDone}/${hitsNeeded})`;
  }, [stepIndex, currentStep, hitsDone, hitsNeeded]);

  return (
    <div className="game-play tutorial-play">
      <div className="play-header">
        <button className="back-btn" onClick={handleSkip}>
          ← 跳过教学
        </button>
        <div className="play-song-info">
          <h2 className="play-song-title">📘 {tutorialSong.title}</h2>
          <span
            className="play-song-diff"
            style={{ backgroundColor: difficultyColors[tutorialSong.difficulty] }}
          >
            {difficultyLabels[tutorialSong.difficulty]} Lv.{tutorialSong.difficultyLevel}
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
            background:
              "linear-gradient(90deg, " +
              tutorialSong.coverColor +
              ", " +
              tutorialSong.accentColor +
              ")",
          }}
        />
        <span className="progress-time">
          步骤 {stepProgressText} · 预估剩余 {formatDuration(Math.max(0, Math.ceil((tutorialSteps.length - stepIndex - 1) * 4)))}
        </span>
      </div>

      {currentStep && !showFinalResult && (
        <div className="tutorial-tip-card">
          <div className="tutorial-step-num">步骤 {stepIndex + 1}</div>
          <h3 className="tutorial-tip-title">{currentStep.title}</h3>
          <p className="tutorial-tip-desc">{currentStep.description}</p>
          <div className="tutorial-tip-actions">
            <button className="tutorial-next-btn" onClick={goToNextStep}>
              下一步 →
            </button>
          </div>
        </div>
      )}

      <div className="play-area">
        <div className="tracks-container">
          {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => {
            const highlighted = currentStep?.highlightTrack === trackIdx;
            return (
              <div
                key={trackIdx}
                className={`track ${pressedTracks[trackIdx] ? "pressed" : ""} ${
                  highlighted ? "highlighted" : ""
                }`}
                style={{ borderColor: TRACK_COLORS[trackIdx] + "55" }}
              >
                {notes
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
                            "linear-gradient(180deg, " +
                            color1 +
                            ", " +
                            color2 +
                            ")",
                          boxShadow: "0 0 20px " + color1 + "80",
                        }}
                      />
                    );
                  })}
                <div
                  className={`hit-zone ${highlighted ? "highlighted" : ""}`}
                  style={{ borderColor: TRACK_COLORS[trackIdx] }}
                >
                  <span className="hit-label">{TRACK_LABELS[trackIdx]}</span>
                </div>
              </div>
            );
          })}

          {lastJudge && (
            <div className={`judge-display judge-${lastJudge}`}>
              {lastJudge === "perfect"
                ? "PERFECT!"
                : lastJudge === "good"
                ? "GOOD"
                : "MISS"}
            </div>
          )}

          {combo >= 2 && (
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
          const highlighted = currentStep?.highlightTrack === idx;
          return (
            <button
              key={idx}
              className={
                "track-btn " +
                (pressedTracks[idx] ? "pressed" : "") +
                (highlighted ? " highlighted-btn" : "")
              }
              style={{
                background:
                  "linear-gradient(180deg, " +
                  color +
                  "aa, " +
                  color +
                  ")",
                boxShadow: pressedTracks[idx]
                  ? "0 0 30px " + color
                  : highlighted
                  ? "0 0 24px " + color + "aa"
                  : "none",
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

      {showFinalResult && (
        <div className="result-overlay">
          <div className="result-content tutorial-result">
            <div className="tutorial-result-badge">🎓</div>
            <h2>教学完成！</h2>
            <p className="tutorial-result-subtitle">你已掌握所有基础操作</p>
            <div className="result-score">
              <small>练习得分</small>
              <strong>{Math.floor(score).toLocaleString()}</strong>
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
              <button className="result-btn primary" onClick={onComplete}>
                开始挑战歌曲
              </button>
              <button className="result-btn" onClick={handleRestart}>
                🔄 重新观看教学
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
