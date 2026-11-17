import { describe, expect, it } from "vitest";
import {
  FrameCacheManager,
  detectAdaptiveCacheBudget,
  getFrameUrl,
  TOTAL_LATIHAN_FRAMES_DEFAULT,
  type DecodeBackend,
} from "./frameCacheManager";

interface MockBitmap {
  readonly id: string;
  closed: boolean;
}

function createMockBackend() {
  let activeFetches = 0;
  let peakConcurrentFetches = 0;
  let totalFetches = 0;
  const closedIds: string[] = [];

  const backend: DecodeBackend<MockBitmap> = {
    async fetchBlob(url: string) {
      activeFetches++;
      totalFetches++;
      if (activeFetches > peakConcurrentFetches) {
        peakConcurrentFetches = activeFetches;
      }
      await new Promise((r) => setTimeout(r, 2));
      activeFetches--;
      return new Blob([url], { type: "image/webp" });
    },
    async decodeBitmap(blob: Blob) {
      const id = await blob.text();
      return { id, closed: false };
    },
    closeBitmap(bitmap: MockBitmap) {
      bitmap.closed = true;
      closedIds.push(bitmap.id);
    },
  };

  return {
    backend,
    getStats: () => ({ peakConcurrentFetches, totalFetches, closedIds }),
  };
}

