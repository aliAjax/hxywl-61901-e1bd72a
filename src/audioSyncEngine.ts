export type SyncState = "idle" | "playing" | "paused" | "finished";

export interface SyncDiagnostics {
  audioClockDriftMs: number;
  visibilityChanges: number;
  resyncCount: number;
  lowFrameEvents: number;
  currentAudioOffsetMs: number;
  avgFrameTimeMs: number;
  totalElapsedMs: number;
  audioElapsedMs: number;
  clockSource: "wall" | "audio" | "mixed";
}

export interface AudioSyncEngineOptions {
  touchCalibrationOffsetMs?: number;
  maxAcceptableDriftMs?: number;
  lowFrameThresholdMs?: number;
  resyncSmoothFactor?: number;
  driftCheckIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<AudioSyncEngineOptions> = {
  touchCalibrationOffsetMs: 0,
  maxAcceptableDriftMs: 40,
  lowFrameThresholdMs: 60,
  resyncSmoothFactor: 0.35,
  driftCheckIntervalMs: 1000,
};

export class AudioSyncEngine {
  private state: SyncState = "idle";

  private wallBaseTime = 0;
  private audioBaseTime: number | null = null;
  private accumulatedPauseTime = 0;
  private pauseWallSnapshot = 0;
  private pausedElapsedSnapshot = 0;

  private audioCtx: AudioContext | null = null;
  private options: Required<AudioSyncEngineOptions>;

  private touchCalibrationOffsetMs: number;
  private deviceBaselineOffsetMs = 0;
  private smoothingResyncOffsetMs = 0;

  private lastFrameWallTime = 0;
  private frameTimeWindow: number[] = [];
  private readonly FRAME_WINDOW_SIZE = 30;

  private visibilityHandler: (() => void) | null = null;
  private pageHiddenAt: number | null = null;
  private visibilityChangeCount = 0;
  private resyncCount = 0;
  private lowFrameEvents = 0;
  private lastDriftCheck = 0;
  private currentAudioDrift = 0;
  private lastKnownAudioElapsed = 0;

  private listeners = new Set<(elapsedMs: number, frameDeltaMs: number) => void>();
  private stateChangeListeners = new Set<(state: SyncState) => void>();

  constructor(options: AudioSyncEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.touchCalibrationOffsetMs = this.options.touchCalibrationOffsetMs;
    this.estimateDeviceBaselineOffset();
  }

  private estimateDeviceBaselineOffset() {
    if (typeof navigator === "undefined") {
      this.deviceBaselineOffsetMs = 0;
      return;
    }
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isMobile = isAndroid || isIOS || /mobile/i.test(ua);
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const isLowEnd =
      (typeof nav.deviceMemory !== "undefined" && nav.deviceMemory <= 2) ||
      (typeof nav.hardwareConcurrency !== "undefined" && nav.hardwareConcurrency <= 4);

    if (isIOS) {
      this.deviceBaselineOffsetMs = 15;
    } else if (isAndroid) {
      this.deviceBaselineOffsetMs = isLowEnd ? 45 : 28;
    } else {
      this.deviceBaselineOffsetMs = isLowEnd ? 20 : 5;
    }
  }

  attachAudioContext(ctx: AudioContext | null) {
    this.audioCtx = ctx;
    if (ctx) {
      try {
        const audioNow = ctx.currentTime * 1000;
        if (this.state === "playing") {
          const wallElapsed = this.nowWall() - this.wallBaseTime - this.accumulatedPauseTime;
          this.audioBaseTime = audioNow - wallElapsed;
        } else {
          this.audioBaseTime = audioNow;
        }
      } catch {
        this.audioBaseTime = null;
      }
    }
  }

