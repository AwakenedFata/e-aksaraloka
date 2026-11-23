"use client";

/**
 * Hybrid Royal Fantasy Audio Engine for E-Aksaraloka ("Pustaka Fantasi").
 *
 * Combines:
 * 1. Streaming Background Music (`bgm-e-aksaraloka.mp3`) with autoplay-policy-safe
 *    first-gesture fade-in, stage-aware focus volume, tab visibility pause/resume,
 *    and automatic ducking during voiceover narrations & achievement fanfares.
 * 2. Zero-latency Web Audio API SFX Buffer Cache (`sfx-*.mp3`) with automatic
 *    procedural synthesizer fallback if any buffer is still loading or unavailable.
 * 3. Pre-rendered Indonesian female voiceover narrations (`narasi-*.mp3`) across
 *    all 4 Kitab Materi sections, falling back gracefully to Web Speech API.
 */

export type AudioStageContext = "hero" | "materi" | "reading" | "latihan";

export type NarrationTrackId =
  | "pembuka-pustaka"
  | "bola-waktu"
  | "mao-emas"
  | "misi-bahasa";

export type SfxKey = "click" | "pageFlip" | "sealUnlock" | "error" | "portal";

export const AUDIO_ASSETS = {
  bgm: "/assets/audio/bgm-e-aksaraloka.mp3",
  sfx: {
    click: "/assets/audio/sfx-royal-click.mp3",
    pageFlip: "/assets/audio/sfx-page-flip.mp3",
    sealUnlock: "/assets/audio/sfx-seal-unlock.mp3",
    error: "/assets/audio/sfx-soft-error.mp3",
    portal: "/assets/audio/sfx-portal.mp3",
  },
  narration: {
    "pembuka-pustaka": "/assets/audio/narasi-pembuka-pustaka.mp3",
    "bola-waktu": "/assets/audio/narasi-bola-waktu.mp3",
    "mao-emas": "/assets/audio/narasi-mao-emas.mp3",
    "misi-bahasa": "/assets/audio/narasi-misi-bahasa.mp3",
  },
} as const satisfies {
  readonly bgm: string;
  readonly sfx: Record<SfxKey, string>;
  readonly narration: Record<NarrationTrackId, string>;
};

const BGM_BASE_VOLUME = 0.22;
const BGM_STUDIO_VOLUME = 0.14;
const BGM_DUCK_NARRATION_VOLUME = 0.045;
const BGM_DUCK_FANFARE_VOLUME = 0.09;
const NARRATION_VOLUME = 0.96;

const SFX_COOLDOWN_MS: Record<SfxKey, number> = {
  click: 45,
  pageFlip: 120,
  sealUnlock: 200,
  error: 80,
  portal: 180,
};

type AudioListener = () => void;

let audioCtx: AudioContext | null = null;
let isMutedState = false;
let isNarratingState = false;
let activeNarrationTrack: NarrationTrackId | null = null;
let currentStageContext: AudioStageContext = "hero";
let isFanfareDucked = false;
let fanfareDuckTimer: number | null = null;

let bgmElement: HTMLAudioElement | null = null;
let bgmUnlocked = false;
let bgmPlaying = false;
let bgmPausedForHiddenTab = false;
let bgmFadeRaf: number | null = null;

let activeNarrationAudio: HTMLAudioElement | null = null;
const narrationAudioPool = new Map<NarrationTrackId, HTMLAudioElement>();

const sfxBuffers = new Map<SfxKey, AudioBuffer>();
const sfxLoadingPromises = new Map<SfxKey, Promise<AudioBuffer | null>>();
const sfxLastPlayedAt = new Map<SfxKey, number>();

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
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
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

function computeTargetBgmVolume(): number {
  if (isMutedState) return 0;
  const stageBase =
    currentStageContext === "latihan" ? BGM_STUDIO_VOLUME : BGM_BASE_VOLUME;
  if (isNarratingState) {
    return Math.min(stageBase, BGM_DUCK_NARRATION_VOLUME);
  }
  if (isFanfareDucked) {
    return Math.min(stageBase, BGM_DUCK_FANFARE_VOLUME);
  }
  return stageBase;
}

function cancelBgmFade(): void {
  if (bgmFadeRaf !== null && typeof window !== "undefined") {
    window.cancelAnimationFrame(bgmFadeRaf);
    bgmFadeRaf = null;
  }
}

