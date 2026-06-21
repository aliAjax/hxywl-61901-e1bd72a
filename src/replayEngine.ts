import type {
  Chart,
  ChartNote,
  GameStats,
  JudgeType,
  NoteType,
  ReplayData,
  ReplayJudgeEvent,
  ReplayVerificationResult,
  ReplayRecalibrationResult,
} from "./types";
import {
  PERFECT_WINDOW_MS,
  GOOD_WINDOW_MS,
  MISS_WINDOW_MS,
  LONG_NOTE_END_PERFECT_WINDOW_MS,
  LONG_NOTE_END_GOOD_WINDOW_MS,
} from "./chartPlayer";

function resolveChart(chart: Chart, replayData: ReplayData): Chart {
  if (replayData.chartSnapshot) {
    return {
      songId: replayData.chartSnapshot.songId,
      difficulty: replayData.chartSnapshot.difficulty,
      totalNotes: replayData.chartSnapshot.totalNotes,
      totalTapNotes: replayData.chartSnapshot.totalTapNotes,
      totalLongNotes: replayData.chartSnapshot.totalLongNotes,
      chorusCount: 0,
      notes: replayData.chartSnapshot.notes,
      audioBeats: [],
    };
  }
  return chart;
}

interface ReplayNote {
  id: number;
  track: number;
  targetTime: number;
  type: NoteType;
  duration?: number;
  endTime?: number;
  startJudged: boolean;
  startJudgeType: JudgeType;
  endJudged: boolean;
  endJudgeType: JudgeType;
  longHolding: boolean;
  autoMissed: boolean;
}

