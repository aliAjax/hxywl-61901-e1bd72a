import type { Chart, ChartNote, GameStats, JudgeType, Song } from "./types";
import { getChartForSong } from "./charts";

export const PERFECT_WINDOW_MS = 50;
export const GOOD_WINDOW_MS = 110;
export const MISS_WINDOW_MS = 150;
export const NOTE_FALL_SECONDS = 1.8;
export const NOTE_FALL_MS = NOTE_FALL_SECONDS * 1000;
export const TRACK_HEIGHT = 560;
export const HIT_ZONE_BOTTOM = 65;

export interface ChartPlayerCallbacks {
  onNoteSpawn: (note: SpawnedNote) => void;
  onNoteUpdate: (id: number, y: number) => void;
  onNoteJudge: (noteId: number, judge: JudgeType) => void;
  onNoteRemove: (id: number) => void;
  onJudge: (judge: JudgeType, track: number) => void;
  onStatsChange: (stats: GameStats) => void;
  onTimeUpdate: (elapsedMs: number) => void;
  onFinish: (finalStats: GameStats) => void;
}

export interface SpawnedNote {
  id: number;
  track: number;
  targetTime: number;
}

type PlayerState = "idle" | "playing" | "paused" | "finished";

export class ChartPlayer {
  private song: Song;
  private chart: Chart;
  private cb: ChartPlayerCallbacks;

  private state: PlayerState = "idle";

  private startTime = 0;
  private pausedAt = 0;
  private accumulatedPauseTime = 0;
  private lastFrameTime = 0;

  private rafId: number | null = null;

  private audioCtx: AudioContext | null = null;
  private audioBeatCursor = 0;

  private chartNoteCursor = 0;

  private activeNotes = new Map<
    number,
    {
      id: number;
      track: number;
      targetTime: number;
      y: number;
      judged: boolean;
      missed: boolean;
    }
  >();

