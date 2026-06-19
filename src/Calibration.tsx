import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCalibrationOffset,
  saveCalibrationOffset,
  resetCalibrationOffset,
} from "./songs";

const CALIBRATION_BPM = 120;
const BEAT_INTERVAL_MS = 60000 / CALIBRATION_BPM;
const TOTAL_BEATS = 16;
const COUNTDOWN_BEATS = 4;

interface CalibrationProps {
  onBack: () => void;
}

interface TapResult {
  beatIndex: number;
  offset: number;
}

export default function Calibration({ onBack }: CalibrationProps) {
  const [phase, setPhase] = useState<"idle" | "countdown" | "tapping" | "done">("idle");
  const [countdownNum, setCountdownNum] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [tapResults, setTapResults] = useState<TapResult[]>([]);
  const [recommendedOffset, setRecommendedOffset] = useState(0);
  const [savedOffset, setSavedOffset] = useState(getCalibrationOffset());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const beatTimerRef = useRef<number | null>(null);
  const beatStartTimeRef = useRef(0);
  const phaseRef = useRef(phase);
  const tapResultsRef = useRef<TapResult[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    tapResultsRef.current = tapResults;
  }, [tapResults]);

  useEffect(() => {
    return () => {
      if (beatTimerRef.current) {
        clearInterval(beatTimerRef.current);
      }
      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch {}
    };
  }, []);

  const ensureAudioCtx = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playClick = useCallback(
    (accent: boolean) => {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = accent ? "sine" : "triangle";
        osc.frequency.value = accent ? 880 : 660;
        gain.gain.setValueAtTime(accent ? 0.25 : 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.1);
      } catch {}
    },
    [ensureAudioCtx]
  );

  const startCalibration = useCallback(() => {
    ensureAudioCtx();
    setPhase("countdown");
    setCountdownNum(COUNTDOWN_BEATS);
    setTapResults([]);
    tapResultsRef.current = [];
    setCurrentBeat(0);

    let count = COUNTDOWN_BEATS;
    playClick(true);
    setCountdownNum(count);

    const countdownTimer = window.setInterval(() => {
      count--;
      if (count > 0) {
        playClick(true);
        setCountdownNum(count);
      } else {
        clearInterval(countdownTimer);
        setPhase("tapping");
        const startT = performance.now();
        beatStartTimeRef.current = startT;
        setCurrentBeat(0);

        let beatIdx = 0;
        playClick(beatIdx % 4 === 0);
        setCurrentBeat(beatIdx);

        beatTimerRef.current = window.setInterval(() => {
          beatIdx++;
          if (beatIdx >= TOTAL_BEATS) {
            if (beatTimerRef.current) {
              clearInterval(beatTimerRef.current);
              beatTimerRef.current = null;
            }
            setPhase("done");
            return;
          }
          playClick(beatIdx % 4 === 0);
          setCurrentBeat(beatIdx);
        }, BEAT_INTERVAL_MS);
      }
    }, BEAT_INTERVAL_MS);
  }, [ensureAudioCtx, playClick]);

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "tapping") return;

    const now = performance.now();
    const elapsed = now - beatStartTimeRef.current;
    const nearestBeatIndex = Math.round(elapsed / BEAT_INTERVAL_MS);
    const nearestBeatTime = nearestBeatIndex * BEAT_INTERVAL_MS;
    const offset = elapsed - nearestBeatTime;

    const result: TapResult = {
      beatIndex: nearestBeatIndex,
      offset,
    };

    tapResultsRef.current = [...tapResultsRef.current, result];
    setTapResults([...tapResultsRef.current]);
  }, []);

  const handleFinish = useCallback(() => {
    if (tapResultsRef.current.length < 4) return;

    const offsets = tapResultsRef.current.map((r) => r.offset);
    offsets.sort((a, b) => a - b);
    const trim = Math.floor(offsets.length * 0.1);
    const trimmed =
      offsets.length > 4
        ? offsets.slice(trim, offsets.length - trim)
        : offsets;
    const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;

    setRecommendedOffset(Math.round(avg));
  }, []);

  useEffect(() => {
    if (phase === "done" && tapResults.length > 0) {
      handleFinish();
    }
  }, [phase, tapResults.length, handleFinish]);

  const handleSave = useCallback(() => {
    saveCalibrationOffset(recommendedOffset);
    setSavedOffset(recommendedOffset);
  }, [recommendedOffset]);

  const handleReset = useCallback(() => {
    resetCalibrationOffset();
    setSavedOffset(0);
    setRecommendedOffset(0);
    setTapResults([]);
    setPhase("idle");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phaseRef.current === "idle") {
          startCalibration();
        } else if (phaseRef.current === "tapping") {
          handleTap();
        }
      }
      if (e.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startCalibration, handleTap, onBack]);

  function formatOffset(ms: number): string {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  }

  return (
    <div className="calibration">
      <header className="calibration-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <div>
          <h1 className="select-title">延迟校准</h1>
          <p className="select-subtitle">
            跟随节拍点击，系统自动计算推荐校准值
          </p>
        </div>
      </header>

      <div className="calibration-card">
        {phase === "idle" && (
          <div className="calibration-idle">
            <div className="calibration-icon">🎯</div>
            <h2 className="calibration-title">准备校准</h2>
            <p className="calibration-desc">
              系统会播放 {CALIBRATION_BPM} BPM 的固定节拍（共 {TOTAL_BEATS} 拍），
              请尽量精准地跟随每一次节拍点击。校准值会用于调整游戏判定时间窗，
              补偿你的设备输入延迟。
            </p>
            <div className="calibration-current">
              <span className="calibration-current-label">当前校准值</span>
              <strong className="calibration-current-value">
                {formatOffset(savedOffset)}
              </strong>
            </div>
            <button className="start-btn calibration-start-btn" onClick={startCalibration}>
              ▶ 开始校准
            </button>
            <p className="calibration-hint">按空格键快速开始</p>
          </div>
        )}

        {phase === "countdown" && (
          <div className="calibration-countdown">
            <div className="countdown-num">{countdownNum}</div>
            <p className="calibration-desc">准备好，跟随节拍…</p>
          </div>
        )}

        {phase === "tapping" && (
          <div className="calibration-tapping">
            <div className="calibration-beat-visual">
              <div
                className={`beat-ring ${currentBeat % 4 === 0 ? "beat-accent" : ""}`}
                key={currentBeat}
              />
            </div>
            <div className="calibration-tap-info">
              <span className="calibration-beat-count">
                {currentBeat + 1} / {TOTAL_BEATS}
              </span>
              <span className="calibration-tap-count">
                已点击 {tapResults.length} 次
              </span>
            </div>
            <button
              className="calibration-tap-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                handleTap();
              }}
            >
              TAP
            </button>
            <p className="calibration-hint">跟随节拍点击按钮或按空格键</p>
          </div>
        )}

        {phase === "done" && (
          <div className="calibration-done">
            <div className="calibration-icon">✅</div>
            <h2 className="calibration-title">校准完成</h2>

            <div className="calibration-result-grid">
              <div className="calibration-stat">
                <small>有效点击</small>
                <strong>{tapResults.length}</strong>
              </div>
              <div className="calibration-stat">
                <small>平均偏差</small>
                <strong>
                  {tapResults.length > 0
                    ? formatOffset(
                        Math.round(
                          tapResults.reduce((s, r) => s + r.offset, 0) /
                            tapResults.length
                        )
                      )
                    : "—"}
                </strong>
              </div>
              <div className="calibration-stat">
                <small>推荐校准值</small>
                <strong className="calibration-recommend">
                  {formatOffset(recommendedOffset)}
                </strong>
              </div>
              <div className="calibration-stat">
                <small>当前使用</small>
                <strong>{formatOffset(savedOffset)}</strong>
              </div>
            </div>

            <div className="calibration-offset-chart">
              {tapResults.map((r, i) => {
                const barWidth = Math.min(Math.abs(r.offset) / 3, 100);
                const isLate = r.offset > 0;
                return (
                  <div key={i} className="offset-bar-row">
                    <span className="offset-bar-label">{i + 1}</span>
                    <div className="offset-bar-track">
                      <div className="offset-bar-center" />
                      <div
                        className={`offset-bar ${isLate ? "offset-late" : "offset-early"}`}
                        style={{
                          width: barWidth + "%",
                          marginLeft: isLate ? "50%" : 50 - barWidth + "%",
                        }}
                      />
                    </div>
                    <span className="offset-bar-value">
                      {Math.round(r.offset)}ms
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="calibration-explain">
              {recommendedOffset > 0
                ? `你倾向于晚点 ${recommendedOffset}ms，建议校准后游戏判定窗会前移，让你更容易命中。`
                : recommendedOffset < 0
                ? `你倾向于早点 ${Math.abs(recommendedOffset)}ms，建议校准后游戏判定窗会后移，让你更容易命中。`
                : "你的点击时机非常精准，无需校准！"}
            </p>

            <div className="calibration-actions">
              <button className="start-btn" onClick={handleSave}>
                💾 应用推荐校准值
              </button>
              <button className="ghost-btn" onClick={startCalibration}>
                ↺ 重新校准
              </button>
              <button className="ghost-btn" onClick={handleReset}>
                🔄 重置为 0
              </button>
              <button className="ghost-btn" onClick={onBack}>
                ← 返回选曲
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