describe("FrameCacheManager", () => {
  it("caps active GPU ImageBitmaps via LRU eviction and calls close() on evicted frames", async () => {
    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 240,
        totalMateriFrames: 299,
        totalReadingFrames: 537,
        maxActiveBitmaps: 10,
        maxCachedBlobs: 100,
        maxConcurrentDecodes: 4,
      },
      mock.backend
    );

    cache.setFocus("reading", 1, 1);
    for (let i = 1; i <= 30; i++) {
      cache.setFocus("reading", i, 1);
      await cache.loadFrame("reading", i, true);
    }

    expect(cache.getActiveBitmapCount()).toBeLessThanOrEqual(10);
    expect(mock.getStats().closedIds.length).toBeGreaterThanOrEqual(18);
    // Pinned reading frame 1 stays cached and unclosed
    expect(cache.getBitmap("reading", 1)?.closed).toBe(false);

    cache.destroy();
  });

  it("strictly respects maxConcurrentDecodes ceiling and reuses compressed Blobs on reverse", async () => {
    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 50,
        totalMateriFrames: 50,
        totalReadingFrames: 50,
        maxActiveBitmaps: 8,
        maxCachedBlobs: 60,
        maxConcurrentDecodes: 3,
      },
      mock.backend
    );

    cache.requestWindow("materi", 1, 1, 20, 0);
    await new Promise((r) => setTimeout(r, 80));

    expect(mock.getStats().peakConcurrentFetches).toBeLessThanOrEqual(3);
    const fetchesAfterForward = mock.getStats().totalFetches;

    // Reverse across already-visited frames should decode from Blob cache without extra fetches
    cache.setFocus("materi", 2, -1);
    await cache.loadFrame("materi", 2, true);
    await cache.loadFrame("materi", 3, true);
    await cache.loadFrame("materi", 4, true);

    expect(mock.getStats().totalFetches).toBe(fetchesAfterForward);

    cache.destroy();
  });

  it("supports cross-stage pinned boundary fallbacks and clean destroy", async () => {
    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 240,
        totalMateriFrames: 299,
        totalReadingFrames: 537,
        maxActiveBitmaps: 5,
      },
      mock.backend
    );

    const materi299 = await cache.loadFrame("materi", 299, true);
    expect(materi299).not.toBeNull();

    // Reading frame 1 hasn't been decoded yet; should bridge cleanly to Materi 299
    const fallback = cache.getBestBitmap("reading", 1);
    expect(fallback?.id).toContain("materi-frames/frame-299.webp");

    cache.destroy();
    expect(cache.getActiveBitmapCount()).toBe(0);
    expect(cache.getPinnedBitmapCount()).toBe(0);
    expect(materi299?.closed).toBe(true);
  });

  it("uses direction-aware trailing fallback in getBestBitmap and counts contiguous frames accurately", async () => {
    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 50,
        totalMateriFrames: 50,
        totalReadingFrames: 50,
        maxActiveBitmaps: 20,
      },
      mock.backend
    );

    await cache.loadFrame("reading", 8, true);
    await cache.loadFrame("reading", 9, true);
    await cache.loadFrame("reading", 11, true);
    // Notice frame 10 is intentionally missing

    expect(cache.getBestBitmap("reading", 10, 1)?.id).toContain("reading-frames/frame-009.webp");
    expect(cache.getBestBitmap("reading", 10, -1)?.id).toContain("reading-frames/frame-011.webp");

    // Forward contiguous check from 8 -> {8, 9} = 2 (stops at missing 10)
    expect(cache.countContiguousReady("reading", 8, 1, 10)).toBe(2);
    // Reverse contiguous check from 11 -> {11} = 1 (stops at missing 10)
    expect(cache.countContiguousReady("reading", 11, -1, 10)).toBe(1);

    await cache.loadFrame("reading", 10, true);
    expect(cache.countContiguousReady("reading", 8, 1, 10)).toBe(4);

    cache.destroy();
  });

  it("preserves cross-stage warmSequenceHead bitmaps under full cache and prioritizes Blob warmup cleanly", async () => {
    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 40,
        totalMateriFrames: 40,
        totalReadingFrames: 40,
        maxActiveBitmaps: 24,
        maxCachedBlobs: 200,
        maxConcurrentDecodes: 4,
        maxConcurrentFetches: 4,
        maxBackgroundWarms: 4,
      },
      mock.backend
    );

    // Fill active Hero cache at Hero hub end (frames 17..40)
    for (let i = 17; i <= 40; i++) {
      cache.setFocus("hero", i, 1);
      await cache.loadFrame("hero", i, true);
    }
    expect(cache.getActiveBitmapCount()).toBe(23); // frame 40 is pinned

    // Warm next stage head while Hero hub is full -> must keep Materi head frames instead of evicting them
    cache.warmSequenceHead("materi", 6);
    await new Promise((r) => setTimeout(r, 40));

    for (let i = 1; i <= 6; i++) {
      expect(cache.hasBitmap("materi", i)).toBe(true);
    }

    // Queue hero, materi, then reading Blob warmup and reprioritize reading to front
    cache.queueBlobWarmup("reading", 2, 10, 1);
    cache.reprioritizeBlobWarmup("reading");
    await new Promise((r) => setTimeout(r, 80));

    expect(cache.getBlobCount()).toBeGreaterThanOrEqual(24 + 6 + 8);
    // Deduplication check: loading already Blob-warmed Reading frame must NOT trigger extra fetches
    cache.setFocus("reading", 5, 1);
    const fetchesBeforeWarmHit = mock.getStats().totalFetches;
    const f5 = await cache.loadFrame("reading", 5, true);
    expect(f5).not.toBeNull();
    expect(mock.getStats().totalFetches).toBe(fetchesBeforeWarmHit);

    cache.destroy();
  });

  it("maps virtual latihan timeline seamlessly across latihan-frames, hallway-frames, and studio-tulis-frames", async () => {
    expect(TOTAL_LATIHAN_FRAMES_DEFAULT).toBe(561);
    expect(getFrameUrl("latihan", 1, 561)).toBe("/latihan-frames/frame-001.webp");
    expect(getFrameUrl("latihan", 185, 561)).toBe("/latihan-frames/frame-185.webp");
    expect(getFrameUrl("latihan", 186, 561)).toBe("/hallway-frames/frame-001.webp");
    expect(getFrameUrl("latihan", 373, 561)).toBe("/hallway-frames/frame-188.webp");
    expect(getFrameUrl("latihan", 374, 561)).toBe("/studio-tulis-frames/frame-001.webp");
    expect(getFrameUrl("latihan", 561, 561)).toBe("/studio-tulis-frames/frame-188.webp");

    const mock = createMockBackend();
    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 240,
        totalMateriFrames: 299,
        totalReadingFrames: 537,
        totalLatihanFrames: 561,
        maxActiveBitmaps: 30,
      },
      mock.backend
    );

    const hero240 = await cache.loadFrame("hero", 240, true);
    expect(hero240).not.toBeNull();

    // Before latihan frame 1 is decoded, getBestBitmap bridges seamlessly to Hero 240
    expect(cache.getBestBitmap("latihan", 1)?.id).toContain("hero-frames/frame-240.webp");

    // Dual hub pre-warm retains both Materi and Latihan heads simultaneously
    cache.setFocus("hero", 240, 1);
    cache.warmSequenceHead("materi", 4, false);
    cache.warmSequenceHead("latihan", 4, true);
    await new Promise((r) => setTimeout(r, 40));

    expect(cache.hasBitmap("materi", 1)).toBe(true);
    expect(cache.hasBitmap("latihan", 1)).toBe(true);

    const seg2Start = await cache.loadFrame("latihan", 186, true);
    const seg3Start = await cache.loadFrame("latihan", 374, true);
    expect(seg2Start?.id).toBe("/hallway-frames/frame-001.webp");
    expect(seg3Start?.id).toBe("/studio-tulis-frames/frame-001.webp");

    cache.destroy();
  });

  it("adapts GPU bitmap and Blob memory budgets across low-RAM, mobile, balanced, and high-spec hardware tiers", () => {
    const lowRamBudget = detectAdaptiveCacheBudget({
      deviceMemory: 4,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
      isCoarsePointer: false,
    });
    expect(lowRamBudget.tier).toBe("low");
    expect(lowRamBudget.maxActiveBitmaps).toBe(44);
    expect(lowRamBudget.maxCachedBlobs).toBe(360);
    expect(lowRamBudget.lookahead + lowRamBudget.lookbehind).toBeLessThan(
      lowRamBudget.maxActiveBitmaps
    );

    const mobileBudget = detectAdaptiveCacheBudget({
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 390,
      isCoarsePointer: true,
    });
    expect(mobileBudget.tier).toBe("low");
    expect(mobileBudget.maxActiveBitmaps).toBe(44);

    const balancedDesktop = detectAdaptiveCacheBudget({
      deviceMemory: undefined,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
      isCoarsePointer: false,
    });
    expect(balancedDesktop.tier).toBe("balanced");
    expect(balancedDesktop.maxActiveBitmaps).toBe(68);
    expect(balancedDesktop.maxCachedBlobs).toBe(720);

    const highDesktop = detectAdaptiveCacheBudget({
      deviceMemory: 8,
      hardwareConcurrency: 12,
      viewportWidth: 1920,
      isCoarsePointer: false,
    });
    expect(highDesktop.tier).toBe("high");
    expect(highDesktop.maxActiveBitmaps).toBe(96);
    expect(highDesktop.maxCachedBlobs).toBe(1100);
    expect(highDesktop.maxConcurrentFetches).toBe(14);
    expect(highDesktop.lookahead + highDesktop.lookbehind).toBeLessThan(
      highDesktop.maxActiveBitmaps
    );

    const constrainedNetBudget = detectAdaptiveCacheBudget({
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
      isCoarsePointer: false,
      saveData: true,
      effectiveType: "3g",
    });
    expect(constrainedNetBudget.isConstrainedNetwork).toBe(true);
    expect(constrainedNetBudget.maxConcurrentFetches).toBe(6);

    const desktopSafari4Core = detectAdaptiveCacheBudget({
      deviceMemory: undefined,
      hardwareConcurrency: 4,
      viewportWidth: 1280,
      isCoarsePointer: false,
    });
    expect(desktopSafari4Core.tier).toBe("balanced");
  });

  it("decouples high-concurrency HTTP prefetch from bounded GPU decode slots and tracks monotonic source frames", async () => {
    let activeHttp = 0;
    let peakHttp = 0;
    let activeDecode = 0;
    let peakDecode = 0;

    const backend: DecodeBackend<MockBitmap> = {
      async fetchBlob(url: string) {
        activeHttp++;
        if (activeHttp > peakHttp) peakHttp = activeHttp;
        await new Promise((r) => setTimeout(r, 15));
        activeHttp--;
        return new Blob([url], { type: "image/webp" });
      },
      async decodeBitmap(blob: Blob) {
        activeDecode++;
        if (activeDecode > peakDecode) peakDecode = activeDecode;
        await new Promise((r) => setTimeout(r, 8));
        activeDecode--;
        return { id: await blob.text(), closed: false };
      },
      closeBitmap(b: MockBitmap) {
        b.closed = true;
      },
    };

    const cache = new FrameCacheManager<MockBitmap>(
      {
        totalHeroFrames: 60,
        totalMateriFrames: 60,
        totalReadingFrames: 60,
        maxActiveBitmaps: 40,
        maxCachedBlobs: 120,
        maxConcurrentDecodes: 2,
        maxConcurrentFetches: 8,
      },
      backend
    );

    cache.requestWindow("hero", 1, 1, 20, 0);
    await new Promise((r) => setTimeout(r, 120));

    expect(peakHttp).toBeGreaterThanOrEqual(5);
    expect(peakHttp).toBeLessThanOrEqual(8);
    expect(peakDecode).toBeLessThanOrEqual(2);

    const exact = cache.getBestBitmapWithFrame("hero", 1, 1);
    expect(exact?.exact).toBe(true);
    expect(exact?.frame).toBe(1);

    cache.destroy();
  });
});