function fadeBgmTo(
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void
): void {
  if (typeof window === "undefined" || !bgmElement) {
    onComplete?.();
    return;
  }
  cancelBgmFade();

  const el = bgmElement;
  const clampedTarget = Math.max(0, Math.min(1, targetVolume));
  const startVolume = el.volume;
  if (durationMs <= 16 || Math.abs(clampedTarget - startVolume) < 0.002) {
    el.volume = clampedTarget;
    onComplete?.();
    return;
  }

  const startTime = performance.now();
  const step = (now: number) => {
    if (bgmElement !== el) {
      bgmFadeRaf = null;
      return;
    }
    const progress = Math.min(1, (now - startTime) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 2);
    el.volume = Math.max(
      0,
      Math.min(1, startVolume + (clampedTarget - startVolume) * eased)
    );
    if (progress < 1) {
      bgmFadeRaf = window.requestAnimationFrame(step);
    } else {
      bgmFadeRaf = null;
      onComplete?.();
    }
  };

  bgmFadeRaf = window.requestAnimationFrame(step);
}

function ensureBgmElement(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return null;
  }
  if (!bgmElement) {
    const el = new Audio(AUDIO_ASSETS.bgm);
    el.loop = true;
    el.preload = "none";
    el.volume = 0;
    bgmElement = el;
  }
  return bgmElement;
}

function syncBgmVolume(durationMs = 420): void {
  if (!bgmElement || !bgmPlaying || bgmElement.paused) return;
  fadeBgmTo(computeTargetBgmVolume(), durationMs);
}

function startBgmPlayback(fadeInMs = 1100): void {
  if (typeof window === "undefined" || isMutedState) return;
  if (typeof document !== "undefined" && document.hidden) return;

  const el = ensureBgmElement();
  if (!el) return;

  if (!el.paused && bgmPlaying) {
    syncBgmVolume(360);
    return;
  }

  el.volume = 0;
  const playPromise = el.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        bgmUnlocked = true;
        bgmPlaying = true;
        fadeBgmTo(computeTargetBgmVolume(), fadeInMs);
        emitChange();
      })
      .catch((err) => {
        // Autoplay blocked until next explicit user gesture
        void err;
      });
  } else {
    bgmUnlocked = true;
    bgmPlaying = true;
    fadeBgmTo(computeTargetBgmVolume(), fadeInMs);
    emitChange();
  }
}

function preloadSfxBuffer(key: SfxKey): Promise<AudioBuffer | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = sfxBuffers.get(key);
  if (existing) return Promise.resolve(existing);

  const inFlight = sfxLoadingPromises.get(key);
  if (inFlight) return inFlight;

  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);

  const promise = fetch(AUDIO_ASSETS.sfx[key])
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((arrayBuf) => ctx.decodeAudioData(arrayBuf.slice(0)))
    .then((decoded) => {
      sfxBuffers.set(key, decoded);
      return decoded;
    })
    .catch((err) => {
      void err;
      return null;
    })
    .finally(() => {
      sfxLoadingPromises.delete(key);
    });

  sfxLoadingPromises.set(key, promise);
  return promise;
}

function preloadAllSfx(): void {
  const keys: readonly SfxKey[] = [
    "click",
    "pageFlip",
    "sealUnlock",
    "error",
    "portal",
  ];
  for (const key of keys) {
    void preloadSfxBuffer(key);
  }
}

/**
 * Registers once-only passive gesture unlock listeners + tab-visibility BGM
 * pause/resume so royal fantasy ambience starts gracefully without violating
 * browser autoplay policies.
 */
