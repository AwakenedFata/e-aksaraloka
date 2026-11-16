"use client";

/**
 * Procedural Web Audio API sound synthesizer & Web Speech API Indonesian narrator
 * for E-Aksaraloka ("Pustaka Fantasi").
 *
 * Zero external audio files required: generates warm parchment rustles,
 * celesta/harp chimes, and seal unlock chords directly in the browser,
 * while supporting multi-modal audio narration (Peluang Peran Media #1).
 */

type AudioListener = () => void;

let audioCtx: AudioContext | null = null;
let isMutedState = false;
let isNarratingState = false;
const listeners = new Set<AudioListener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || isMutedState) return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch (err) {
      void err;
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch((err) => {
      void err;
    });
  }
  return audioCtx;
}

export function subscribeAudioState(listener: AudioListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAudioMutedSnapshot(): boolean {
  return isMutedState;
}

export function getAudioNarratingSnapshot(): boolean {
  return isNarratingState;
}

export function toggleAudioMuted(): boolean {
  isMutedState = !isMutedState;
  if (isMutedState) {
    stopSpeechNarration();
  } else {
    playChime();
  }
  emitChange();
  return isMutedState;
}

/**
 * Subtle golden UI chime on interactive tab/card selection.
 */
export function playChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch (err) {
    void err;
  }
}

/**
 * Procedural parchment page-flip sound (filtered noise burst + soft low thump)
 * synchronized with the 3D hand page-flip frames (355-445).
 */
export function playPageFlip(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const duration = 0.28;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(Math.PI * t) * (1 - 0.35 * t);
      data[i] = (Math.random() * 2 - 1) * env * 0.28;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + duration * 0.65);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  } catch (err) {
    void err;
  }
}

/**
 * Warm celesta/harp arpeggio when a student solves a narrative puzzle or unlocks a Seal.
 */
export function playSealUnlock(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // C5 - E5 - G5 - B5 - D6 warm major-9th fantasy chord
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.58);
    });
  } catch (err) {
    void err;
  }
}

/**
 * Gentle low wooden tone when an answer needs revision.
 */
export function playErrorTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(195, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch (err) {
    void err;
  }
}

/**
 * Speaks story model excerpts in Indonesian using Web Speech API
 * to fulfill Peluang Peran Media #1 (varied text models: text, visual, audio).
 */
export function toggleSpeechNarration(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || isNarratingState) {
      synth.cancel();
      isNarratingState = false;
      emitChange();
      return false;
    }

    if (isMutedState) {
      isMutedState = false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.96;
    utterance.pitch = 1.02;

    const voices = synth.getVoices();
    const indoVoice = voices.find((v) => v.lang.toLowerCase().includes("id"));
    if (indoVoice) {
      utterance.voice = indoVoice;
    }

    utterance.onend = () => {
      isNarratingState = false;
      emitChange();
    };
    utterance.onerror = () => {
      isNarratingState = false;
      emitChange();
    };

    isNarratingState = true;
    emitChange();
    synth.speak(utterance);
    return true;
  } catch (err) {
    void err;
    isNarratingState = false;
    emitChange();
    return false;
  }
}

export function stopSpeechNarration(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch (err) {
    void err;
  }
  if (isNarratingState) {
    isNarratingState = false;
    emitChange();
  }
}
