import { useState } from "react";
import type { PlayRecord } from "./types";
import {
  songs,
  difficultyLabels,
  difficultyColors,
  getPlayRecords,
  getSongBestScore,
} from "./songs";

interface ScoreBookProps {
  initialSongId?: string | null;
  onBack: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScoreBook({ initialSongId, onBack }: ScoreBookProps) {
  const [activeSongId, setActiveSongId] = useState<string>(
    initialSongId || songs[0].id
  );

  const activeSong = songs.find((s) => s.id === activeSongId) || songs[0];
  const records: PlayRecord[] = getPlayRecords(activeSongId)
    .sort((a, b) => b.completedAt - a.completedAt);
  const best = getSongBestScore(activeSongId);

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
            const songBest = getSongBestScore(song.id);
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
                    {songBest.toLocaleString()}
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
                  最高分 {best.toLocaleString()}
                </span>
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
              <div className="scorebook-records-header">
                <span>最近 {records.length} 次游玩</span>
              </div>
              {records.map((record, idx) => {
                const isBest = record.score >= best && best > 0;
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
