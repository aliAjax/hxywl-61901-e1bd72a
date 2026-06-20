import { useEffect, useMemo, useRef, useState } from "react";
import type { Song, EffectiveCalibration, ChartDifficulty } from "./types";
import {
  songs,
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  isSongFavorite,
  toggleSongFavorite,
  getCalibrationOffset,
  getSongCalibrationOffset,
  saveSongCalibrationOffset,
  resetSongCalibrationOffset,
  getEffectiveCalibration,
  CHART_DIFFICULTIES,
  CHART_DIFFICULTY_INFO,
} from "./songs";
import { getChartForSong } from "./charts";
import ChartPreview from "./ChartPreview";

interface SongSelectProps {
  selectedSongId: string | null;
  selectedDifficulty: ChartDifficulty;
  onSelectSong: (song: Song) => void;
  onSelectDifficulty: (difficulty: ChartDifficulty) => void;
  onStartPlay: (song: Song, difficulty: ChartDifficulty) => void;
  onStartTutorial: () => void;
  onOpenScorebook: (songId?: string | null, difficulty?: ChartDifficulty | null) => void;
  onOpenSettings: () => void;
  onStartPractice?: (songId: string, difficulty: ChartDifficulty, startMs: number, endMs: number) => void;
}

export default function SongSelect({
  selectedSongId,
  selectedDifficulty,
  onSelectSong,
  onSelectDifficulty,
  onStartPlay,
  onStartTutorial,
  onOpenScorebook,
  onOpenSettings,
  onStartPractice,
}: SongSelectProps) {
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const [previewStep, setPreviewStep] = useState(-1);
  const [favoriteTick, setFavoriteTick] = useState(0);
  const [showSongCalibration, setShowSongCalibration] = useState(false);
  const [tempSongOffset, setTempSongOffset] = useState(0);
  const [calibrationTick, setCalibrationTick] = useState(0);
  const previewTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const formatOffset = (ms: number): string => {
    if (ms === 0) return "0 ms";
    return ms > 0 ? `+${ms} ms` : `${ms} ms`;
  };

  const sortedSongs = [...songs].sort((a, b) => {
    const aFav = isSongFavorite(a.id);
    const bFav = isSongFavorite(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const selectedSong = sortedSongs.find((s) => s.id === selectedSongId) || sortedSongs[0];

  const currentChart = useMemo(
    () => getChartForSong(selectedSong.id, selectedDifficulty),
    [selectedSong.id, selectedDifficulty]
  );

  const currentDiffInfo = CHART_DIFFICULTY_INFO[selectedDifficulty];

  function handleToggleFavorite(songId: string, e: React.MouseEvent) {
    e.stopPropagation();
    toggleSongFavorite(songId);
    setFavoriteTick((t) => t + 1);
  }

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  function playBeep(frequency: number, duration: number) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available, silent fail
    }
  }

  function handlePreview(song: Song) {
    if (previewingSongId === song.id) {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
      setPreviewingSongId(null);
      setPreviewStep(-1);
      return;
    }

    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
    }

    setPreviewingSongId(song.id);
    setPreviewStep(-1);

    const stepMs = Math.max(120, 60000 / song.bpm / 2);
    const frequencies = [261.63, 329.63, 392.0, 523.25];
    let step = 0;

    const tick = () => {
      const track = song.previewPattern[step % song.previewPattern.length];
      setPreviewStep(step % song.previewPattern.length);
      playBeep(frequencies[track % 4], stepMs / 1000);
      step++;
    };

    tick();
    previewTimerRef.current = window.setInterval(tick, stepMs);

    window.setTimeout(() => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
      if (previewingSongRef.current === song.id) {
        setPreviewingSongId(null);
        setPreviewStep(-1);
      }
    }, stepMs * song.previewPattern.length * 2);
  }

  const previewingSongRef = useRef(previewingSongId);
  useEffect(() => {
    previewingSongRef.current = previewingSongId;
  }, [previewingSongId]);

  return (
    <div className="song-select">
      <header className="select-header">
        <div className="select-header-row">
          <div>
            <h1 className="select-title">选择歌曲</h1>
            <p className="select-subtitle">共 {songs.length} 首歌曲，已收藏 {songs.filter((s) => isSongFavorite(s.id)).length} 首</p>
          </div>
          <button
            className="scorebook-entry-btn"
            onClick={() => onOpenScorebook()}
          >
            📋 成绩册
          </button>
          <button
            className="settings-entry-btn"
            onClick={onOpenSettings}
          >
            ⚙️ 设置
          </button>
        </div>
      </header>

      <div className="select-layout">
        <div className="song-list">
          {sortedSongs.map((song) => {
            const isSelected = selectedSong.id === song.id;
            const isPreviewing = previewingSongId === song.id;
            const bestStandard = getSongBestScore(song.id, "standard");
            const isFav = isSongFavorite(song.id);

            return (
              <div
                key={song.id}
                className={`song-card ${isSelected ? "selected" : ""} ${isFav ? "favorite" : ""}`}
                onClick={() => onSelectSong(song)}
              >
                <div
                  className="song-cover"
                  style={{
                    background: "linear-gradient(135deg, " + song.coverColor + ", " + song.accentColor + ")",
                  }}
                >
                  <span className="song-icon">♪</span>
                  {isFav && <span className="favorite-indicator">⭐</span>}
                  {isPreviewing && (
                    <div className="preview-wave">
                      {song.previewPattern.map((_, i) => (
                        <span
                          key={i}
                          className={i === previewStep ? "active" : ""}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="song-info">
                  <div className="song-title-row">
                    <h3 className="song-title">{song.title}</h3>
                    <button
                      className={`favorite-btn ${isFav ? "active" : ""}`}
                      onClick={(e) => handleToggleFavorite(song.id, e)}
                      title={isFav ? "取消收藏" : "收藏歌曲"}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  </div>
                  <p className="song-artist">{song.artist}</p>

                  <div className="song-meta">
                    <span
                      className="difficulty-tag"
                      style={{
                        backgroundColor: difficultyColors[song.difficulty],
                      }}
                    >
                      {difficultyLabels[song.difficulty]} Lv.{song.difficultyLevel}
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">⚡</span>
                      {song.bpm} BPM
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">⏱</span>
                      {formatDuration(song.duration)}
                    </span>
                  </div>

                  <div className="song-difficulty-mini">
                    {CHART_DIFFICULTIES.map((diff) => {
                      const info = CHART_DIFFICULTY_INFO[diff];
                      const best = getSongBestScore(song.id, diff);
                      return (
                        <span
                          key={diff}
                          className="diff-mini-tag"
                          style={{
                            backgroundColor: info.color + "22",
                            color: info.color,
                            borderColor: info.color + "55",
                          }}
                          title={`${info.label} 最高分`}
                        >
                          {info.label} {best > 0 ? best.toLocaleString() : "—"}
                        </span>
                      );
                    })}
                  </div>

                  <div className="song-best">
                    <span className="best-label">标准难度最高</span>
                    <span className="best-score">{bestStandard.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  className={`preview-btn ${isPreviewing ? "playing" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(song);
                  }}
                >
                  {isPreviewing ? "⏸" : "▶"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="song-detail-panel">
          <div
            className="detail-cover"
            style={{
              background: "linear-gradient(135deg, " + selectedSong.coverColor + ", " + selectedSong.accentColor + ")",
            }}
          >
            <span className="detail-icon">♫</span>
            {isSongFavorite(selectedSong.id) && <span className="detail-favorite-indicator">⭐</span>}
          </div>

          <div className="detail-info">
            <div className="detail-title-row">
              <h2 className="detail-title">{selectedSong.title}</h2>
              <button
                className={`detail-favorite-btn ${isSongFavorite(selectedSong.id) ? "active" : ""}`}
                onClick={(e) => handleToggleFavorite(selectedSong.id, e)}
                title={isSongFavorite(selectedSong.id) ? "取消收藏" : "收藏歌曲"}
              >
                {isSongFavorite(selectedSong.id) ? "★ 已收藏" : "☆ 收藏"}
              </button>
            </div>
            <p className="detail-artist">{selectedSong.artist}</p>

            <div className="detail-stats">
              <div className="stat-item">
                <small>难度</small>
                <strong
                  style={{ color: difficultyColors[selectedSong.difficulty] }}
                >
                  {difficultyLabels[selectedSong.difficulty]}
                </strong>
              </div>
              <div className="stat-item">
                <small>BPM</small>
                <strong>{selectedSong.bpm}</strong>
              </div>
              <div className="stat-item">
                <small>等级</small>
                <strong>Lv.{selectedSong.difficultyLevel}</strong>
              </div>
              <div className="stat-item">
                <small>时长</small>
                <strong>{formatDuration(selectedSong.duration)}</strong>
              </div>
            </div>

            <div className="detail-difficulty-section">
              <div className="difficulty-switcher-label">选择谱面难度</div>
              <div className="difficulty-switcher">
                {CHART_DIFFICULTIES.map((diff) => {
                  const info = CHART_DIFFICULTY_INFO[diff];
                  const isActive = selectedDifficulty === diff;
                  const diffBest = getSongBestScore(selectedSong.id, diff);
                  return (
                    <button
                      key={diff}
                      className={`difficulty-switch-btn ${isActive ? "active" : ""}`}
                      style={{ ["--color" as any]: info.color } as React.CSSProperties}
                      onClick={() => onSelectDifficulty(diff)}
                    >
                      <span className="diff-label">{info.label}</span>
                      <span className="diff-lv">Lv.{info.level}</span>
                      <span className="diff-score">
                        {diffBest > 0 ? diffBest.toLocaleString() : "未演奏"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="detail-chart-stats">
              <div className="stat-item">
                <span className="stat-icon">🎼</span>
                <span className="stat-value" style={{ color: currentDiffInfo.color }}>
                  {currentDiffInfo.label}
                </span>
                <span className="stat-label">谱面版本</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🎵</span>
                <span className="stat-value">{currentChart.totalNotes}</span>
                <span className="stat-label">总音符</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">👆🖱</span>
                <span className="stat-value">
                  {currentChart.totalTapNotes}/{currentChart.totalLongNotes}
                </span>
                <span className="stat-label">点击 / 长按</span>
                <span className="stat-sub">
                  {currentChart.totalNotes > 0
                    ? Math.round((currentChart.totalTapNotes / currentChart.totalNotes) * 100)
                    : 0}% / {currentChart.totalNotes > 0
                    ? Math.round((currentChart.totalLongNotes / currentChart.totalNotes) * 100)
                    : 0}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🔥</span>
                <span className="stat-value">{currentChart.chorusCount}</span>
                <span className="stat-label">高潮段</span>
              </div>
            </div>

            <div className="detail-best">
              <span>{currentDiffInfo.label}难度最高分</span>
              <strong style={{ color: currentDiffInfo.color }}>
                {getSongBestScore(selectedSong.id, selectedDifficulty).toLocaleString()}
              </strong>
            </div>

            <ChartPreview
              songId={selectedSong.id}
              difficulty={selectedDifficulty}
              duration={selectedSong.duration}
              coverColor={selectedSong.coverColor}
              accentColor={selectedSong.accentColor}
              onStartPractice={onStartPractice ? (startMs, endMs) => onStartPractice(selectedSong.id, selectedDifficulty, startMs, endMs) : undefined}
            />

            <div className="song-detail-calibration">
              {(() => {
                const songOffset = getSongCalibrationOffset(selectedSong.id);
                const effective = getEffectiveCalibration(selectedSong.id);
                const globalOffset = getCalibrationOffset();

                return (
                  <>
                    <div className="calibration-summary">
                      <div className="calibration-summary-item">
                        <small>全局校准</small>
                        <strong>{formatOffset(globalOffset)}</strong>
                      </div>
                      <div className="calibration-summary-divider">→</div>
                      <div className="calibration-summary-item highlight">
                        <small>
                          实际使用
                          {effective.source === "song" ? (
                            <span className="source-badge song-badge">🎵</span>
                          ) : (
                            <span className="source-badge global-badge">🌐</span>
                          )}
                        </small>
                        <strong>{formatOffset(effective.value)}</strong>
                      </div>
                    </div>

                    {songOffset !== null ? (
                      <div className="song-calibration-set">
                        <div className="song-calibration-info">
                          <span>已设置单曲校准：{formatOffset(songOffset)}</span>
                        </div>
                        <div className="song-calibration-buttons">
                          <button
                            className="ghost-btn"
                            onClick={() => {
                              setTempSongOffset(songOffset);
                              setShowSongCalibration(true);
                            }}
                          >
                            ✏️ 修改
                          </button>
                          <button
                            className="ghost-btn danger-btn"
                            onClick={() => {
                              if (window.confirm("确定清除这首歌的单独校准吗？")) {
                                resetSongCalibrationOffset(selectedSong.id);
                                setCalibrationTick((t) => t + 1);
                              }
                            }}
                          >
                            🗑️ 清除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="ghost-btn calibration-set-btn"
                        onClick={() => {
                          setTempSongOffset(globalOffset);
                          setShowSongCalibration(true);
                        }}
                      >
                        🎯 为本歌单独设置校准
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {showSongCalibration && (
              <div className="song-calibration-panel">
                <div className="song-calibration-header">
                  <strong>设置「{selectedSong.title}」的校准值</strong>
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
                    <strong>
                      {tempSongOffset === 0
                        ? "0 ms"
                        : tempSongOffset > 0
                        ? `+${tempSongOffset} ms`
                        : `${tempSongOffset} ms`}
                    </strong>
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
                    onClick={() => setTempSongOffset(getCalibrationOffset())}
                  >
                    ↺ 使用全局值 ({formatOffset(getCalibrationOffset())})
                  </button>
                  <button
                    className="start-btn"
                    onClick={() => {
                      saveSongCalibrationOffset(selectedSong.id, tempSongOffset);
                      setShowSongCalibration(false);
                      setCalibrationTick((t) => t + 1);
                    }}
                  >
                    💾 保存
                  </button>
                </div>
                <p className="song-calibration-hint">
                  正值：系统判定时间提前，适合点击偏晚的玩家<br />
                  负值：系统判定时间延后，适合点击偏早的玩家
                </p>
              </div>
            )}

            <button
              className="start-btn"
              onClick={() => onStartPlay(selectedSong, selectedDifficulty)}
              style={{
                background: `linear-gradient(135deg, ${currentDiffInfo.color}, ${selectedSong.accentColor})`,
              }}
            >
              ▶ 开始演奏 · {currentDiffInfo.label}
            </button>

            <button
              className="preview-large-btn"
              onClick={() => handlePreview(selectedSong)}
            >
              {previewingSongId === selectedSong.id ? "暂停试听" : "试听歌曲"}
            </button>

            <button
              className="tutorial-replay-btn"
              onClick={onStartTutorial}
            >
              📘 重新观看教学
            </button>

            <button
              className="scorebook-song-entry-btn"
              onClick={() => onOpenScorebook(selectedSong.id, selectedDifficulty)}
            >
              📋 查看成绩册 · {currentDiffInfo.label}
            </button>

            <div style={{ display: "none" }}>{calibrationTick}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