  private stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
  };

  private hitSoundTimers: number[] = [];

  constructor(song: Song, callbacks: ChartPlayerCallbacks) {
    this.song = song;
    this.chart = getChartForSong(song.id);
    this.cb = callbacks;
  }

  getStats(): GameStats {
    return { ...this.stats };
  }

  getChart(): Chart {
    return this.chart;
  }

  getElapsedMs(): number {
    if (this.state === "idle") return 0;
    if (this.state === "paused") return this.pausedAt;
    return performance.now() - this.startTime - this.accumulatedPauseTime;
  }

  isPlaying(): boolean {
    return this.state === "playing";
  }

  isPaused(): boolean {
    return this.state === "paused";
  }

  isFinished(): boolean {
    return this.state === "finished";
  }

  getTotalDurationMs(): number {
    return this.song.duration * 1000;
  }

  private ensureAudioCtx(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new Ctor();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private playSimulatedBeat(freq: number, type: string, durationMs = 160) {
    const ctx = this.ensureAudioCtx();
    if (!ctx) return;
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
    const ctx = this.ensureAudioCtx();
    if (!ctx) return;
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
    const ctx = this.ensureAudioCtx();
    if (!ctx) return;
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

  private applyJudge(judge: JudgeType, track: number) {
    if (!judge) return;
    if (judge === "perfect") {
      const gain = 300 * (1 + Math.floor(this.stats.combo / 10) * 0.1);
      this.stats.score += gain;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.perfectCount += 1;
    } else if (judge === "good") {
      const gain = 150 * (1 + Math.floor(this.stats.combo / 10) * 0.1);
      this.stats.score += gain;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.goodCount += 1;
    } else if (judge === "miss") {
      this.stats.combo = 0;
      this.stats.missCount += 1;
      this.playMissSound();
    }
    this.cb.onStatsChange({ ...this.stats });
    this.cb.onJudge(judge, track);
  }

  private computeYFromElapsed(targetTimeMs: number, elapsedMs: number): number {
    const hitZoneY = TRACK_HEIGHT - HIT_ZONE_BOTTOM - 25;
    const travelRatio = (elapsedMs - (targetTimeMs - NOTE_FALL_MS)) / NOTE_FALL_MS;
    const y = -60 + (hitZoneY + 60) * travelRatio;
    return y;
  }

  judgeTrack(track: number) {
    if (this.state !== "playing") return;
    const elapsed = this.getElapsedMs();
    let hitNote: ChartNote | null = null;
    let hitNoteActiveId: number | null = null;
    let hitDistance = Infinity;

    for (const [activeId, active] of this.activeNotes) {
      if (active.track !== track || active.judged || active.missed) continue;
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
          active.judged = true;
        }
        this.cb.onNoteJudge(hitNoteActiveId, judge);
        this.applyJudge(judge, track);
        this.playHitSound(track);
      }
    }
  }

  private processAudioBeats(elapsed: number) {
    const endMs = this.getTotalDurationMs();
    while (
      this.audioBeatCursor < this.chart.audioBeats.length &&
      this.chart.audioBeats[this.audioBeatCursor].time <= elapsed &&
      this.chart.audioBeats[this.audioBeatCursor].time <= endMs
    ) {
      const beat = this.chart.audioBeats[this.audioBeatCursor];
      this.playSimulatedBeat(beat.freq, beat.type);
      this.audioBeatCursor++;
    }
  }

  private spawnDueNotes(elapsed: number) {
    while (
      this.chartNoteCursor < this.chart.notes.length &&
      this.chart.notes[this.chartNoteCursor].time - NOTE_FALL_MS <= elapsed
    ) {
      const note = this.chart.notes[this.chartNoteCursor];
      if (note.time <= this.getTotalDurationMs()) {
        const y = this.computeYFromElapsed(note.time, elapsed);
        this.activeNotes.set(note.id, {
          id: note.id,
          track: note.track,
          targetTime: note.time,
          y,
          judged: false,
          missed: false,
        });
        this.cb.onNoteSpawn({
          id: note.id,
          track: note.track,
          targetTime: note.time,
        });
      }
      this.chartNoteCursor++;
    }
  }

  private updateActiveNotes(elapsed: number) {
    const hitZoneY = TRACK_HEIGHT - HIT_ZONE_BOTTOM - 25;
    const removeIds: number[] = [];

    for (const [id, active] of this.activeNotes) {
      const newY = this.computeYFromElapsed(active.targetTime, elapsed);
      active.y = newY;
      this.cb.onNoteUpdate(id, newY);

      if (!active.judged && !active.missed) {
        const timePastTarget = elapsed - active.targetTime;
        if (timePastTarget > MISS_WINDOW_MS) {
          active.missed = true;
          this.cb.onNoteJudge(id, "miss");
          this.applyJudge("miss", active.track);
        }
      }

      if (active.y > hitZoneY + 120) {
        removeIds.push(id);
      }
    }

    for (const rid of removeIds) {
      this.activeNotes.delete(rid);
      this.cb.onNoteRemove(rid);
    }
  }

  private checkFinish(elapsed: number) {
    const totalMs = this.getTotalDurationMs() + 2500;
    if (elapsed >= totalMs) {
      this.state = "finished";
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.cb.onFinish({ ...this.stats });
    }
  }

  private mainLoop = () => {
    if (this.state !== "playing") return;
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const elapsed = this.getElapsedMs();

    this.processAudioBeats(elapsed);
    this.spawnDueNotes(elapsed);
    this.updateActiveNotes(elapsed);
    this.cb.onTimeUpdate(elapsed);
    this.checkFinish(elapsed);

    if (this.state === "playing") {
      this.rafId = requestAnimationFrame(this.mainLoop);
    }
    void delta;
  };

  start() {
    if (this.state === "playing") return;
    this.ensureAudioCtx();

    this.resetState();
    this.state = "playing";
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.accumulatedPauseTime = 0;
    this.cb.onStatsChange({ ...this.stats });
    this.rafId = requestAnimationFrame(this.mainLoop);
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.pausedAt = this.getElapsedMs();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    const now = performance.now();
    const expectedStart = now - this.pausedAt;
    this.accumulatedPauseTime = now - this.startTime - this.pausedAt;
    this.lastFrameTime = now;
    void expectedStart;
    this.rafId = requestAnimationFrame(this.mainLoop);
  }

  restart() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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
    };
    this.chartNoteCursor = 0;
    this.audioBeatCursor = 0;
    this.state = "idle";
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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
  }
}
