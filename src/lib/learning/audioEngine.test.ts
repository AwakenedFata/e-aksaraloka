import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_ASSETS,
  SFX_PLAYBACK_PROFILES,
  detectLeadingSilenceOffset,
  getActiveNarrationTrackSnapshot,
  getAudioMutedSnapshot,
  getAudioNarratingSnapshot,
  playChime,
  playErrorTone,
  playPageFlip,
  playPortalTransition,
  playSealUnlock,
  setAudioStageContext,
  stopSpeechNarration,
  subscribeAudioState,
  toggleAudioMuted,
} from "./audioEngine";

describe("audioEngine manifest & SSR-safe state transitions", () => {
  it("maps every configured BGM, SFX, and narration asset to an existing file in public/", () => {
    const publicRoot = path.join(process.cwd(), "public");
    const allAssetPaths = [
      AUDIO_ASSETS.bgm,
      ...Object.values(AUDIO_ASSETS.sfx),
      ...Object.values(AUDIO_ASSETS.narration),
    ];

    expect(allAssetPaths).toHaveLength(10);
    for (const relUrl of allAssetPaths) {
      const diskPath = path.join(publicRoot, relUrl.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Missing audio asset on disk: ${relUrl}`).toBe(true);
      expect(fs.statSync(diskPath).size).toBeGreaterThan(1024);
    }
  });

  it("toggles mute state cleanly, notifies subscribers, and stays safe in non-browser environments", () => {
    let notifications = 0;
    const unsub = subscribeAudioState(() => {
      notifications++;
    });

    const initialMuted = getAudioMutedSnapshot();
    const toggled = toggleAudioMuted();
    expect(toggled).toBe(!initialMuted);
    expect(getAudioMutedSnapshot()).toBe(toggled);
    expect(notifications).toBeGreaterThanOrEqual(1);

    // Restore original state cleanly
    toggleAudioMuted();
    expect(getAudioMutedSnapshot()).toBe(initialMuted);

    // No-op safely without throwing when window/AudioContext are absent
    expect(() => {
      setAudioStageContext("latihan");
      setAudioStageContext("hero");
      playChime();
      playPageFlip();
      playSealUnlock();
      playErrorTone();
      playPortalTransition();
      stopSpeechNarration();
    }).not.toThrow();

    expect(getAudioNarratingSnapshot()).toBe(false);
    expect(getActiveNarrationTrackSnapshot()).toBeNull();

    unsub();
  });

  it("detects leading silence offset accurately so delayed SFX MP3s play on transient onset", () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 2);
    // Simulate 0.45s of silence followed by a sharp parchment transient
    const onsetSample = Math.floor(0.45 * sampleRate);
    samples[onsetSample] = 0.25;

    const detected = detectLeadingSilenceOffset([samples], sampleRate, 0.03, 0.01);
    expect(detected).toBeCloseTo(0.44, 2);

    // Sound starting right at sample 0 returns 0 offset
    const immediate = new Float32Array(1024);
    immediate[0] = 0.5;
    expect(detectLeadingSilenceOffset([immediate], sampleRate, 0.03, 0.01)).toBe(0);

    // Threshold <= 0 disables leading trim completely (used for full-duration portal SFX)
    expect(detectLeadingSilenceOffset([samples], sampleRate, 0, 0.01)).toBe(0);
    expect(SFX_PLAYBACK_PROFILES.portal.onsetThreshold).toBe(0);
    expect(SFX_PLAYBACK_PROFILES.portal.playbackRate).toBe(1.0);
    expect(SFX_PLAYBACK_PROFILES.portal.maxDurationSec).toBeNull();
    expect(SFX_PLAYBACK_PROFILES.portal.fadeOutSec).toBe(0);
  });

  it("pre-buffers BGM immediately on mount, starts when autoplay is allowed, and falls back cleanly on gesture when blocked", async () => {
    const origWindow = globalThis.window;
    const origDocument = globalThis.document;
    const origAudio = globalThis.Audio;

    const runScenario = async (allowMountAutoplay: boolean) => {
      vi.resetModules();

      const windowListeners = new Map<string, Set<() => void>>();
      const docListeners = new Map<string, Set<() => void>>();
      const createdAudios: Array<{
        src: string;
        loop: boolean;
        preload: string;
        volume: number;
        paused: boolean;
        playCalls: number;
      }> = [];

      let nextPlayAllowed = allowMountAutoplay;

      class MockAudio {
        src = "";
        loop = false;
        preload = "";
        volume = 0;
        paused = true;
        playCalls = 0;

        constructor(src?: string) {
          if (src) this.src = src;
          createdAudios.push(this);
        }

        play(): Promise<void> {
          this.playCalls++;
          if (nextPlayAllowed) {
            this.paused = false;
            return Promise.resolve();
          }
          return Promise.reject(new Error("NotAllowedError"));
        }

        pause(): void {
          this.paused = true;
        }
      }

      const mockWindow = {
        addEventListener(type: string, fn: () => void) {
          const set = windowListeners.get(type) ?? new Set();
          set.add(fn);
          windowListeners.set(type, set);
        },
        removeEventListener(type: string, fn: () => void) {
          windowListeners.get(type)?.delete(fn);
        },
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
      };

      const mockDocument = {
        hidden: false,
        addEventListener(type: string, fn: () => void) {
          const set = docListeners.get(type) ?? new Set();
          set.add(fn);
          docListeners.set(type, set);
        },
        removeEventListener(type: string, fn: () => void) {
          docListeners.get(type)?.delete(fn);
        },
      };

      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "document", {
        value: mockDocument,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "Audio", {
        value: MockAudio,
        configurable: true,
        writable: true,
      });

      const mod = await import("./audioEngine");
      const cleanup = mod.initAudioAutoUnlock();

      // Flush microtasks for mount play() promise
      await Promise.resolve();
      await Promise.resolve();

      expect(createdAudios).toHaveLength(1);
      expect(createdAudios[0]!.preload).toBe("auto");
      expect(createdAudios[0]!.loop).toBe(true);
      expect(createdAudios[0]!.src).toBe(AUDIO_ASSETS.bgm);
      expect(createdAudios[0]!.playCalls).toBe(1);

      if (allowMountAutoplay) {
        expect(mod.getBgmPlayingSnapshot()).toBe(true);
        // All gesture fallback listeners auto-detached once unlocked on mount
        expect(windowListeners.get("pointerdown")?.size ?? 0).toBe(0);
        expect(windowListeners.get("click")?.size ?? 0).toBe(0);
        expect(windowListeners.get("touchend")?.size ?? 0).toBe(0);
        expect(windowListeners.get("keydown")?.size ?? 0).toBe(0);
      } else {
        expect(mod.getBgmPlayingSnapshot()).toBe(false);
        // Gesture fallback listeners stay armed until first interaction
        expect(windowListeners.get("pointerdown")?.size).toBe(1);
        expect(windowListeners.get("touchend")?.size).toBe(1);

        // Simulate first user tap/click granting playback permission
        nextPlayAllowed = true;
        for (const fn of Array.from(windowListeners.get("pointerdown") ?? [])) {
          fn();
        }
        await Promise.resolve();
        await Promise.resolve();

        expect(createdAudios[0]!.playCalls).toBe(2);
        expect(mod.getBgmPlayingSnapshot()).toBe(true);
        expect(windowListeners.get("pointerdown")?.size ?? 0).toBe(0);
        expect(windowListeners.get("touchend")?.size ?? 0).toBe(0);
      }

      cleanup();
    };

    try {
      await runScenario(true);
      await runScenario(false);
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: origWindow,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "document", {
        value: origDocument,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "Audio", {
        value: origAudio,
        configurable: true,
        writable: true,
      });
    }
  });
});