export function initAudioAutoUnlock(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleFirstGesture = () => {
    if (isMutedState) return;
    getAudioContext();
    preloadAllSfx();
    startBgmPlayback(1200);
    if (bgmUnlocked) {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    }
  };

  const handleVisibilityChange = () => {
    if (!bgmElement) return;
    if (document.hidden) {
      if (!bgmElement.paused) {
        bgmPausedForHiddenTab = true;
        cancelBgmFade();
        bgmElement.pause();
      }
    } else if (bgmPausedForHiddenTab && !isMutedState) {
      bgmPausedForHiddenTab = false;
      startBgmPlayback(700);
    }
  };

  window.addEventListener("pointerdown", handleFirstGesture, { passive: true });
  window.addEventListener("keydown", handleFirstGesture, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.removeEventListener("pointerdown", handleFirstGesture);
    window.removeEventListener("keydown", handleFirstGesture);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export function setAudioStageContext(stage: AudioStageContext): void {
  if (currentStageContext === stage) return;
  currentStageContext = stage;
  syncBgmVolume(650);
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

export function getActiveNarrationTrackSnapshot(): NarrationTrackId | null {
  return activeNarrationTrack;
}

export function getBgmPlayingSnapshot(): boolean {
  return bgmPlaying && !isMutedState;
}

export function toggleAudioMuted(): boolean {
  isMutedState = !isMutedState;
  if (isMutedState) {
    stopSpeechNarration();
    if (bgmElement && !bgmElement.paused) {
      const targetEl = bgmElement;
      fadeBgmTo(0, 260, () => {
        if (isMutedState && targetEl) {
          targetEl.pause();
          bgmPlaying = false;
          emitChange();
        }
      });
    } else {
      bgmPlaying = false;
    }
  } else {
    getAudioContext();
    preloadAllSfx();
    startBgmPlayback(800);
    playChime();
  }
  emitChange();
  return isMutedState;
}

function playDecodedSfx(
  key: SfxKey,
  gainValue: number,
  fallbackSynth: (ctx: AudioContext) => void
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const lastAt = sfxLastPlayedAt.get(key) ?? 0;
  if (nowMs - lastAt < SFX_COOLDOWN_MS[key]) {
    return;
  }
  sfxLastPlayedAt.set(key, nowMs);

  const buffer = sfxBuffers.get(key);
  if (buffer) {
    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
      return;
    } catch (err) {
      void err;
    }
  } else {
    void preloadSfxBuffer(key);
  }

  fallbackSynth(ctx);
}

// ============================================================================
// PROCEDURAL WEB AUDIO FALLBACKS (instant zero-delay backup if MP3 still loads)
// ============================================================================

function playSynthChime(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
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

function playSynthPageFlip(ctx: AudioContext): void {
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

function playSynthSealUnlock(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;
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

function playSynthErrorTone(ctx: AudioContext): void {
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

function playSynthPortal(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(293.66, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    void err;
  }
}

// ============================================================================
// PUBLIC INTERACTIVE SFX API
// ============================================================================

/**
 * Royal harp/crystal UI click chime (`sfx-royal-click.mp3`).
 */
export function playChime(): void {
  playDecodedSfx("click", 0.42, playSynthChime);
}

/**
 * Heavy parchment page-turn foley (`sfx-page-flip.mp3`).
 */
export function playPageFlip(): void {
  playDecodedSfx("pageFlip", 0.56, playSynthPageFlip);
}

/**
 * Royal Asgardian achievement fanfare (`sfx-seal-unlock.mp3`) with brief BGM ducking.
 */
export function playSealUnlock(): void {
  if (!isMutedState && typeof window !== "undefined") {
    isFanfareDucked = true;
    syncBgmVolume(180);
    if (fanfareDuckTimer !== null) {
      window.clearTimeout(fanfareDuckTimer);
    }
    fanfareDuckTimer = window.setTimeout(() => {
      fanfareDuckTimer = null;
      isFanfareDucked = false;
      syncBgmVolume(650);
    }, 1800);
  }
  playDecodedSfx("sealUnlock", 0.58, playSynthSealUnlock);
}

/**
 * Gentle muted wooden nudge when an answer needs revision (`sfx-soft-error.mp3`).
 */
export function playErrorTone(): void {
  playDecodedSfx("error", 0.44, playSynthErrorTone);
}

/**
 * Ethereal golden portal shimmer (`sfx-portal.mp3`) for scene transitions & fast-travel.
 */
export function playPortalTransition(): void {
  playDecodedSfx("portal", 0.48, playSynthPortal);
}

// ============================================================================
// PRE-RENDERED VOICEOVER NARRATION + NATURAL WEB SPEECH FALLBACK
// ============================================================================

function speakWithBrowserFallback(
  text: string,
  trackId: NarrationTrackId | null
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.96;
    utterance.pitch = 1.02;

    const voices = synth.getVoices();
    const indoVoices = voices.filter((v) =>
      v.lang.toLowerCase().includes("id")
    );
    const preferredVoice =
      indoVoices.find((v) => /gadis|damayanti|natural|neural/i.test(v.name)) ??
      indoVoices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      isNarratingState = false;
      activeNarrationTrack = null;
      syncBgmVolume(650);
      emitChange();
    };
    utterance.onerror = () => {
      isNarratingState = false;
      activeNarrationTrack = null;
      syncBgmVolume(650);
      emitChange();
    };

    isNarratingState = true;
    activeNarrationTrack = trackId;
    syncBgmVolume(300);
    emitChange();
    synth.speak(utterance);
    return true;
  } catch (err) {
    void err;
    isNarratingState = false;
    activeNarrationTrack = null;
    syncBgmVolume(500);
    emitChange();
    return false;
  }
}

/**
 * Toggles one of the 4 pre-rendered Indonesian female voiceover tracks
 * (`narasi-pembuka-pustaka.mp3`, `narasi-bola-waktu.mp3`, `narasi-mao-emas.mp3`,
 * `narasi-misi-bahasa.mp3`) with automatic BGM ducking and graceful fallback.
 */
export function toggleNarrationTrack(
  trackId: NarrationTrackId,
  fallbackText?: string
): boolean {
  if (typeof window === "undefined") return false;

  if (isNarratingState && activeNarrationTrack === trackId) {
    stopSpeechNarration();
    return false;
  }

  stopSpeechNarration();

  if (isMutedState) {
    isMutedState = false;
    getAudioContext();
    preloadAllSfx();
    startBgmPlayback(600);
  }

  if (typeof Audio === "undefined") {
    return fallbackText ? speakWithBrowserFallback(fallbackText, trackId) : false;
  }

  try {
    let el = narrationAudioPool.get(trackId);
    if (!el) {
      el = new Audio(AUDIO_ASSETS.narration[trackId]);
      el.preload = "auto";
      narrationAudioPool.set(trackId, el);
    }

    el.currentTime = 0;
    el.volume = NARRATION_VOLUME;

    el.onended = () => {
      if (activeNarrationAudio === el) {
        activeNarrationAudio = null;
        isNarratingState = false;
        activeNarrationTrack = null;
        syncBgmVolume(700);
        emitChange();
      }
    };

    el.onerror = () => {
      if (activeNarrationAudio === el) {
        activeNarrationAudio = null;
        isNarratingState = false;
        activeNarrationTrack = null;
        if (fallbackText) {
          speakWithBrowserFallback(fallbackText, trackId);
        } else {
          syncBgmVolume(600);
          emitChange();
        }
      }
    };

    activeNarrationAudio = el;
    isNarratingState = true;
    activeNarrationTrack = trackId;
    syncBgmVolume(320);
    emitChange();

    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (activeNarrationAudio === el) {
          activeNarrationAudio = null;
          isNarratingState = false;
          activeNarrationTrack = null;
          if (fallbackText) {
            speakWithBrowserFallback(fallbackText, trackId);
          } else {
            syncBgmVolume(600);
            emitChange();
          }
        }
      });
    }

    return true;
  } catch (err) {
    void err;
    return fallbackText ? speakWithBrowserFallback(fallbackText, trackId) : false;
  }
}

/**
 * Backwards-compatible narration toggler. Delegates to pre-rendered MP3 audio
 * when `trackId` is supplied, otherwise speaks dynamic text via Web Speech API.
 */
export function toggleSpeechNarration(
  text: string,
  trackId?: NarrationTrackId
): boolean {
  if (trackId) {
    return toggleNarrationTrack(trackId, text);
  }
  if (typeof window === "undefined") return false;
  if (isNarratingState) {
    stopSpeechNarration();
    return false;
  }
  if (isMutedState) {
    isMutedState = false;
    startBgmPlayback(600);
  }
  return speakWithBrowserFallback(text, null);
}

export function stopSpeechNarration(): void {
  if (activeNarrationAudio) {
    try {
      activeNarrationAudio.pause();
      activeNarrationAudio.currentTime = 0;
    } catch (err) {
      void err;
    }
    activeNarrationAudio = null;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      void err;
    }
  }

  if (isNarratingState || activeNarrationTrack !== null) {
    isNarratingState = false;
    activeNarrationTrack = null;
    syncBgmVolume(650);
    emitChange();
  }
}
