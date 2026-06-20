import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart, ChartNote } from "./types";
import { getChartForSong } from "./charts";
import { formatDuration } from "./songs";

interface ChartPreviewProps {
  songId: string;
  duration: number;
  coverColor: string;
  accentColor: string;
  onStartPractice?: (startMs: number, endMs: number) => void;
}

const TRACK_COUNT = 4;
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];
const DENSITY_WINDOW_MS = 2000;
const DEFAULT_VIEWPORT_SECONDS = 30;
const ZOOM_LEVELS = [15, 30, 60, 120];
const PRACTICE_DURATION_MS = 20000;

export default function ChartPreview({
  songId,
  duration,
  coverColor,
  accentColor,
  onStartPractice,
}: ChartPreviewProps) {
  const chart = useMemo<Chart>(() => getChartForSong(songId), [songId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportLeft, setViewportLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartLeft, setDragStartLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportSeconds, setViewportSeconds] = useState(DEFAULT_VIEWPORT_SECONDS);

  useEffect(() => {
    setViewportLeft(0);
  }, [songId]);

  const totalDurationMs = duration * 1000;
  const viewportDurationMs = Math.min(viewportSeconds * 1000, totalDurationMs);

  const viewportZoomIndex = ZOOM_LEVELS.indexOf(viewportSeconds);
  const canZoomIn = viewportZoomIndex > 0;
  const canZoomOut = viewportZoomIndex < ZOOM_LEVELS.length - 1 && viewportSeconds * 1000 < totalDurationMs;

  const densityData = useMemo(() => {
    const windows: { time: number; count: number }[] = [];
    const step = DENSITY_WINDOW_MS / 2;
    for (let t = 0; t < totalDurationMs; t += step) {
      const windowStart = t;
      const windowEnd = t + DENSITY_WINDOW_MS;
      let count = 0;
      for (const note of chart.notes) {
        if (note.time >= windowStart && note.time < windowEnd) {
          count++;
        }
      }
      windows.push({ time: t + DENSITY_WINDOW_MS / 2, count });
    }
    const maxCount = Math.max(...windows.map((w) => w.count), 1);
    return windows.map((w) => ({
      time: w.time,
      density: w.count / maxCount,
      isPeak: w.count / maxCount > 0.7,
    }));
  }, [chart.notes, totalDurationMs]);

  const peakSections = useMemo(() => {
    const sections: { start: number; end: number }[] = [];
    let inPeak = false;
    let peakStart = 0;
    for (const d of densityData) {
      if (d.isPeak && !inPeak) {
        inPeak = true;
        peakStart = d.time - DENSITY_WINDOW_MS / 2;
      } else if (!d.isPeak && inPeak) {
        inPeak = false;
        sections.push({
          start: peakStart,
          end: d.time - DENSITY_WINDOW_MS / 2,
        });
      }
    }
    if (inPeak) {
      sections.push({
        start: peakStart,
        end: totalDurationMs,
      });
    }
    return sections.filter(
      (s) => s.end - s.start > DENSITY_WINDOW_MS * 1.5
    );
  }, [densityData, totalDurationMs]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
      }
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (containerWidth > 0) {
      setViewportWidth(containerWidth);
    }
  }, [containerWidth]);

  const pxPerMs = useMemo(() => {
    if (viewportWidth <= 0 || viewportDurationMs <= 0) return 0;
    return viewportWidth / viewportDurationMs;
  }, [viewportWidth, viewportDurationMs]);

  const maxLeft = Math.max(0, totalDurationMs - viewportDurationMs);

  useEffect(() => {
    setViewportLeft((prev) => Math.min(prev, maxLeft));
  }, [maxLeft]);

  function handleMouseDown(e: React.MouseEvent) {
    if (maxLeft <= 0) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartLeft(viewportLeft);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const newLeft = dragStartLeft - deltaX / pxPerMs;
    setViewportLeft(Math.max(0, Math.min(maxLeft, newLeft)));
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleMouseLeave() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (maxLeft <= 0) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStartX(e.touches[0].clientX);
      setDragStartLeft(viewportLeft);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const deltaX = e.touches[0].clientX - dragStartX;
    const newLeft = dragStartLeft - deltaX / pxPerMs;
    setViewportLeft(Math.max(0, Math.min(maxLeft, newLeft)));
  }

  function handleZoomIn() {
    if (!canZoomIn) return;
    const newSeconds = ZOOM_LEVELS[viewportZoomIndex - 1];
    setViewportSeconds(newSeconds);
  }

  function handleZoomOut() {
    if (!canZoomOut) return;
    const newSeconds = ZOOM_LEVELS[viewportZoomIndex + 1];
    setViewportSeconds(newSeconds);
  }

  function handleTouchEnd() {
    setIsDragging(false);
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalTouchEnd = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalTouchEnd);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, []);

  const visibleNotes = useMemo(() => {
    const viewStart = viewportLeft;
    const viewEnd = viewportLeft + viewportDurationMs;
    return chart.notes.filter(
      (n) =>
        n.time >= viewStart - 100 &&
        n.time <= viewEnd + 100
    );
  }, [chart.notes, viewportLeft, viewportDurationMs]);

  function getNoteX(note: ChartNote): number {
    return (note.time - viewportLeft) * pxPerMs;
  }

  function timeToX(time: number): number {
    return (time - viewportLeft) * pxPerMs;
  }

  function handlePracticePeak(startMs: number, endMs: number, e: React.MouseEvent) {
    e.stopPropagation();
    onStartPractice?.(Math.max(0, startMs), Math.min(endMs, totalDurationMs));
  }

  function handlePracticeFromHere() {
    const centerMs = viewportLeft + viewportDurationMs / 2;
    const startMs = Math.max(0, centerMs);
    const endMs = Math.min(startMs + PRACTICE_DURATION_MS, totalDurationMs);
    onStartPractice?.(startMs, endMs);
  }

  const trackHeight = 28;
  const densityHeight = 36;

  const practiceNotesInSegment = useMemo(() => {
    const centerMs = viewportLeft + viewportDurationMs / 2;
    const startMs = Math.max(0, centerMs);
    const endMs = Math.min(startMs + PRACTICE_DURATION_MS, totalDurationMs);
    return chart.notes.filter((n) => n.time >= startMs && n.time <= endMs).length;
  }, [chart.notes, viewportLeft, viewportDurationMs, totalDurationMs]);

  return (
    <div className="chart-preview">
      <div className="preview-header">
        <span className="preview-label">谱面预览</span>
        <div className="preview-controls">
          <button
            className={`zoom-btn ${!canZoomIn ? "disabled" : ""}`}
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            title="放大"
          >
            +
          </button>
          <span className="zoom-label">{viewportSeconds}s</span>
          <button
            className={`zoom-btn ${!canZoomOut ? "disabled" : ""}`}
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            title="缩小"
          >
            −
          </button>
          <span className="preview-hint">拖动查看</span>
        </div>
      </div>

      <div
        className={`preview-container ${isDragging ? "dragging" : ""} ${maxLeft <= 0 ? "no-scroll" : ""}`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="density-section">
          <div className="section-label">难度密度</div>
          <div className="density-chart" style={{ height: densityHeight }}>
            {peakSections.map((section, i) => {
              const x = timeToX(section.start);
              const width = (section.end - section.start) * pxPerMs;
              if (x + width < 0 || x > viewportWidth) return null;
              return (
                <div
                  key={i}
                  className="peak-section"
                  style={{
                    left: `${Math.max(0, x)}px`,
                    width: `${Math.min(width, viewportWidth - Math.max(0, x))}px`,
                    background: `linear-gradient(180deg, ${coverColor}33, ${accentColor}22)`,
                    borderLeft: `1px solid ${accentColor}66`,
                    borderRight: `1px solid ${accentColor}66`,
                  }}
                >
                  <span className="peak-label">高潮</span>
                  {onStartPractice && (
                    <button
                      className="peak-practice-btn"
                      onClick={(e) => handlePracticePeak(section.start, section.end, e)}
                      title="练习此高潮段"
                    >
                      练习
                    </button>
                  )}
                </div>
              );
            })}
            <svg
              className="density-svg"
              width="100%"
              height={densityHeight}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="densityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={coverColor} stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path
                d={densityData
                  .map((d, i) => {
                    const x = timeToX(d.time);
                    const y = densityHeight * (1 - d.density * 0.85 - 0.1);
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ") + ` L ${timeToX(totalDurationMs)} ${densityHeight} L ${timeToX(0)} ${densityHeight} Z`}
                fill="url(#densityGradient)"
              />
            </svg>
          </div>
        </div>

        <div className="tracks-section">
          <div className="section-label">轨道分布</div>
          <div
            className="preview-tracks"
            style={{ height: trackHeight * TRACK_COUNT }}
          >
            {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => (
              <div
                key={trackIdx}
                className="preview-track"
                style={{
                  height: trackHeight,
                  borderBottom:
                    trackIdx < TRACK_COUNT - 1
                      ? "1px solid rgba(148, 163, 184, 0.12)"
                      : "none",
                }}
              >
                <div
                  className="track-indicator"
                  style={{ backgroundColor: TRACK_COLORS[trackIdx] + "33" }}
                >
                  {trackIdx + 1}
                </div>
              </div>
            ))}

            {visibleNotes.map((note) => {
              const x = getNoteX(note);
              if (x < -20 || x > viewportWidth + 20) return null;
              const noteWidth = note.type === "long" && note.duration
                ? Math.max(4, note.duration * pxPerMs)
                : 4;
              return (
                <div
                  key={note.id}
                  className={`preview-note ${note.type}`}
                  style={{
                    left: `${x}px`,
                    top: `${note.track * trackHeight + trackHeight / 2 - 6}px`,
                    width: `${noteWidth}px`,
                    height: note.type === "long" ? "12px" : "12px",
                    backgroundColor: TRACK_COLORS[note.track],
                    borderRadius: note.type === "long" ? "3px" : "50%",
                    boxShadow: `0 0 8px ${TRACK_COLORS[note.track]}80`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="time-axis">
          {Array.from({ length: Math.ceil(duration / 10) + 1 }).map((_, i) => {
            const time = i * 10 * 1000;
            const x = timeToX(time);
            if (x < -20 || x > viewportWidth + 20) return null;
            return (
              <div key={i} className="time-tick" style={{ left: `${x}px` }}>
                <div className="tick-line" />
                <span className="tick-label">{formatDuration(i * 10)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="preview-footer">
        <div className="preview-stat">
          <span className="stat-label">总音符</span>
          <span className="stat-value">{chart.totalNotes}</span>
        </div>
        <div className="preview-stat">
          <span className="stat-label">点击</span>
          <span className="stat-value">{chart.totalTapNotes}</span>
        </div>
        <div className="preview-stat">
          <span className="stat-label">长按</span>
          <span className="stat-value">{chart.totalLongNotes}</span>
        </div>
        <div className="preview-stat">
          <span className="stat-label">高潮段</span>
          <span className="stat-value">{peakSections.length}</span>
        </div>
      </div>

      {onStartPractice && (
        <div className="preview-practice-bar">
          <div className="practice-bar-info">
            <span className="practice-bar-label">分段练习</span>
            <span className="practice-bar-desc">
              从当前视角中心起 {Math.round(PRACTICE_DURATION_MS / 1000)}s · 含 {practiceNotesInSegment} 个音符
            </span>
          </div>
          <button
            className="practice-bar-btn"
            onClick={handlePracticeFromHere}
          >
            从此处练习
          </button>
        </div>
      )}

      <div className="preview-scrollbar">
        <div className="scrollbar-track">
          <div
            className="scrollbar-thumb"
            style={{
              left: `${(viewportLeft / totalDurationMs) * 100}%`,
              width: `${(viewportDurationMs / totalDurationMs) * 100}%`,
              background: `linear-gradient(90deg, ${coverColor}, ${accentColor})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
