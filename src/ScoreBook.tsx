import { useState, useMemo } from "react";
import type { PlayRecord, ChartDifficulty } from "./types";
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
  type Grade,
} from "./songs";

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

export default function ScoreBook({ initialSongId, initialDifficulty, onBack }: ScoreBookProps) {
  const [activeSongId, setActiveSongId] = useState<string>(
    initialSongId || songs[0].id
  );
  const [activeDifficulty, setActiveDifficulty] = useState<ChartDifficulty>(
    initialDifficulty || "standard"
  );

  const activeSong = songs.find((s) => s.id === activeSongId) || songs[0];
  const activeDiffInfo = CHART_DIFFICULTY_INFO[activeDifficulty];
  const records: PlayRecord[] = getPlayRecords(activeSongId, activeDifficulty)
    .sort((a, b) => b.completedAt - a.completedAt);
  const best = getSongBestScore(activeSongId, activeDifficulty);

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
