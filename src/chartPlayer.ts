import type { Chart, ChartNote, GameStats, JudgeType, NoteType, Song } from "./types";
import { getChartForSong } from "./charts";
import { getCalibrationOffset } from "./songs";
import { AudioSyncEngine, type SyncDiagnostics } from "./audioSyncEngine";

export const PERFECT_WINDOW_MS = 50;
export const GOOD_WINDOW_MS = 110;
export const MISS_WINDOW_MS = 150;
export const LONG_NOTE_END_PERFECT_WINDOW_MS = 80;
export const LONG_NOTE_END_GOOD_WINDOW_MS = 180;
export const NOTE_FALL_SECONDS = 1.8;
export const NOTE_FALL_MS = NOTE_FALL_SECONDS * 1000;

export const HIT_ZONE_RELATIVE = 0.8839;

const MAX_INTERPOLATION_MS = 60;
const RESYNC_AUDIO_BEAT_THRESHOLD_MS = 30;

export interface NoteVisualUpdate {
  id: number;
  progress: number;
  endProgress?: number;
  interpolationMs: number;
}

export interface ChartPlayerCallbacks {
  onNoteSpawn: (note: SpawnedNote) => void;
  onNoteUpdate: (update: NoteVisualUpdate) => void;
  onNoteJudge: (noteId: number, judge: JudgeType, phase?: "start" | "end") => void;
  onNoteRemove: (id: number) => void;
  onJudge: (judge: JudgeType, track: number, noteType?: NoteType) => void;
  onStatsChange: (stats: GameStats) => void;
  onTimeUpdate: (elapsedMs: number, frameDeltaMs: number) => void;
  onFinish: (finalStats: GameStats) => void;
  onLongNoteHoldChange: (noteId: number, isHolding: boolean) => void;
  onSyncDiagnostics?: (diagnostics: SyncDiagnostics) => void;
  onStateChange?: (state: "idle" | "playing" | "paused" | "finished") => void;
}

export interface SpawnedNote {
  id: number;
  track: number;
  targetTime: number;
  type: NoteType;
  duration?: number;
  endTime?: number;
}

type PlayerState = "idle" | "playing" | "paused" | "finished";

interface InternalActiveNote {
  id: number;
  track: number;
  targetTime: number;
  progress: number;
  judged: boolean;
  missed: boolean;
  type: NoteType;
  duration?: number;
  endTime?: number;
  longHolding: boolean;
  longStartJudged: boolean;
  longStartJudgeType?: JudgeType;
  longEndJudged: boolean;
  endProgress?: number;
  lastUpdateElapsed: number;
}

export interface ChartPlayerOptions {
  practiceStartMs?: number;
  practiceEndMs?: number;
}

export class ChartPlayer {
  private song: Song;
  private chart: Chart;
  private cb: ChartPlayerCallbacks;

  private syncEngine: AudioSyncEngine;

  private rafId: number | null = null;
  private lastFrameTimestamp = 0;

  private audioCtx: AudioContext | null = null;
  private audioBeatCursor = 0;

  private chartNoteCursor = 0;

  private activeNotes = new Map<number, InternalActiveNote>();
  private trackHeldState = new Map<number, { noteId: number | null }>();

  private practiceStartMs: number;
  private practiceEndMs: number;

