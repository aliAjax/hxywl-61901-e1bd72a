import { useEffect, useRef, useState } from "react";
import type { Song } from "./types";
import {
  songs,
  difficultyLabels,
  difficultyColors,
  formatDuration,
  getSongBestScore,
  isSongFavorite,
  toggleSongFavorite,
} from "./songs";
import ChartPreview from "./ChartPreview";

interface SongSelectProps {
  selectedSongId: string | null;
  onSelectSong: (song: Song) => void;
  onStartPlay: (song: Song) => void;
  onStartTutorial: () => void;
  onOpenScorebook: (songId?: string | null) => void;
  onOpenSettings: () => void;
  onStartPractice?: (songId: string, startMs: number, endMs: number) => void;
}

export default function SongSelect({
  selectedSongId,
  onSelectSong,
  onStartPlay,
  onStartTutorial,
  onOpenScorebook,
  onOpenSettings,
  onStartPractice,
}: SongSelectProps) {
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const [previewStep, setPreviewStep] = useState(-1);
  const [favoriteTick, setFavoriteTick] = useState(0);
  const previewTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const sortedSongs = [...songs].sort((a, b) => {
    const aFav = isSongFavorite(a.id);
    const bFav = isSongFavorite(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const selectedSong = sortedSongs.find((s) => s.id === selectedSongId) || sortedSongs[0];

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
            const best = getSongBestScore(song.id);
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

                  <div className="song-best">
                    <span className="best-label">最高分</span>
                    <span className="best-score">{best.toLocaleString()}</span>
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

            <div className="detail-best">
              <span>历史最高分</span>
              <strong>{getSongBestScore(selectedSong.id).toLocaleString()}</strong>
            </div>

            <ChartPreview
              songId={selectedSong.id}
              duration={selectedSong.duration}
              coverColor={selectedSong.coverColor}
              accentColor={selectedSong.accentColor}
              onStartPractice={onStartPractice ? (startMs, endMs) => onStartPractice(selectedSong.id, startMs, endMs) : undefined}
            />

            <button
              className="start-btn"
              onClick={() => onStartPlay(selectedSong)}
            >
              开始演奏
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
              onClick={() => onOpenScorebook(selectedSong.id)}
            >
              📋 查看成绩册
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