  onStateChange(listener: (state: SyncState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  private emitStateChange() {
    for (const l of this.stateChangeListeners) {
      try {
        l(this.state);
      } catch {
        // ignore
      }
    }
  }

  setTouchCalibrationOffset(offsetMs: number) {
    this.touchCalibrationOffsetMs = offsetMs;
  }

  getTouchCalibrationOffset(): number {
    return this.touchCalibrationOffsetMs;
  }

  getTotalCalibrationOffset(): number {
    return this.touchCalibrationOffsetMs + this.deviceBaselineOffsetMs;
  }

  getState(): SyncState {
    return this.state;
  }

  isPlaying(): boolean {
    return this.state === "playing";
  }

  isPaused(): boolean {
    return this.state === "paused";
  }

  private nowWall(): number {
    return performance.now();
  }

  private nowAudio(): number | null {
    if (!this.audioCtx) return null;
    try {
      if (this.audioCtx.state !== "running") return null;
      const t = this.audioCtx.currentTime * 1000;
      if (t < 0) return null;
      return t;
    } catch {
      return null;
    }
  }

  getElapsedMs(): number {
    if (this.state === "idle") return 0;
    if (this.state === "finished") return this.pausedElapsedSnapshot;

    if (this.state === "paused") {
      return this.pausedElapsedSnapshot;
    }

    const audioElapsed = this.getAudioReferencedElapsedMs();
    if (audioElapsed !== null) {
      return Math.max(0, audioElapsed + this.smoothingResyncOffsetMs);
    }

    const wall = this.nowWall();
    const rawElapsed = wall - this.wallBaseTime - this.accumulatedPauseTime;
    return Math.max(0, rawElapsed + this.smoothingResyncOffsetMs);
  }

  getAudioReferencedElapsedMs(): number | null {
    const audioNow = this.nowAudio();
    if (audioNow === null) return null;

    if (this.audioBaseTime === null) {
      if (this.state === "playing") {
        const wall = this.nowWall();
        const wallElapsed = wall - this.wallBaseTime - this.accumulatedPauseTime;
        this.audioBaseTime = audioNow - wallElapsed;
      } else {
        this.audioBaseTime = audioNow;
      }
    }

    const elapsed = audioNow - this.audioBaseTime;
    this.lastKnownAudioElapsed = Math.max(0, elapsed);
    return this.lastKnownAudioElapsed;
  }

  getCalibratedElapsedMs(): number {
    return this.getElapsedMs() - this.getTotalCalibrationOffset();
  }

  getInterpolatedElapsedMs(interpolationMs: number): number {
    return this.getCalibratedElapsedMs() + interpolationMs;
  }

  onTick(listener: (elapsedMs: number, frameDeltaMs: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyFrame(timestampMs?: number): number {
    const now = timestampMs ?? this.nowWall();
    let frameDeltaMs = 16;

    if (this.lastFrameWallTime > 0) {
      frameDeltaMs = now - this.lastFrameWallTime;

      if (frameDeltaMs > this.options.lowFrameThresholdMs) {
        this.lowFrameEvents++;
        this.handleLowFrame(frameDeltaMs);
      }

      this.frameTimeWindow.push(frameDeltaMs);
      if (this.frameTimeWindow.length > this.FRAME_WINDOW_SIZE) {
        this.frameTimeWindow.shift();
      }
    }
    this.lastFrameWallTime = now;

    if (now - this.lastDriftCheck > this.options.driftCheckIntervalMs) {
      this.checkAndCorrectDrift();
      this.lastDriftCheck = now;
    }

    this.applySmoothResyncStep();

    const elapsed = this.getElapsedMs();
    for (const l of this.listeners) {
      try {
        l(elapsed, frameDeltaMs);
      } catch {
        // ignore
      }
    }
    return elapsed;
  }

  private handleLowFrame(frameDeltaMs: number) {
    this.resyncFromWallClock();
  }

  private checkAndCorrectDrift() {
    const audioElapsed = this.getAudioReferencedElapsedMs();
    if (audioElapsed === null) return;

    const wall = this.nowWall();
    const wallElapsed = wall - this.wallBaseTime - this.accumulatedPauseTime;
    const drift = wallElapsed - audioElapsed;
    this.currentAudioDrift = drift;

    if (Math.abs(drift) > this.options.maxAcceptableDriftMs) {
      this.wallBaseTime += drift * 0.5;
      this.smoothingResyncOffsetMs = 0;
      this.resyncCount++;
    } else if (Math.abs(drift) < 5) {
      this.smoothingResyncOffsetMs = 0;
    }
  }

  private applySmoothResyncStep() {
    if (Math.abs(this.smoothingResyncOffsetMs) < 0.5) {
      this.smoothingResyncOffsetMs = 0;
      return;
    }

    const step = this.smoothingResyncOffsetMs * 0.08;
    this.smoothingResyncOffsetMs -= step;
    this.wallBaseTime += step;
  }

  private resyncFromWallClock() {
    this.resyncCount++;

    const audioElapsed = this.getAudioReferencedElapsedMs();
    if (audioElapsed !== null) {
      const now = this.nowWall();
      const expectedWallBase = now - this.accumulatedPauseTime - audioElapsed;
      this.wallBaseTime = expectedWallBase;
      this.smoothingResyncOffsetMs = 0;
    }
  }

  start() {
    if (this.state === "playing") return;

    this.resetInternalState();
    this.state = "playing";

    const now = this.nowWall();
    this.wallBaseTime = now;
    this.accumulatedPauseTime = 0;
    this.pausedElapsedSnapshot = 0;
    this.lastFrameWallTime = now;

    if (this.audioCtx) {
      try {
        this.audioBaseTime = this.audioCtx.currentTime * 1000;
      } catch {
        this.audioBaseTime = null;
      }
    }

    this.attachVisibilityHandler();
    this.emitStateChange();
  }

  pause() {
    if (this.state !== "playing") return;
    const elapsed = this.getElapsedMs();
    this.state = "paused";
    const now = this.nowWall();
    this.pauseWallSnapshot = now;
    this.pausedElapsedSnapshot = elapsed;
    this.lastKnownAudioElapsed = elapsed;
    this.emitStateChange();
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    const now = this.nowWall();
    const pauseDuration = now - this.pauseWallSnapshot;
    this.accumulatedPauseTime += pauseDuration;
    this.lastFrameWallTime = now;

    if (this.audioCtx && this.audioBaseTime !== null) {
      try {
        const audioNow = this.audioCtx.currentTime * 1000;
        this.audioBaseTime = audioNow - this.pausedElapsedSnapshot;
        this.resyncCount++;
      } catch {
        // ignore
      }
    }

    this.wallBaseTime = now - this.accumulatedPauseTime - this.pausedElapsedSnapshot;
    this.smoothingResyncOffsetMs = 0;

    this.checkAndCorrectDrift();
    this.emitStateChange();
  }

  restart() {
    if (this.state === "playing") {
      this.resetInternalState();
    }
    this.start();
  }

  finish() {
    if (this.state === "idle" || this.state === "finished") return;
    const finalElapsed = this.getElapsedMs();
    this.state = "finished";
    this.pausedElapsedSnapshot = finalElapsed;
    this.detachVisibilityHandler();
    this.emitStateChange();
  }

  private resetInternalState() {
    this.smoothingResyncOffsetMs = 0;
    this.currentAudioDrift = 0;
    this.frameTimeWindow = [];
    this.pageHiddenAt = null;
    this.lastKnownAudioElapsed = 0;
    this.pausedElapsedSnapshot = 0;
    this.audioBaseTime = null;
  }

  private attachVisibilityHandler() {
    if (this.visibilityHandler || typeof document === "undefined") return;
    const handler = () => this.handleVisibilityChange();
    this.visibilityHandler = handler;
    document.addEventListener("visibilitychange", handler);
  }

  private detachVisibilityHandler() {
    if (!this.visibilityHandler || typeof document === "undefined") return;
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityHandler = null;
  }

  private handleVisibilityChange() {
    if (typeof document === "undefined") return;
    this.visibilityChangeCount++;

    if (document.hidden) {
      this.pageHiddenAt = this.nowWall();
      if (this.state === "playing") {
        this.pause();
      }
    } else {
      const now = this.nowWall();
      if (this.pageHiddenAt !== null) {
        const hiddenDuration = now - this.pageHiddenAt;
        if (hiddenDuration > 500) {
          if (this.state === "playing") {
            this.resyncFromWallClock();
          }
        }
      }
      this.pageHiddenAt = null;

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      if (this.state === "playing") {
        this.checkAndCorrectDrift();
      }
    }
  }

  getDiagnostics(): SyncDiagnostics {
    const avgFrame =
      this.frameTimeWindow.length > 0
        ? this.frameTimeWindow.reduce((s, v) => s + v, 0) / this.frameTimeWindow.length
        : 0;

    const audioElapsed = this.getAudioReferencedElapsedMs();
    const totalElapsed = this.getElapsedMs();

    let clockSource: "wall" | "audio" | "mixed" = "wall";
    if (audioElapsed !== null) {
      const wall = this.nowWall();
      const wallElapsed = wall - this.wallBaseTime - this.accumulatedPauseTime;
      const diff = Math.abs(wallElapsed - audioElapsed);
      if (diff < 10) {
        clockSource = "audio";
      } else if (diff < this.options.maxAcceptableDriftMs) {
        clockSource = "audio";
      } else {
        clockSource = "audio";
      }
    }

    return {
      audioClockDriftMs: this.currentAudioDrift,
      visibilityChanges: this.visibilityChangeCount,
      resyncCount: this.resyncCount,
      lowFrameEvents: this.lowFrameEvents,
      currentAudioOffsetMs: this.smoothingResyncOffsetMs,
      avgFrameTimeMs: avgFrame,
      totalElapsedMs: totalElapsed,
      audioElapsedMs: audioElapsed ?? this.lastKnownAudioElapsed,
      clockSource,
    };
  }

  destroy() {
    this.detachVisibilityHandler();
    this.listeners.clear();
    this.stateChangeListeners.clear();
    this.state = "idle";
    this.audioCtx = null;
  }
}