  private stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    tapPerfectCount: 0,
    tapGoodCount: 0,
    tapMissCount: 0,
    longPerfectCount: 0,
    longGoodCount: 0,
    longMissCount: 0,
  };

  private hitSoundTimers: number[] = [];
  private diagnosticsTimer: number | null = null;

  private syncStateUnsub: (() => void) | null = null;

  constructor(song: Song, callbacks: ChartPlayerCallbacks, options?: ChartPlayerOptions) {
    this.song = song;
    this.chart = getChartForSong(song.id);
    this.cb = callbacks;
    this.practiceStartMs = options?.practiceStartMs ?? 0;
    this.practiceEndMs = options?.practiceEndMs ?? song.duration * 1000;

    const calibrationOffset = getCalibrationOffset();
    this.syncEngine = new AudioSyncEngine({
      touchCalibrationOffsetMs: calibrationOffset,
    });

    this.syncStateUnsub = this.syncEngine.onStateChange((state) => {
      if (state === "paused") {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }
      if (this.cb.onStateChange) {
        this.cb.onStateChange(state);
      }
    });

    for (let i = 0; i < 4; i++) {
      this.trackHeldState.set(i, { noteId: null });
    }
  }

  getCalibrationOffset(): number {
    return this.syncEngine.getTouchCalibrationOffset();
  }

  getTotalCalibrationOffset(): number {
    return this.syncEngine.getTotalCalibrationOffset();
  }

  setCalibrationOffset(offsetMs: number) {
    this.syncEngine.setTouchCalibrationOffset(offsetMs);
  }

  private getCalibratedElapsed(): number {
    return this.syncEngine.getCalibratedElapsedMs();
  }

  getStats(): GameStats {
    return { ...this.stats };
  }

  getChart(): Chart {
    return this.chart;
  }

  getElapsedMs(): number {
    return this.syncEngine.getElapsedMs();
  }

  getSyncDiagnostics(): SyncDiagnostics {
    return this.syncEngine.getDiagnostics();
  }

  isPlaying(): boolean {
    return this.syncEngine.isPlaying();
  }

  isPaused(): boolean {
    return this.syncEngine.isPaused();
  }

  isFinished(): boolean {
    return this.syncEngine.getState() === "finished";
  }

  getTotalDurationMs(): number {
    return this.practiceEndMs;
  }

  isPracticeMode(): boolean {
    return this.practiceStartMs > 0 || this.practiceEndMs < this.song.duration * 1000;
  }

  getPracticeStartMs(): number {
    return this.practiceStartMs;
  }

  getPracticeEndMs(): number {
    return this.practiceEndMs;
  }

  private ensureAudioCtx(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new Ctor();
        this.syncEngine.attachAudioContext(this.audioCtx);
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume()
          .then(() => this.syncEngine.attachAudioContext(this.audioCtx))
          .catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private playSimulatedBeat(freq: number, type: string, durationMs = 160) {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state !== "running") return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      if (type === "kick") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + durationMs / 1000);
        filter.type = "lowpass";
        filter.frequency.value = 200;
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
      } else if (type === "snare") {
        osc.type = "triangle";
        osc.frequency.value = freq;
        filter.type = "highpass";
        filter.frequency.value = 800;
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * (durationMs / 1000), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        noise.buffer = buf;
        const nGain = ctx.createGain();
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = "highpass";
        nFilter.frequency.value = 1500;
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(ctx.destination);
        nGain.gain.setValueAtTime(0.08, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
        noise.start(now);
        noise.stop(now + durationMs / 1000);
      } else if (type === "hihat") {
        osc.type = "square";
        osc.frequency.value = freq;
        filter.type = "highpass";
        filter.frequency.value = 5000;
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      } else {
        osc.type = "triangle";
        osc.frequency.value = freq;
        filter.type = "lowpass";
        filter.frequency.value = 1500;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
      }

      osc.start(now);
      osc.stop(now + durationMs / 1000);
    } catch {
      // silent
    }
  }

  playHitSound(track: number) {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state !== "running") return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      const freqs = [440, 554, 659, 784];
      osc.frequency.value = freqs[track % freqs.length];
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // silent
    }
  }

  playMissSound() {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state !== "running") return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      filter.type = "lowpass";
      filter.frequency.value = 400;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // silent
    }
  }

  private applyJudge(judge: JudgeType, track: number, noteType: NoteType) {
    if (!judge) return;
    if (judge === "perfect") {
      const gain = 300 * (1 + Math.floor(this.stats.combo / 10) * 0.1);
      this.stats.score += gain;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.perfectCount += 1;
      if (noteType === "tap") {
        this.stats.tapPerfectCount += 1;
      } else {
        this.stats.longPerfectCount += 1;
      }
    } else if (judge === "good") {
      const gain = 150 * (1 + Math.floor(this.stats.combo / 10) * 0.1);
      this.stats.score += gain;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.goodCount += 1;
      if (noteType === "tap") {
        this.stats.tapGoodCount += 1;
      } else {
        this.stats.longGoodCount += 1;
      }
    } else if (judge === "miss") {
      this.stats.combo = 0;
      this.stats.missCount += 1;
      if (noteType === "tap") {
        this.stats.tapMissCount += 1;
      } else {
        this.stats.longMissCount += 1;
      }
      this.playMissSound();
    }
    this.cb.onStatsChange({ ...this.stats });
    this.cb.onJudge(judge, track, noteType);
  }

  private computeProgressFromElapsed(targetTimeMs: number, elapsedMs: number): number {
    const travelRatio = (elapsedMs - (targetTimeMs - NOTE_FALL_MS)) / NOTE_FALL_MS;
    return travelRatio;
  }

  judgeTrackPress(track: number) {
    if (!this.syncEngine.isPlaying()) return;
    const elapsed = this.getCalibratedElapsed();

    let hitNote: ChartNote | null = null;
    let hitNoteActiveId: number | null = null;
    let hitDistance = Infinity;

    for (const [activeId, active] of this.activeNotes) {
      if (active.track !== track || active.judged || active.missed) continue;
      if (active.type === "long" && active.longStartJudged) continue;

      const distance = Math.abs(elapsed - active.targetTime);
      if (distance < GOOD_WINDOW_MS && distance < hitDistance) {
        const cn = this.chart.notes.find((n) => n.id === activeId);
        if (cn) {
          hitNote = cn;
          hitNoteActiveId = activeId;
          hitDistance = distance;
        }
      }
    }

    if (hitNote && hitNoteActiveId !== null) {
      let judge: JudgeType = null;
      if (hitDistance < PERFECT_WINDOW_MS) {
        judge = "perfect";
      } else if (hitDistance < GOOD_WINDOW_MS) {
        judge = "good";
      }
      if (judge) {
        const active = this.activeNotes.get(hitNoteActiveId);
        if (active) {
          if (active.type === "tap") {
            active.judged = true;
            this.cb.onNoteJudge(hitNoteActiveId, judge);
            this.applyJudge(judge, track, "tap");
          } else {
            active.longStartJudged = true;
            active.longStartJudgeType = judge;
            active.longHolding = true;
            this.trackHeldState.get(track)!.noteId = hitNoteActiveId;
            this.cb.onNoteJudge(hitNoteActiveId, judge, "start");
            this.cb.onLongNoteHoldChange(hitNoteActiveId, true);
            this.applyJudge(judge, track, "long");
          }
        }
        this.playHitSound(track);
      }
    } else {
      this.applyJudge("miss", track, "tap");
    }
  }

  judgeTrackRelease(track: number) {
    if (!this.syncEngine.isPlaying()) {
      const held = this.trackHeldState.get(track);
      if (held && held.noteId !== null) {
        const noteId = held.noteId;
        const active = this.activeNotes.get(noteId);
        if (active && active.longHolding) {
          active.longHolding = false;
          this.cb.onLongNoteHoldChange(noteId, false);
        }
        held.noteId = null;
      }
      return;
    }
    const elapsed = this.getCalibratedElapsed();
    const held = this.trackHeldState.get(track);
    if (!held || held.noteId === null) return;

    const noteId = held.noteId;
    const active = this.activeNotes.get(noteId);
    if (!active || active.type !== "long") {
      held.noteId = null;
      return;
    }

    const endTime = active.endTime ?? active.targetTime + (active.duration ?? 0);

    if (!active.longStartJudged || active.longStartJudgeType === "miss" || active.missed) {
      active.longHolding = false;
      active.judged = true;
      active.longEndJudged = true;
      this.cb.onLongNoteHoldChange(noteId, false);
      this.cb.onNoteJudge(noteId, "miss", "end");
      held.noteId = null;
      return;
    }

    const distance = Math.abs(elapsed - endTime);
    active.longHolding = false;
    this.cb.onLongNoteHoldChange(noteId, false);

    let endJudge: JudgeType = "miss";
    if (distance <= LONG_NOTE_END_PERFECT_WINDOW_MS) {
      endJudge = "perfect";
    } else if (distance <= LONG_NOTE_END_GOOD_WINDOW_MS) {
      endJudge = "good";
    } else {
      endJudge = "miss";
    }

    if (endJudge === "miss") {
      this.applyJudge("miss", track, "long");
    }

    active.judged = true;
    active.longEndJudged = true;
    this.cb.onNoteJudge(noteId, endJudge, "end");
    this.playHitSound(track);
    held.noteId = null;
  }

  private processAudioBeats(elapsed: number) {
    const endMs = this.practiceEndMs;
    const audioElapsed = this.syncEngine.getAudioReferencedElapsedMs();
    const referenceElapsed = audioElapsed !== null && Math.abs(audioElapsed - elapsed) < RESYNC_AUDIO_BEAT_THRESHOLD_MS
      ? audioElapsed
      : elapsed;

    while (
      this.audioBeatCursor < this.chart.audioBeats.length &&
      this.chart.audioBeats[this.audioBeatCursor].time <= referenceElapsed &&
      this.chart.audioBeats[this.audioBeatCursor].time <= endMs
    ) {
      const beat = this.chart.audioBeats[this.audioBeatCursor];
      if (beat.time >= this.practiceStartMs) {
        this.playSimulatedBeat(beat.freq, beat.type);
      }
      this.audioBeatCursor++;
    }
  }

  private spawnDueNotes(elapsed: number) {
    while (
      this.chartNoteCursor < this.chart.notes.length &&
      this.chart.notes[this.chartNoteCursor].time - NOTE_FALL_MS <= elapsed
    ) {
      const note = this.chart.notes[this.chartNoteCursor];
      if (note.time >= this.practiceStartMs && note.time <= this.practiceEndMs) {
        const progress = this.computeProgressFromElapsed(note.time, elapsed);
        const endTime = note.type === "long" && note.duration ? note.time + note.duration : undefined;
        const endProgress = endTime !== undefined
          ? this.computeProgressFromElapsed(endTime, elapsed)
          : undefined;
        this.activeNotes.set(note.id, {
          id: note.id,
          track: note.track,
          targetTime: note.time,
          progress,
          judged: false,
          missed: false,
          type: note.type,
          duration: note.duration,
          endTime,
          longHolding: false,
          longStartJudged: false,
          longEndJudged: false,
          endProgress,
          lastUpdateElapsed: elapsed,
        });
        this.cb.onNoteSpawn({
          id: note.id,
          track: note.track,
          targetTime: note.time,
          type: note.type,
          duration: note.duration,
          endTime,
        });
      }
      this.chartNoteCursor++;
    }
  }

  private updateActiveNotes(elapsed: number, frameDeltaMs: number) {
    const removeIds: number[] = [];
    const calibrated = elapsed - this.syncEngine.getTotalCalibrationOffset();
    const interpolationMs = Math.min(frameDeltaMs * 0.5, MAX_INTERPOLATION_MS);

    for (const [id, active] of this.activeNotes) {
      const interpolatedElapsed = elapsed + interpolationMs;
      const newProgress = this.computeProgressFromElapsed(active.targetTime, interpolatedElapsed);
      let endProgress: number | undefined = undefined;
      if (active.type === "long" && active.endTime !== undefined) {
        endProgress = this.computeProgressFromElapsed(active.endTime, interpolatedElapsed);
      }
      active.progress = newProgress;
      active.endProgress = endProgress;
      active.lastUpdateElapsed = elapsed;
      this.cb.onNoteUpdate({ id, progress: newProgress, endProgress, interpolationMs });

      if (!active.missed) {
        if (active.type === "tap") {
          if (active.judged) continue;
          const timePastTarget = calibrated - active.targetTime;
          if (timePastTarget > MISS_WINDOW_MS) {
            active.missed = true;
            this.cb.onNoteJudge(id, "miss");
            this.applyJudge("miss", active.track, "tap");
          }
        } else {
          if (!active.longStartJudged) {
            const timePastStart = calibrated - active.targetTime;
            if (timePastStart > MISS_WINDOW_MS) {
              active.missed = true;
              active.longStartJudged = true;
              this.cb.onNoteJudge(id, "miss", "start");
              this.applyJudge("miss", active.track, "long");
              const held = this.trackHeldState.get(active.track);
              if (held && held.noteId === id) held.noteId = null;
            }
          } else if (!active.longEndJudged) {
            const endTime = active.endTime ?? active.targetTime + (active.duration ?? 0);
            if (active.longHolding) {
              if (calibrated >= endTime + LONG_NOTE_END_GOOD_WINDOW_MS) {
                active.longHolding = false;
                active.longEndJudged = true;
                active.judged = true;
                active.missed = true;
                this.cb.onLongNoteHoldChange(id, false);
                this.cb.onNoteJudge(id, "miss", "end");
                this.applyJudge("miss", active.track, "long");
                const held = this.trackHeldState.get(active.track);
                if (held && held.noteId === id) held.noteId = null;
              }
            } else {
              if (active.longStartJudgeType !== "miss") {
                const timePastEnd = calibrated - endTime;
                if (timePastEnd > LONG_NOTE_END_GOOD_WINDOW_MS) {
                  active.longEndJudged = true;
                  active.judged = true;
                  this.cb.onNoteJudge(id, "miss", "end");
                  this.applyJudge("miss", active.track, "long");
                }
              } else {
                if (calibrated > endTime + LONG_NOTE_END_GOOD_WINDOW_MS) {
                  active.longEndJudged = true;
                  active.judged = true;
                }
              }
            }
          }
        }
      }

      const cleanupProgress = active.type === "long" && active.endProgress !== undefined
        ? active.endProgress
        : active.progress;
      if (cleanupProgress > 1.35) {
        removeIds.push(id);
        const held = this.trackHeldState.get(active.track);
        if (held && held.noteId === id) held.noteId = null;
      }
    }

    for (const rid of removeIds) {
      this.activeNotes.delete(rid);
      this.cb.onNoteRemove(rid);
    }
  }

  private checkFinish(elapsed: number) {
    const totalMs = this.practiceEndMs + 2500;
    if (elapsed >= totalMs) {
      this.syncEngine.finish();
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.stopDiagnosticsReporting();
      this.cb.onFinish({ ...this.stats });
    }
  }

  private emitDiagnostics() {
    if (this.cb.onSyncDiagnostics) {
      this.cb.onSyncDiagnostics(this.syncEngine.getDiagnostics());
    }
  }

  private startDiagnosticsReporting() {
    this.stopDiagnosticsReporting();
    if (this.cb.onSyncDiagnostics) {
      this.diagnosticsTimer = window.setInterval(() => this.emitDiagnostics(), 500);
    }
  }

  private stopDiagnosticsReporting() {
    if (this.diagnosticsTimer !== null) {
      clearInterval(this.diagnosticsTimer);
      this.diagnosticsTimer = null;
    }
  }

  private mainLoop = (timestamp: number) => {
    if (!this.syncEngine.isPlaying()) return;

    const elapsed = this.syncEngine.notifyFrame(timestamp);
    const frameDeltaMs = this.lastFrameTimestamp > 0 ? timestamp - this.lastFrameTimestamp : 16;
    this.lastFrameTimestamp = timestamp;

    this.processAudioBeats(elapsed);
    this.spawnDueNotes(elapsed);
    this.updateActiveNotes(elapsed, frameDeltaMs);
    this.cb.onTimeUpdate(elapsed, frameDeltaMs);
    this.checkFinish(elapsed);

    if (this.syncEngine.isPlaying()) {
      this.rafId = requestAnimationFrame(this.mainLoop);
    }
  };

  start() {
    if (this.syncEngine.isPlaying()) return;
    this.ensureAudioCtx();

    this.resetState();
    this.syncEngine.start(this.practiceStartMs);
    this.lastFrameTimestamp = performance.now();
    this.cb.onStatsChange({ ...this.stats });
    this.startDiagnosticsReporting();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(this.mainLoop);
  }

  pause() {
    if (!this.syncEngine.isPlaying()) return;
    this.syncEngine.pause();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume() {
    if (!this.syncEngine.isPaused()) return;
    this.syncEngine.resume();
    this.lastFrameTimestamp = performance.now();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(this.mainLoop);
  }

  restart() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopDiagnosticsReporting();
    this.start();
  }

  private resetState() {
    this.activeNotes.clear();
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
      tapPerfectCount: 0,
      tapGoodCount: 0,
      tapMissCount: 0,
      longPerfectCount: 0,
      longGoodCount: 0,
      longMissCount: 0,
    };
    this.chartNoteCursor = 0;
    while (
      this.chartNoteCursor < this.chart.notes.length &&
      this.chart.notes[this.chartNoteCursor].time < this.practiceStartMs
    ) {
      this.chartNoteCursor++;
    }
    this.audioBeatCursor = 0;
    while (
      this.audioBeatCursor < this.chart.audioBeats.length &&
      this.chart.audioBeats[this.audioBeatCursor].time < this.practiceStartMs
    ) {
      this.audioBeatCursor++;
    }
    this.lastFrameTimestamp = 0;
    for (let i = 0; i < 4; i++) {
      this.trackHeldState.set(i, { noteId: null });
    }
  }

  destroy() {
    if (this.syncStateUnsub) {
      this.syncStateUnsub();
      this.syncStateUnsub = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopDiagnosticsReporting();
    for (const t of this.hitSoundTimers) {
      clearTimeout(t);
    }
    this.hitSoundTimers = [];
    try {
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        this.audioCtx.close().catch(() => {});
      }
    } catch {
      // silent
    }
    this.syncEngine.destroy();
  }
}
