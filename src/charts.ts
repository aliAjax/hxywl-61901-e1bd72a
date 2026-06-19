import type { Chart, ChartNote, NoteType, Song } from "./types";
import { songs } from "./songs";

const TRACK_COUNT = 4;

const MELODY_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

class SeededRandom {
  private seed: number;

  constructor(seedString: string) {
    let hash = 2166136261;
    for (let i = 0; i < seedString.length; i++) {
      hash ^= seedString.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    this.seed = hash >>> 0;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function buildChartForSong(song: Song): Chart {
  const rng = new SeededRandom(song.id);
  const notes: ChartNote[] = [];
  const audioBeats: Chart["audioBeats"] = [];
  const beatMs = 60000 / song.bpm;
  const totalDuration = song.duration * 1000;

  const noteDensity = Math.min(
    1,
    0.12 + song.difficultyLevel * 0.065
  );
  const doubleChance = Math.min(0.5, song.difficultyLevel * 0.04);
  const longNoteChance = Math.min(0.35, 0.05 + song.difficultyLevel * 0.03);
  const introMs = 2000;
  const outroMs = 2000;
  let noteId = 0;

  const subdivision = song.difficultyLevel <= 3 ? 2 : song.difficultyLevel <= 7 ? 4 : 8;
  const stepMs = beatMs / subdivision;

  const pattern = song.previewPattern.length > 0 ? song.previewPattern : [0, 1, 2, 3];

  const longDurations = [
    Math.round(beatMs * 1),
    Math.round(beatMs * 1.5),
    Math.round(beatMs * 2),
    Math.round(beatMs * 3),
  ];

  const skipUntil: Record<number, number> = {};

  for (let t = introMs; t < totalDuration - outroMs; t += stepMs) {
    const beatIndex = Math.floor(t / beatMs);
    const subIndex = Math.floor((t - beatIndex * beatMs) / stepMs);
    const kickOnBeat = subIndex === 0;
    const snareOnBeat = subIndex === subdivision / 2 && subdivision >= 2;
    const hihatOn = subIndex % 2 === 0;

    if (kickOnBeat) {
      audioBeats.push({ time: t, freq: 60, type: "kick" });
    }
    if (snareOnBeat) {
      audioBeats.push({ time: t, freq: 200, type: "snare" });
    }
    if (hihatOn) {
      audioBeats.push({ time: t, freq: 800, type: "hihat" });
    }

    const onStrongBeat = subIndex === 0;
    const onMediumBeat = subdivision >= 4 && subIndex % 2 === 0;
    let spawnNote = false;
    if (onStrongBeat) {
      spawnNote = rng.next() < noteDensity * 1.3;
    } else if (onMediumBeat) {
      spawnNote = rng.next() < noteDensity * 0.8;
    } else {
      spawnNote = rng.next() < noteDensity * 0.35;
    }

    if (spawnNote) {
      const baseTrack = pattern[Math.floor(noteId / 2) % pattern.length];
      let track = baseTrack;
      if (!onStrongBeat && rng.next() < 0.3) {
        track = (track + 1 + rng.nextInt(0, 1)) % TRACK_COUNT;
      }

      if (skipUntil[track] && t < skipUntil[track]) {
        continue;
      }

      let noteType: NoteType = "tap";
      let noteDuration: number | undefined = undefined;

      if (onStrongBeat && rng.next() < longNoteChance) {
        noteType = "long";
        noteDuration = longDurations[rng.nextInt(0, longDurations.length - 1)];
        skipUntil[track] = t + noteDuration + stepMs;
      }

      notes.push({
        id: noteId++,
        time: Math.round(t),
        track,
        type: noteType,
        duration: noteDuration,
      });

      if (rng.next() < doubleChance && onStrongBeat && noteType === "tap") {
        const otherTracks = [0, 1, 2, 3].filter((tr) => tr !== track && !(skipUntil[tr] && t < skipUntil[tr]));
        if (otherTracks.length > 0) {
          const otherTrack = otherTracks[rng.nextInt(0, otherTracks.length - 1)];
          notes.push({
            id: noteId++,
            time: Math.round(t),
            track: otherTrack,
            type: "tap",
          });
        }
      }
    }

    if (kickOnBeat) {
      const melodyFreq = MELODY_SCALE[beatIndex % MELODY_SCALE.length];
      audioBeats.push({ time: t, freq: melodyFreq, type: "melody" });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  for (let i = 0; i < notes.length; i++) {
    notes[i].id = i;
  }

  const totalTapNotes = notes.filter((n) => n.type === "tap").length;
  const totalLongNotes = notes.filter((n) => n.type === "long").length;

  return {
    songId: song.id,
    totalNotes: notes.length,
    totalTapNotes,
    totalLongNotes,
    notes,
    audioBeats: audioBeats.sort((a, b) => a.time - b.time),
  };
}

const chartCache: Record<string, Chart> = {};

export function getChartForSong(songId: string): Chart {
  if (chartCache[songId]) {
    return chartCache[songId];
  }
  const song = songs.find((s) => s.id === songId);
  if (!song) {
    throw new Error(`Song not found: ${songId}`);
  }
  const chart = buildChartForSong(song);
  chartCache[songId] = chart;
  return chart;
}