function emptyStats(): GameStats {
  return {
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
}

export interface ReplayResult {
  stats: GameStats;
  judgeEvents: ReplayJudgeEvent[];
}

export interface ReplayRunOptions {
  calibrationOverrideMs?: number;
}

export function runReplay(chart: Chart, replayData: ReplayData, options: ReplayRunOptions = {}): ReplayResult {
  const effectiveChart = resolveChart(chart, replayData);
  const calibrationDelta = options.calibrationOverrideMs != null
    ? options.calibrationOverrideMs - replayData.calibrationAtStart.value
    : 0;

  const stats = emptyStats();
  const judgeEvents: ReplayJudgeEvent[] = [];
  const notes: ReplayNote[] = effectiveChart.notes.map((n) => ({
    id: n.id,
    track: n.track,
    targetTime: n.time,
    type: n.type,
    duration: n.duration,
    endTime: n.type === "long" && n.duration ? n.time + n.duration : undefined,
    startJudged: false,
    startJudgeType: null,
    endJudged: false,
    endJudgeType: null,
    longHolding: false,
    autoMissed: false,
  }));

  const trackHeldNoteId = new Map<number, number | null>();
  for (let i = 0; i < 4; i++) {
    trackHeldNoteId.set(i, null);
  }

  function applyJudge(judge: JudgeType, track: number, noteType: NoteType) {
    if (!judge) return;
    if (judge === "perfect") {
      const gain = 300 * (1 + Math.floor(stats.combo / 10) * 0.1);
      stats.score += gain;
      stats.combo += 1;
      stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
      stats.perfectCount += 1;
      if (noteType === "tap") stats.tapPerfectCount += 1;
      else stats.longPerfectCount += 1;
    } else if (judge === "good") {
      const gain = 150 * (1 + Math.floor(stats.combo / 10) * 0.1);
      stats.score += gain;
      stats.combo += 1;
      stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
      stats.goodCount += 1;
      if (noteType === "tap") stats.tapGoodCount += 1;
      else stats.longGoodCount += 1;
    } else if (judge === "miss") {
      stats.combo = 0;
      stats.missCount += 1;
      if (noteType === "tap") stats.tapMissCount += 1;
      else stats.longMissCount += 1;
    }
  }

  function processAutoMissAt(calibratedElapsed: number, elapsedMs: number) {
    for (const note of notes) {
      if (note.type === "tap") {
        if (!note.startJudged && !note.autoMissed) {
          const timePast = calibratedElapsed - note.targetTime;
          if (timePast > MISS_WINDOW_MS) {
            note.startJudged = true;
            note.startJudgeType = "miss";
            note.autoMissed = true;
            applyJudge("miss", note.track, "tap");
            judgeEvents.push({
              noteId: note.id,
              track: note.track,
              noteType: "tap",
              phase: "start",
              judge: "miss",
              distanceMs: timePast,
              elapsedMs,
              calibratedElapsedMs: calibratedElapsed,
            });
          }
        }
      } else {
        if (!note.startJudged && !note.autoMissed) {
          const timePast = calibratedElapsed - note.targetTime;
          if (timePast > MISS_WINDOW_MS) {
            note.startJudged = true;
            note.startJudgeType = "miss";
            note.autoMissed = true;
            applyJudge("miss", note.track, "long");
            judgeEvents.push({
              noteId: note.id,
              track: note.track,
              noteType: "long",
              phase: "start",
              judge: "miss",
              distanceMs: timePast,
              elapsedMs,
              calibratedElapsedMs: calibratedElapsed,
            });
            const held = trackHeldNoteId.get(note.track);
            if (held === note.id) trackHeldNoteId.set(note.track, null);
          }
        }
        if (note.startJudged && !note.endJudged && !note.autoMissed) {
          const endTime = note.endTime ?? note.targetTime + (note.duration ?? 0);
          if (note.longHolding) {
            if (calibratedElapsed >= endTime + LONG_NOTE_END_GOOD_WINDOW_MS) {
              note.longHolding = false;
              note.endJudged = true;
              note.endJudgeType = "miss";
              applyJudge("miss", note.track, "long");
              judgeEvents.push({
                noteId: note.id,
                track: note.track,
                noteType: "long",
                phase: "end",
                judge: "miss",
                distanceMs: calibratedElapsed - endTime,
                elapsedMs,
                calibratedElapsedMs: calibratedElapsed,
              });
              const held = trackHeldNoteId.get(note.track);
              if (held === note.id) trackHeldNoteId.set(note.track, null);
            }
          } else if (note.startJudgeType !== "miss") {
            const timePast = calibratedElapsed - endTime;
            if (timePast > LONG_NOTE_END_GOOD_WINDOW_MS) {
              note.endJudged = true;
              note.endJudgeType = "miss";
              applyJudge("miss", note.track, "long");
              judgeEvents.push({
                noteId: note.id,
                track: note.track,
                noteType: "long",
                phase: "end",
                judge: "miss",
                distanceMs: timePast,
                elapsedMs,
                calibratedElapsedMs: calibratedElapsed,
              });
            }
          } else {
            if (calibratedElapsed > endTime + LONG_NOTE_END_GOOD_WINDOW_MS) {
              note.endJudged = true;
              note.endJudgeType = "miss";
            }
          }
        }
      }
    }
  }

  function handlePress(track: number, calibratedElapsed: number, elapsedMs: number) {
    let hitNote: ReplayNote | null = null;
    let hitDistance = Infinity;

    for (const note of notes) {
      if (note.track !== track || note.startJudged || note.autoMissed) continue;
      if (note.type === "long" && note.startJudged) continue;

      const distance = Math.abs(calibratedElapsed - note.targetTime);
      if (distance < GOOD_WINDOW_MS && distance < hitDistance) {
        hitNote = note;
        hitDistance = distance;
      }
    }

    if (hitNote) {
      let judge: JudgeType = null;
      if (hitDistance < PERFECT_WINDOW_MS) judge = "perfect";
      else if (hitDistance < GOOD_WINDOW_MS) judge = "good";

      if (judge) {
        if (hitNote.type === "tap") {
          hitNote.startJudged = true;
          hitNote.startJudgeType = judge;
          applyJudge(judge, track, "tap");
          judgeEvents.push({
            noteId: hitNote.id,
            track,
            noteType: "tap",
            phase: "start",
            judge,
            distanceMs: hitDistance,
            elapsedMs,
            calibratedElapsedMs: calibratedElapsed,
          });
        } else {
          hitNote.startJudged = true;
          hitNote.startJudgeType = judge;
          hitNote.longHolding = true;
          trackHeldNoteId.set(track, hitNote.id);
          applyJudge(judge, track, "long");
          judgeEvents.push({
            noteId: hitNote.id,
            track,
            noteType: "long",
            phase: "start",
            judge,
            distanceMs: hitDistance,
            elapsedMs,
            calibratedElapsedMs: calibratedElapsed,
          });
        }
      }
    } else {
      applyJudge("miss", track, "tap");
      judgeEvents.push({
        noteId: -1,
        track,
        noteType: "tap",
        phase: "start",
        judge: "miss",
        distanceMs: 0,
        elapsedMs,
        calibratedElapsedMs: calibratedElapsed,
      });
    }
  }

  function handleRelease(track: number, calibratedElapsed: number, elapsedMs: number) {
    const heldNoteId = trackHeldNoteId.get(track);
    if (heldNoteId == null) return;

    const note = notes.find((n) => n.id === heldNoteId);
    if (!note || note.type !== "long") {
      trackHeldNoteId.set(track, null);
      return;
    }

    const endTime = note.endTime ?? note.targetTime + (note.duration ?? 0);

    if (!note.startJudged || note.startJudgeType === "miss" || note.autoMissed) {
      note.longHolding = false;
      note.endJudged = true;
      note.endJudgeType = "miss";
      judgeEvents.push({
        noteId: note.id,
        track,
        noteType: "long",
        phase: "end",
        judge: "miss",
        distanceMs: 0,
        elapsedMs,
        calibratedElapsedMs: calibratedElapsed,
      });
      trackHeldNoteId.set(track, null);
      return;
    }

    const distance = Math.abs(calibratedElapsed - endTime);
    note.longHolding = false;

    let endJudge: JudgeType = "miss";
    if (distance <= LONG_NOTE_END_PERFECT_WINDOW_MS) endJudge = "perfect";
    else if (distance <= LONG_NOTE_END_GOOD_WINDOW_MS) endJudge = "good";

    if (endJudge === "miss") {
      applyJudge("miss", track, "long");
    }

    note.endJudged = true;
    note.endJudgeType = endJudge;
    judgeEvents.push({
      noteId: note.id,
      track,
      noteType: "long",
      phase: "end",
      judge: endJudge,
      distanceMs: distance,
      elapsedMs,
      calibratedElapsedMs: calibratedElapsed,
    });
    trackHeldNoteId.set(track, null);
  }

  function getEffectiveCalibrated(e: { elapsedMs: number; calibratedElapsedMs: number }): number {
    if (options.calibrationOverrideMs != null) {
      return e.elapsedMs + options.calibrationOverrideMs;
    }
    return e.calibratedElapsedMs;
  }

  const allEvents = replayData.inputEvents.map((e) => ({
    kind: "input" as const,
    idx: getEffectiveCalibrated(e),
    event: e,
  }));

  const sorted = [...allEvents].sort((a, b) => a.idx - b.idx);

  for (const item of sorted) {
    if (item.kind === "input") {
      const e = item.event;
      const effCal = getEffectiveCalibrated(e);
      processAutoMissAt(effCal, e.elapsedMs);
      if (e.type === "press") {
        handlePress(e.track, effCal, e.elapsedMs);
      } else {
        handleRelease(e.track, effCal, e.elapsedMs);
      }
    }
  }

  const maxCalibrated = sorted.length > 0
    ? Math.max(...sorted.map((s) => getEffectiveCalibrated(s.event)))
    : 0;
  const totalDurationMs = (effectiveChart.notes.length > 0
    ? Math.max(...effectiveChart.notes.map((n) => {
        if (n.type === "long" && n.duration) return n.time + n.duration;
        return n.time;
      }))
    : 0) + LONG_NOTE_END_GOOD_WINDOW_MS + 2000;
  const finalCalibrated = Math.max(maxCalibrated, totalDurationMs);
  const finalElapsed = replayData.inputEvents.length > 0
    ? Math.max(...replayData.inputEvents.map((e) => e.elapsedMs))
    : 0;
  processAutoMissAt(finalCalibrated, finalElapsed);

  return { stats, judgeEvents };
}

export function verifyReplay(
  chart: Chart,
  replayData: ReplayData
): ReplayVerificationResult {
  const result = runReplay(chart, replayData);
  const original = replayData.finalStats;
  const replay = result.stats;

  const differences: ReplayVerificationResult["differences"] = [];
  const fields: (keyof GameStats)[] = [
    "score", "combo", "maxCombo",
    "perfectCount", "goodCount", "missCount",
    "tapPerfectCount", "tapGoodCount", "tapMissCount",
    "longPerfectCount", "longGoodCount", "longMissCount",
  ];

  for (const field of fields) {
    if (original[field] !== replay[field]) {
      differences.push({
        field,
        original: original[field],
        replay: replay[field],
      });
    }
  }

  const perNoteMismatches: ReplayVerificationResult["perNoteMismatches"] = [];
  const originalJudgeMap = new Map<string, ReplayJudgeEvent>();
  for (const je of replayData.judgeEvents) {
    const key = `${je.noteId}:${je.phase}`;
    originalJudgeMap.set(key, je);
  }
  for (const je of result.judgeEvents) {
    if (je.noteId < 0) continue;
    const key = `${je.noteId}:${je.phase}`;
    const orig = originalJudgeMap.get(key);
    if (orig && orig.judge !== je.judge) {
      perNoteMismatches.push({
        noteId: je.noteId,
        original: orig.judge,
        replay: je.judge,
        phase: je.phase,
      });
    }
  }

  return {
    match: differences.length === 0 && perNoteMismatches.length === 0,
    originalStats: { ...original },
    replayStats: { ...replay },
    differences,
    perNoteMismatches,
  };
}

export function recalibrateReplay(
  chart: Chart,
  replayData: ReplayData,
  newCalibrationMs: number
): ReplayRecalibrationResult {
  const originalResult = runReplay(chart, replayData);
  const newResult = runReplay(chart, replayData, { calibrationOverrideMs: newCalibrationMs });

  const originalMap = new Map<string, ReplayJudgeEvent>();
  for (const je of originalResult.judgeEvents) {
    if (je.noteId < 0) continue;
    originalMap.set(`${je.noteId}:${je.phase}`, je);
  }

  const newMap = new Map<string, ReplayJudgeEvent>();
  for (const je of newResult.judgeEvents) {
    if (je.noteId < 0) continue;
    newMap.set(`${je.noteId}:${je.phase}`, je);
  }

  const perNoteChanges: ReplayRecalibrationResult["perNoteChanges"] = [];
  const allKeys = new Set([...originalMap.keys(), ...newMap.keys()]);
  for (const key of allKeys) {
    const orig = originalMap.get(key);
    const nw = newMap.get(key);
    const [noteIdStr, phase] = key.split(":");
    const noteId = parseInt(noteIdStr, 10);
    if (orig?.judge !== nw?.judge) {
      perNoteChanges.push({
        noteId,
        phase: phase as "start" | "end",
        originalJudge: orig?.judge ?? null,
        newJudge: nw?.judge ?? null,
        originalDistanceMs: orig?.distanceMs ?? 0,
        newDistanceMs: nw?.distanceMs ?? 0,
      });
    }
  }
  perNoteChanges.sort((a, b) => a.noteId - b.noteId);

  return {
    originalCalibrationMs: replayData.calibrationAtStart.value,
    newCalibrationMs,
    originalStats: originalResult.stats,
    newStats: newResult.stats,
    deltaScore: newResult.stats.score - originalResult.stats.score,
    deltaPerfect: newResult.stats.perfectCount - originalResult.stats.perfectCount,
    deltaGood: newResult.stats.goodCount - originalResult.stats.goodCount,
    deltaMiss: newResult.stats.missCount - originalResult.stats.missCount,
    perNoteChanges,
  };
}
