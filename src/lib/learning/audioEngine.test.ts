import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIO_ASSETS,
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
});
