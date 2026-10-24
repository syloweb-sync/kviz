"use client";

/**
 * Tiny synthesised sound kit (Web Audio API) — no audio files, so no licensing concerns.
 * Audio starts only after a user gesture (browser autoplay rules); the mute preference is
 * stored per device in localStorage.
 */

export type SoundName = "join" | "tick" | "submit" | "correct" | "incorrect" | "timeUp" | "reveal" | "leaderboard" | "winner";

const MUTE_KEY = "pitalica:muted";
let context: AudioContext | null = null;
let musicStop: (() => void) | null = null;
const listeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage unavailable (private mode) — keep the in-memory state only.
  }
  if (muted) stopMusic();
  listeners.forEach((fn) => fn(muted));
}

export function onMuteChange(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

/** Call from a user gesture (tap/click) to unlock audio on iOS/Chrome. */
export function unlockAudio() {
  const c = ctx();
  if (c && c.state === "suspended") void c.resume();
}

function tone(c: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, volume: number, slideTo?: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

const RECIPES: Record<SoundName, (c: AudioContext, t: number) => void> = {
  join: (c, t) => {
    tone(c, 660, t, 0.12, "sine", 0.18);
    tone(c, 990, t + 0.07, 0.16, "sine", 0.14);
  },
  tick: (c, t) => tone(c, 1200, t, 0.05, "square", 0.05),
  submit: (c, t) => tone(c, 520, t, 0.1, "triangle", 0.2, 780),
  correct: (c, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.22, "triangle", 0.18)),
  incorrect: (c, t) => {
    tone(c, 220, t, 0.25, "sawtooth", 0.08, 160);
    tone(c, 165, t + 0.16, 0.3, "sawtooth", 0.07, 120);
  },
  timeUp: (c, t) => {
    tone(c, 440, t, 0.5, "sine", 0.18, 220);
    tone(c, 330, t, 0.6, "triangle", 0.1, 165);
  },
  reveal: (c, t) => tone(c, 300, t, 0.35, "sine", 0.14, 900),
  leaderboard: (c, t) => [392, 494, 587].forEach((f, i) => tone(c, f, t + i * 0.1, 0.18, "sine", 0.14)),
  winner: (c, t) =>
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(c, f, t + i * 0.12, i === 6 ? 0.7 : 0.2, "triangle", 0.18)),
};

export function playSound(name: SoundName) {
  if (isMuted()) return;
  const c = ctx();
  if (!c || c.state !== "running") return;
  RECIPES[name](c, c.currentTime + 0.01);
}

/** Gentle looping lobby arpeggio. Returns nothing; call stopMusic() to end it. */
export function startMusic() {
  if (isMuted() || musicStop) return;
  const c = ctx();
  if (!c) return;
  const notes = [262, 330, 392, 494, 392, 330, 294, 349, 440, 523, 440, 349];
  let step = 0;
  let next = c.currentTime + 0.1;
  const timer = window.setInterval(() => {
    if (c.state !== "running") return;
    while (next < c.currentTime + 0.4) {
      const freq = notes[step % notes.length]!;
      tone(c, freq, next, 0.32, "sine", 0.045);
      if (step % 4 === 0) tone(c, freq / 2, next, 0.6, "triangle", 0.035);
      step++;
      next += 0.28;
    }
  }, 150);
  musicStop = () => {
    window.clearInterval(timer);
    musicStop = null;
  };
}

export function stopMusic() {
  musicStop?.();
}
