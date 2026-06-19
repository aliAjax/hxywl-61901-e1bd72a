import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart, ChartNote } from "./types";
import { getChartForSong } from "./charts";
import { formatDuration } from "./songs";

interface ChartPreviewProps {
  songId: string;
  duration: number;
  coverColor: string;
  accentColor: string;
}

const TRACK_COUNT = 4;
const TRACK_COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ec4899"];
const DENSITY_WINDOW_MS = 2000;

export default function ChartPreview({
  songId,
  duration,
  coverColor,
  accentColor,
}: ChartPreviewProps) {
  const chart = useMemo<Chart>(() => getChartForSong(songId), [songId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportLeft, setViewportLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartLeft, setDragStartLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    setViewportLeft(0);
  }, [songId]);

  const totalDurationMs = duration * 1000;

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
    if (viewportWidth <= 0) return 0;
    return viewportWidth / totalDurationMs;
  }, [viewportWidth, totalDurationMs]);

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartLeft(viewportLeft);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const newLeft = dragStartLeft - deltaX / pxPerMs;
    const maxLeft = Math.max(0, totalDurationMs - viewportWidth / pxPerMs);
    setViewportLeft(Math.max(0, Math.min(maxLeft, newLeft)));
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleMouseLeave() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
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
    const maxLeft = Math.max(0, totalDurationMs - viewportWidth / pxPerMs);
    setViewportLeft(Math.max(0, Math.min(maxLeft, newLeft)));
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
    const viewEnd = viewportLeft + viewportWidth / pxPerMs;
    return chart.notes.filter(
      (n) =>
        n.time >= viewStart - 100 &&
        n.time <= viewEnd + 100
    );
  }, [chart.notes, viewportLeft, viewportWidth, pxPerMs]);

  function getNoteX(note: ChartNote): number {
    return (note.time - viewportLeft) * pxPerMs;
  }

  function timeToX(time: number): number {
    return (time - viewportLeft) * pxPerMs;
  }

  const trackHeight = 28;
  const densityHeight = 36;

  return (
    <div className="chart-preview">
      <div className="preview-header">
        <span className="preview-label">谱面预览</span>
        <span className="preview-hint">拖动查看</span>
      </div>

      <div
        className={`preview-container ${isDragging ? "dragging" : ""}`}
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
            {peakSections.map((section, i) => (
              <div
                key={i}
                className="peak-section"
                style={{
                  left: `${timeToX(section.start)}px`,
                  width: `${(section.end - section.start) * pxPerMs}px`,
                  background: `linear-gradient(180deg, ${coverColor}33, ${accentColor}22)`,
                  borderLeft: `1px solid ${accentColor}66`,
                  borderRight: `1px solid ${accentColor}66`,
                }}
              >
                <span className="peak-label">高潮</span>
              </div>
            ))}
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

      <div className="preview-scrollbar">
        <div className="scrollbar-track">
          <div
            className="scrollbar-thumb"
            style={{
              left: `${(viewportLeft / totalDurationMs) * 100}%`,
              width: `${(viewportWidth / pxPerMs / totalDurationMs) * 100}%`,
              background: `linear-gradient(90deg, ${coverColor}, ${accentColor})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
