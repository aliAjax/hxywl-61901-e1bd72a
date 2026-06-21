import { useState, useMemo, useCallback } from "react";
import type { PlayRecord, ChartDifficulty, ReplayData, ReplayVerificationResult } from "./types";
import {
  songs,
  difficultyLabels,
  difficultyColors,
  getPlayRecords,
  getSongBestScore,
  calcRecordAccuracy,
  calcRecordGrade,
  calcAccuracy,
  calcGrade,
  GRADE_COLORS,
  GRADE_ORDER,
  CHART_DIFFICULTIES,
  CHART_DIFFICULTY_INFO,
  getReplayData,
  type Grade,
} from "./songs";
import { getChartForSong } from "./charts";
import { verifyReplay } from "./replayEngine";

interface ScoreBookProps {
  initialSongId?: string | null;
  initialDifficulty?: ChartDifficulty | null;
  onBack: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return `${min}:${sec.toString().padStart(2, "0")}.${frac}`;
}

const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];

function ReplayTimeline({ replay }: { replay: ReplayData }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const allEvents = useMemo(() => {
    const events: { kind: "input" | "judge" | "pause" | "sync"; time: number; data: unknown }[] = [];
    for (const e of replay.inputEvents) {
      events.push({ kind: "input", time: e.elapsedMs, data: e });
    }
    for (const e of replay.judgeEvents) {
      events.push({ kind: "judge", time: e.elapsedMs, data: e });
    }
    for (const e of replay.pauseNodes) {
      events.push({ kind: "pause", time: e.elapsedMs, data: e });
    }
    for (const e of replay.syncEvents) {
      events.push({ kind: "sync", time: e.elapsedMs, data: e });
    }
    return events.sort((a, b) => a.time - b.time);
  }, [replay]);

  const maxTime = useMemo(() => {
    if (allEvents.length === 0) return 1;
    return Math.max(...allEvents.map((e) => e.time), 1);
  }, [allEvents]);

  const inputEvents = replay.inputEvents;
  const judgeEvents = replay.judgeEvents.filter((e) => e.noteId >= 0);

  return (
    <div className="replay-timeline">
      <div className="replay-timeline-header">
        <span>时间轴 · {formatMs(maxTime)}</span>
        <span className="replay-timeline-stats">
          输入 {inputEvents.length} 次 · 判定 {judgeEvents.length} 次
          {replay.pauseNodes.length > 0 && ` · 暂停 ${replay.pauseNodes.filter(p => p.type === "pause").length} 次`}
          {replay.syncEvents.length > 0 && ` · 同步事件 ${replay.syncEvents.length} 次`}
        </span>
      </div>

      <div className="replay-timeline-track-container">
        {[0, 1, 2, 3].map((track) => {
          const trackInputs = inputEvents.filter((e) => e.track === track);
          const trackJudges = judgeEvents.filter((e) => e.track === track);
          return (
            <div key={track} className="replay-timeline-track-row">
              <div className="replay-timeline-track-label" style={{ color: TRACK_COLORS[track] }}>
                T{track + 1}
              </div>
              <div className="replay-timeline-track-bar" style={{ borderColor: TRACK_COLORS[track] + "40" }}>
                {trackInputs.map((e, i) => (
                  <div
                    key={`in-${i}`}
                    className={`replay-timeline-marker marker-input marker-${e.type}`}
                    style={{
                      left: `${(e.elapsedMs / maxTime) * 100}%`,
                      backgroundColor: e.type === "press" ? TRACK_COLORS[track] : TRACK_COLORS[track] + "60",
                    }}
                    title={`${e.type === "press" ? "按下" : "松开"} T${track + 1} @ ${formatMs(e.elapsedMs)} | 校准 ${e.calibrationOffsetMs}ms`}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                ))}
                {trackJudges.map((e, i) => {
                  const judgeColor = e.judge === "perfect" ? "#34d399" : e.judge === "good" ? "#facc15" : "#ef4444";
                  return (
                    <div
                      key={`jg-${i}`}
                      className={`replay-timeline-marker marker-judge marker-judge-${e.judge}`}
                      style={{
                        left: `${(e.elapsedMs / maxTime) * 100}%`,
                        backgroundColor: judgeColor,
                        top: e.phase === "end" ? 12 : 2,
                      }}
                      title={`${e.judge?.toUpperCase()} T${track + 1} #${e.noteId} ${e.phase === "end" ? "尾" : "头"} | 偏差 ${e.distanceMs.toFixed(1)}ms`}
                      onMouseEnter={() => setHoverIdx(inputEvents.length + i)}
                      onMouseLeave={() => setHoverIdx(null)}
                    />
                  );
                })}
                {replay.pauseNodes
                  .filter((p) => p.type === "pause")
                  .map((p, i) => (
                    <div
                      key={`pause-${i}`}
                      className="replay-timeline-marker marker-pause"
                      style={{ left: `${(p.elapsedMs / maxTime) * 100}%` }}
                      title={`暂停 @ ${formatMs(p.elapsedMs)}`}
                    />
                  ))}
                {replay.syncEvents.map((s, i) => (
                  <div
                    key={`sync-${i}`}
                    className="replay-timeline-marker marker-sync"
                    style={{ left: `${(s.elapsedMs / maxTime) * 100}%` }}
                    title={`${s.type === "visibility_change" ? "页面切换" : s.type === "low_frame" ? "低帧率" : "重同步"} @ ${formatMs(s.elapsedMs)}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="replay-timeline-legend">
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#4f46e5" }} /> 按下</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#4f46e560" }} /> 松开</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#34d399" }} /> Perfect</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#facc15" }} /> Good</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#ef4444" }} /> Miss</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#f97316" }} /> 暂停</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: "#a78bfa" }} /> 同步事件</span>
      </div>

      <div className="replay-timeline-details">
        <div className="replay-details-section">
          <div className="replay-details-title">输入记录 ({inputEvents.length})</div>
          <div className="replay-details-list">
            {inputEvents.slice(0, 50).map((e, i) => (
              <div key={i} className="replay-detail-row">
                <span className={`detail-type ${e.type}`}>{e.type === "press" ? "▼" : "▲"}</span>
                <span className="detail-track" style={{ color: TRACK_COLORS[e.track] }}>T{e.track + 1}</span>
                <span className="detail-time">{formatMs(e.elapsedMs)}</span>
                <span className="detail-calib">校准 {e.calibrationOffsetMs}ms</span>
                <span className="detail-baseline">基准 {e.deviceBaselineOffsetMs}ms</span>
              </div>
            ))}
            {inputEvents.length > 50 && <div className="detail-more">... 共 {inputEvents.length} 条</div>}
          </div>
        </div>

        <div className="replay-details-section">
          <div className="replay-details-title">判定记录 ({judgeEvents.length})</div>
          <div className="replay-details-list">
            {judgeEvents.slice(0, 50).map((e, i) => (
              <div key={i} className="replay-detail-row">
                <span className={`detail-judge judge-${e.judge}`}>{e.judge?.toUpperCase()}</span>
                <span className="detail-track" style={{ color: TRACK_COLORS[e.track] }}>T{e.track + 1}</span>
                <span className="detail-note-type">{e.noteType === "long" ? "长按" : "点击"}</span>
                <span className="detail-phase">{e.phase === "start" ? "头" : "尾"}</span>
                <span className="detail-time">{formatMs(e.elapsedMs)}</span>
                <span className="detail-distance">偏差 {e.distanceMs.toFixed(1)}ms</span>
              </div>
            ))}
            {judgeEvents.length > 50 && <div className="detail-more">... 共 {judgeEvents.length} 条</div>}
          </div>
        </div>

        {replay.syncEvents.length > 0 && (
          <div className="replay-details-section">
            <div className="replay-details-title">同步事件 ({replay.syncEvents.length})</div>
            <div className="replay-details-list">
              {replay.syncEvents.map((e, i) => (
                <div key={i} className="replay-detail-row">
                  <span className="detail-sync-type">
                    {e.type === "visibility_change" ? "页面切换" : e.type === "low_frame" ? "低帧率" : "重同步"}
                  </span>
                  <span className="detail-time">{formatMs(e.elapsedMs)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {replay.pauseNodes.length > 0 && (
          <div className="replay-details-section">
            <div className="replay-details-title">暂停/恢复节点 ({replay.pauseNodes.length})</div>
            <div className="replay-details-list">
              {replay.pauseNodes.map((e, i) => (
                <div key={i} className="replay-detail-row">
                  <span className={`detail-pause-type ${e.type}`}>
                    {e.type === "pause" ? "暂停" : "恢复"}
                  </span>
                  <span className="detail-time">{formatMs(e.elapsedMs)}</span>
                  <span className="detail-ts">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReplayVerification({ replay }: { replay: ReplayData }) {
  const [result, setResult] = useState<ReplayVerificationResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleVerify = useCallback(() => {
    setRunning(true);
    const chart = getChartForSong(replay.songId, replay.difficulty);
    setTimeout(() => {
      const r = verifyReplay(chart, replay);
      setResult(r);
      setRunning(false);
    }, 0);
  }, [replay]);

  return (
    <div className="replay-verification">
      <div className="replay-verification-header">
        <span>分数核对</span>
        <button className="replay-verify-btn" onClick={handleVerify} disabled={running}>
          {running ? "核对中..." : "运行核对"}
        </button>
      </div>
      {result && (
        <div className={`replay-verification-result ${result.match ? "match" : "mismatch"}`}>
          <div className="verification-status">
            {result.match ? "✅ 核对通过：重放分数与原始记录一致" : "⚠️ 核对发现差异"}
          </div>
          {result.differences.length > 0 && (
            <div className="verification-diffs">
              <div className="verification-diff-title">统计差异：</div>
              {result.differences.map((d, i) => (
                <div key={i} className="verification-diff-row">
                  <span className="diff-field">{d.field}</span>
                  <span className="diff-original">原始: {d.original}</span>
                  <span className="diff-replay">重放: {d.replay}</span>
                </div>
              ))}
            </div>
          )}
          {result.perNoteMismatches.length > 0 && (
            <div className="verification-diffs">
              <div className="verification-diff-title">逐音符差异 ({result.perNoteMismatches.length})：</div>
              {result.perNoteMismatches.slice(0, 20).map((m, i) => (
                <div key={i} className="verification-diff-row">
                  <span className="diff-note">音符 #{m.noteId} {m.phase === "end" ? "尾" : "头"}</span>
                  <span className="diff-original">原始: {m.original}</span>
                  <span className="diff-replay">重放: {m.replay}</span>
                </div>
              ))}
              {result.perNoteMismatches.length > 20 && (
                <div className="detail-more">... 共 {result.perNoteMismatches.length} 条差异</div>
              )}
            </div>
          )}
          <div className="verification-summary">
            <div className="verification-summary-row">
              <span>原始分数</span>
              <strong>{Math.floor(result.originalStats.score).toLocaleString()}</strong>
            </div>
            <div className="verification-summary-row">
              <span>重放分数</span>
              <strong>{Math.floor(result.replayStats.score).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoreBook({ initialSongId, initialDifficulty, onBack }: ScoreBookProps) {
  const [activeSongId, setActiveSongId] = useState<string>(
    initialSongId || songs[0].id
  );
  const [activeDifficulty, setActiveDifficulty] = useState<ChartDifficulty>(
    initialDifficulty || "standard"
  );
  const [viewingReplayAt, setViewingReplayAt] = useState<number | null>(null);

  const activeSong = songs.find((s) => s.id === activeSongId) || songs[0];
  const activeDiffInfo = CHART_DIFFICULTY_INFO[activeDifficulty];
  const records: PlayRecord[] = getPlayRecords(activeSongId, activeDifficulty)
    .sort((a, b) => b.completedAt - a.completedAt);
  const best = getSongBestScore(activeSongId, activeDifficulty);

  const viewingReplay = useMemo(() => {
    if (viewingReplayAt === null) return null;
    return getReplayData(activeSongId, activeDifficulty, viewingReplayAt);
  }, [viewingReplayAt, activeSongId, activeDifficulty]);

  const recentStats = useMemo(() => {
    if (records.length === 0) return null;
    const recent = records.slice(0, 10);
    const count = recent.length;

    let totalPerfect = 0;
    let totalGood = 0;
    let totalMiss = 0;
    let totalNotes = 0;
    let maxCombo = 0;
    let bestGrade: Grade = "D";

    for (const rec of recent) {
      totalPerfect += rec.perfectCount;
      totalGood += rec.goodCount;
      totalMiss += rec.missCount;
      totalNotes += rec.perfectCount + rec.goodCount + rec.missCount;
      if (rec.maxCombo > maxCombo) maxCombo = rec.maxCombo;
      const g = calcRecordGrade(rec);
      if (GRADE_ORDER[g] > GRADE_ORDER[bestGrade]) bestGrade = g;
    }

    const avgAccuracy = calcAccuracy(totalPerfect, totalGood, totalMiss);
    const overallGrade = calcGrade(totalPerfect, totalGood, totalMiss, totalNotes);

    return {
      count,
      avgAccuracy,
      maxCombo,
      bestGrade,
      overallGrade,
    };
  }, [records]);

  if (viewingReplay) {
    return (
      <div className="scorebook">
        <header className="scorebook-header">
          <button className="back-btn" onClick={() => setViewingReplayAt(null)}>
            ← 返回记录
          </button>
          <div className="scorebook-title-group">
            <h1 className="scorebook-title">回放详情</h1>
            <p className="scorebook-subtitle">
              {activeSong.title} · {activeDiffInfo.label} · {formatTime(viewingReplayAt ?? 0)}
            </p>
          </div>
        </header>
        <div className="replay-view">
          <div className="replay-meta">
            <div className="replay-meta-item">
              <small>校准值</small>
              <strong>{viewingReplay.calibrationAtStart.value}ms ({viewingReplay.calibrationAtStart.source === "song" ? "单曲" : "全局"})</strong>
            </div>
            <div className="replay-meta-item">
              <small>输入次数</small>
              <strong>{viewingReplay.inputEvents.length}</strong>
            </div>
            <div className="replay-meta-item">
              <small>判定次数</small>
              <strong>{viewingReplay.judgeEvents.length}</strong>
            </div>
            <div className="replay-meta-item">
              <small>暂停次数</small>
              <strong>{viewingReplay.pauseNodes.filter(p => p.type === "pause").length}</strong>
            </div>
            <div className="replay-meta-item">
              <small>同步事件</small>
              <strong>{viewingReplay.syncEvents.length}</strong>
            </div>
          </div>

          <ReplayTimeline replay={viewingReplay} />
          <ReplayVerification replay={viewingReplay} />
        </div>
      </div>
    );
  }

  return (
    <div className="scorebook">
      <header className="scorebook-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <div className="scorebook-title-group">
          <h1 className="scorebook-title">成绩册</h1>
          <p className="scorebook-subtitle">查看每首歌曲的游玩记录</p>
        </div>
      </header>

      <div className="scorebook-layout">
        <nav className="scorebook-sidebar">
          {songs.map((song) => {
            const isActive = song.id === activeSongId;
            const songBest = Math.max(
              ...CHART_DIFFICULTIES.map((d) => getSongBestScore(song.id, d))
            );
            return (
              <button
                key={song.id}
                className={`scorebook-song-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveSongId(song.id)}
              >
                <div
                  className="scorebook-song-thumb"
                  style={{
                    background:
                      "linear-gradient(135deg, " +
                      song.coverColor +
                      ", " +
                      song.accentColor +
                      ")",
                  }}
                >
                  ♪
                </div>
                <div className="scorebook-song-tab-info">
                  <span className="scorebook-song-tab-name">
                    {song.title}
                  </span>
                  <span className="scorebook-song-tab-best">
                    {songBest > 0 ? songBest.toLocaleString() : "未演奏"}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="scorebook-main">
          <div className="scorebook-song-hero">
            <div
              className="scorebook-song-cover"
              style={{
                background:
                  "linear-gradient(135deg, " +
                  activeSong.coverColor +
                  ", " +
                  activeSong.accentColor +
                  ")",
              }}
            >
              ♫
            </div>
            <div className="scorebook-song-meta">
              <h2 className="scorebook-song-title">{activeSong.title}</h2>
              <p className="scorebook-song-artist">{activeSong.artist}</p>
              <div className="scorebook-song-tags">
                <span
                  className="difficulty-tag"
                  style={{
                    backgroundColor: difficultyColors[activeSong.difficulty],
                  }}
                >
                  {difficultyLabels[activeSong.difficulty]} Lv.
                  {activeSong.difficultyLevel}
                </span>
                <span className="scorebook-best-badge">
                  {activeDiffInfo.label} 最高分 {best.toLocaleString()}
                </span>
              </div>
              <div className="scorebook-difficulty-switcher">
                {CHART_DIFFICULTIES.map((d) => {
                  const info = CHART_DIFFICULTY_INFO[d];
                  const isActive = d === activeDifficulty;
                  const diffBest = getSongBestScore(activeSong.id, d);
                  return (
                    <button
                      key={d}
                      className={`scorebook-diff-btn ${isActive ? "active" : ""}`}
                      style={{
                        backgroundColor: isActive ? info.color : "transparent",
                        color: isActive ? "white" : info.color,
                        borderColor: info.color,
                      }}
                      onClick={() => setActiveDifficulty(d)}
                    >
                      {info.label}
                      <span className="scorebook-diff-best">
                        {diffBest > 0 ? diffBest.toLocaleString() : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="scorebook-empty">
              <div className="scorebook-empty-icon">📋</div>
              <p>暂无游玩记录</p>
              <span>完成一次演奏后，成绩将自动记录在这里</span>
            </div>
          ) : (
            <div className="scorebook-records">
              {recentStats && (
                <div className="scorebook-summary">
                  <div className="summary-header">
                    <span className="summary-title">
                      {activeDiffInfo.label} · 最近 {recentStats.count} 次统计
                    </span>
                  </div>
                  <div className="summary-cards">
                    <div className="summary-card summary-card-grade">
                      <div className="summary-card-label">综合评级</div>
                      <div
                        className="summary-card-grade-big"
                        style={{ color: GRADE_COLORS[recentStats.overallGrade] }}
                      >
                        {recentStats.overallGrade}
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-label">平均命中率</div>
                      <div className="summary-card-value accuracy-value">
                        {recentStats.avgAccuracy.toFixed(2)}%
                      </div>
                      <div className="summary-bar">
                        <div
                          className="summary-bar-fill"
                          style={{
                            width: Math.min(100, recentStats.avgAccuracy) + "%",
                          }}
                        />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-label">最高连击</div>
                      <div className="summary-card-value combo-value">
                        {recentStats.maxCombo}
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-label">最高评级</div>
                      <div
                        className="summary-card-value grade-value"
                        style={{ color: GRADE_COLORS[recentStats.bestGrade] }}
                      >
                        {recentStats.bestGrade}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="scorebook-records-header">
                <span>{activeDiffInfo.label} · 最近 {records.length} 次游玩</span>
              </div>
              {records.map((record, idx) => {
                const isBest = record.score >= best && best > 0;
                const accuracy = calcRecordAccuracy(record);
                const grade = calcRecordGrade(record);
                const hasReplay = getReplayData(activeSongId, activeDifficulty, record.completedAt) !== null;
                return (
                  <div
                    key={record.completedAt}
                    className={`scorebook-record ${isBest ? "record-best" : ""}`}
                  >
                    <div className="record-rank">#{idx + 1}</div>
                    <div className="record-body">
                      <div className="record-top-row">
                        <span className="record-score">
                          {Math.floor(record.score).toLocaleString()}
                        </span>
                        <span
                          className="record-grade-tag"
                          style={{
                            color: GRADE_COLORS[grade],
                            borderColor: GRADE_COLORS[grade] + "66",
                            backgroundColor: GRADE_COLORS[grade] + "12",
                          }}
                        >
                          {grade}
                        </span>
                        <span className="record-accuracy">
                          命中率 {accuracy.toFixed(2)}%
                        </span>
                        {isBest && (
                          <span className="record-best-tag">最高分</span>
                        )}
                        <span className="record-time">
                          {formatTime(record.completedAt)}
                        </span>
                        {hasReplay && (
                          <button
                            className="record-replay-btn"
                            onClick={() => setViewingReplayAt(record.completedAt)}
                          >
                            回放
                          </button>
                        )}
                      </div>
                      <div className="record-stats">
                        <div className="record-stat">
                          <small>Perfect</small>
                          <strong className="perfect-text">
                            {record.perfectCount}
                          </strong>
                        </div>
                        <div className="record-stat">
                          <small>Good</small>
                          <strong className="good-text">
                            {record.goodCount}
                          </strong>
                        </div>
                        <div className="record-stat">
                          <small>Miss</small>
                          <strong className="miss-text">
                            {record.missCount}
                          </strong>
                        </div>
                        <div className="record-stat">
                          <small>最大连击</small>
                          <strong>{record.maxCombo}</strong>
                        </div>
                        <div className="record-stat">
                          <small>命中率</small>
                          <strong className="accuracy-text">
                            {accuracy.toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                      <div className="record-note-breakdown">
                        <div className="breakdown-col">
                          <div className="breakdown-label">点击音符</div>
                          <div className="breakdown-values">
                            <span className="perfect-text">P:{record.tapPerfectCount ?? 0}</span>
                            <span className="good-text">G:{record.tapGoodCount ?? 0}</span>
                            <span className="miss-text">M:{record.tapMissCount ?? 0}</span>
                          </div>
                        </div>
                        <div className="breakdown-col">
                          <div className="breakdown-label">长按音符</div>
                          <div className="breakdown-values">
                            <span className="perfect-text">P:{record.longPerfectCount ?? 0}</span>
                            <span className="good-text">G:{record.longGoodCount ?? 0}</span>
                            <span className="miss-text">M:{record.longMissCount ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
