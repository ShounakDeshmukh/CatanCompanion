import { loadPrefs } from "../../lib/prefs";

/** The moments of a game that are worth a sound. */
export type Cue = "roll" | "seven" | "build" | "barbarians" | "nudge" | "win";

interface Note {
  /** Seconds after the cue starts. */
  at: number;
  length: number;
  from: number;
  /** Where the pitch slides to; it holds steady if left out. */
  to?: number;
  wave?: OscillatorType;
  loudness?: number;
}

/**
 * The sounds are made on the spot, not played from files, so there is nothing to download
 * and they work offline. A rattle is a burst of filtered noise; everything else is notes.
 */
const TUNES: Record<Cue, { rattles?: number[]; notes?: Note[]; buzz: number | number[] }> = {
  roll: { rattles: [0, 0.07, 0.13, 0.2, 0.29, 0.4], buzz: 20 },
  seven: {
    rattles: [0, 0.07, 0.13],
    notes: [
      { at: 0.2, length: 0.2, from: 392, wave: "triangle" },
      { at: 0.4, length: 0.4, from: 311, wave: "triangle" },
    ],
    buzz: [40, 60, 40],
  },
  build: { notes: [{ at: 0, length: 0.09, from: 220, to: 110, loudness: 0.3 }], buzz: 10 },
  barbarians: {
    notes: [
      { at: 0, length: 1, from: 82, to: 55, wave: "sawtooth", loudness: 0.18 },
      { at: 0.05, length: 1, from: 61, to: 41, wave: "sawtooth", loudness: 0.18 },
    ],
    buzz: [200, 80, 200, 80, 400],
  },
  nudge: {
    notes: [
      { at: 0, length: 0.14, from: 880 },
      { at: 0.16, length: 0.22, from: 1175 },
    ],
    buzz: [30, 50, 30],
  },
  win: {
    notes: [523, 659, 784, 1047].map((pitch, step) => ({
      at: step * 0.13,
      length: step === 3 ? 0.6 : 0.16,
      from: pitch,
      wave: "triangle" as const,
    })),
    buzz: [40, 40, 40, 40, 160],
  },
};

let audio: AudioContext | undefined;

/** Fades a source in over a few milliseconds and out by its end, so it never clicks. */
function shaped(context: AudioContext, start: number, length: number, loudness: number): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(loudness, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  gain.connect(context.destination);
  return gain;
}

function playNote(context: AudioContext, start: number, note: Note): void {
  const oscillator = context.createOscillator();
  oscillator.type = note.wave ?? "sine";
  oscillator.frequency.setValueAtTime(note.from, start);
  if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.length);
  oscillator.connect(shaped(context, start, note.length, note.loudness ?? 0.2));
  oscillator.start(start);
  oscillator.stop(start + note.length);
}

/** One knock of a die on the table. */
function playRattle(context: AudioContext, start: number): void {
  const length = 0.05;
  const buffer = context.createBuffer(1, context.sampleRate * length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  const knock = context.createBiquadFilter();
  knock.type = "bandpass";
  knock.frequency.value = 1800 + Math.random() * 1400;
  noise.connect(knock).connect(shaped(context, start, length, 0.35));
  noise.start(start);
}

/**
 * Plays a moment's sound and, on phones that can, its buzz. It does nothing unless sound has
 * been switched on in the preferences. A browser only lets sound start from a tap, so one
 * asked for at any other time may pass in silence.
 */
export function cue(name: Cue): void {
  if (!loadPrefs().sound) return;
  const { rattles = [], notes = [], buzz } = TUNES[name];
  if ("vibrate" in navigator) navigator.vibrate(buzz);
  const context = (audio ??= new AudioContext());
  void context.resume();
  const start = context.currentTime;
  for (const at of rattles) playRattle(context, start + at);
  for (const note of notes) playNote(context, start + note.at, note);
}
