import type { SequenceType } from "./sequenceEasing";

export const LATIHAN_SEGMENT_COUNTS = {
  latihan: 185,
  hallway: 188,
  studio: 188,
} as const;

export const TOTAL_LATIHAN_FRAMES_DEFAULT =
  LATIHAN_SEGMENT_COUNTS.latihan +
  LATIHAN_SEGMENT_COUNTS.hallway +
  LATIHAN_SEGMENT_COUNTS.studio;

export interface FrameCacheConfig {
  readonly totalHeroFrames: number;
  readonly totalMateriFrames: number;
  readonly totalReadingFrames: number;
  readonly totalLatihanFrames?: number;
  /** Maximum non-pinned decoded ImageBitmaps kept in GPU memory at once (~8.3MB each at 1080p). */
  readonly maxActiveBitmaps?: number;
  /** Maximum compressed WebP Blobs kept in JS memory (~115-182KB each) for instant zero-network re-decode. */
  readonly maxCachedBlobs?: number;
  /** Maximum concurrent active decode jobs (lookahead/playback). */
  readonly maxConcurrentDecodes?: number;
  /** Maximum concurrent HTTP blob fetches (urgent + background combined). */
  readonly maxConcurrentFetches?: number;
  /** Maximum concurrent background Blob-only pre-warm fetches. */
  readonly maxBackgroundWarms?: number;
}

export interface DecodeBackend<TBitmap> {
  fetchBlob: (url: string, priority: "high" | "low") => Promise<Blob>;
  decodeBitmap: (blob: Blob) => Promise<TBitmap>;
  closeBitmap: (bitmap: TBitmap) => void;
}

export interface PlaybackFocus {
  sequence: SequenceType;
  centerFrame: number;
  direction: 1 | -1;
}

interface PendingJob<TBitmap> {
  key: string;
  sequence: SequenceType;
  index: number;
  urgent: boolean;
  resolveList: Array<(bitmap: TBitmap | null) => void>;
}

const DEFAULT_MAX_ACTIVE_BITMAPS = 96;
const DEFAULT_MAX_CACHED_BLOBS = 1200;
const DEFAULT_MAX_CONCURRENT_DECODES = 6;
const DEFAULT_MAX_BG_WARMS = 4;

export type HardwareTier = "low" | "balanced" | "high";

export interface HardwareProbeInput {
  readonly deviceMemory?: number;
  readonly hardwareConcurrency?: number;
  readonly viewportWidth?: number;
  readonly isCoarsePointer?: boolean;
}

export interface AdaptiveCacheBudget {
  readonly tier: HardwareTier;
  readonly maxActiveBitmaps: number;
  readonly maxCachedBlobs: number;
  readonly lookahead: number;
  readonly lookbehind: number;
  readonly warmHeadCount: number;
  readonly maxConcurrentDecodes: number;
}

type NavigatorWithMemory = Navigator & { readonly deviceMemory?: number };

/**
 * Classifies client GPU/RAM capacity to size sliding-window ImageBitmap and
 * compressed Blob caches safely without triggering mobile/4GB RAM OOM pressure.
 */
export function detectAdaptiveCacheBudget(probe?: HardwareProbeInput): AdaptiveCacheBudget {
  const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithMemory) : undefined;
  const win = typeof window !== "undefined" ? window : undefined;

  const deviceMemory =
    probe?.deviceMemory ?? (typeof nav?.deviceMemory === "number" ? nav.deviceMemory : undefined);
  const hardwareConcurrency =
    probe?.hardwareConcurrency ??
    (typeof nav?.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined);
  const viewportWidth =
    probe?.viewportWidth ?? (typeof win?.innerWidth === "number" ? win.innerWidth : undefined);
  const isCoarsePointer =
    probe?.isCoarsePointer ??
    (typeof win?.matchMedia === "function" ? win.matchMedia("(pointer: coarse)").matches : false);

  const isLowRamOrMobile =
    (typeof deviceMemory === "number" && deviceMemory <= 4) ||
    isCoarsePointer ||
    (typeof viewportWidth === "number" && viewportWidth < 768) ||
    (deviceMemory === undefined && typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4);

  if (isLowRamOrMobile) {
    return {
      tier: "low",
      maxActiveBitmaps: 44,
      maxCachedBlobs: 360,
      lookahead: 30,
      lookbehind: 8,
      warmHeadCount: 16,
      maxConcurrentDecodes: 4,
    };
  }

  const isHighDesktop =
    typeof deviceMemory === "number" &&
    deviceMemory >= 8 &&
    (hardwareConcurrency === undefined || hardwareConcurrency >= 6);

  if (isHighDesktop) {
    return {
      tier: "high",
      maxActiveBitmaps: 96,
      maxCachedBlobs: 1100,
      lookahead: 64,
      lookbehind: 16,
      warmHeadCount: 24,
      maxConcurrentDecodes: Math.min(8, Math.max(6, hardwareConcurrency ?? 6)),
    };
  }

  return {
    tier: "balanced",
    maxActiveBitmaps: 68,
    maxCachedBlobs: 720,
    lookahead: 46,
    lookbehind: 12,
    warmHeadCount: 20,
    maxConcurrentDecodes: 6,
  };
}

export function makeFrameKey(sequence: SequenceType, index: number): string {
  return `${sequence}:${index}`;
}

export function parseFrameKey(key: string): { sequence: SequenceType; index: number } {
  const sep = key.indexOf(":");
  const sequence = key.slice(0, sep) as SequenceType;
  const index = Number(key.slice(sep + 1));
  return { sequence, index };
}

export function getFrameUrl(sequence: SequenceType, index: number, maxFrames: number): string {
  const clamped = Math.max(1, Math.min(maxFrames, Math.round(index)));
  if (sequence === "latihan") {
    const seg1 = LATIHAN_SEGMENT_COUNTS.latihan;
    const seg2 = seg1 + LATIHAN_SEGMENT_COUNTS.hallway;
    if (clamped <= seg1) {
      return `/latihan-frames/frame-${String(clamped).padStart(3, "0")}.webp`;
    }
    if (clamped <= seg2) {
      return `/hallway-frames/frame-${String(clamped - seg1).padStart(3, "0")}.webp`;
    }
    return `/studio-tulis-frames/frame-${String(clamped - seg2).padStart(3, "0")}.webp`;
  }
  const padded = String(clamped).padStart(3, "0");
  if (sequence === "hero") return `/hero-frames/frame-${padded}.webp`;
  if (sequence === "materi") return `/materi-frames/frame-${padded}.webp`;
  return `/reading-frames/frame-${padded}.webp`;
}

export interface PrewarmHeadTarget {
  readonly sequence: SequenceType;
  readonly count: number;
}

/**
 * Computes eviction penalty for a cached frame relative to current focus.
 * Higher score = evicted first.
 */
export function computeEvictionPenalty(
  candidateSeq: SequenceType,
  candidateIndex: number,
  focus: PlaybackFocus,
  prewarmHead?: PrewarmHeadTarget | ReadonlyArray<PrewarmHeadTarget> | null
): number {
  if (candidateSeq !== focus.sequence) {
    if (prewarmHead) {
      const targets = Array.isArray(prewarmHead) ? prewarmHead : [prewarmHead];
      for (const target of targets) {
        if (candidateSeq === target.sequence && candidateIndex <= target.count) {
          // Keep upcoming hub transition head frames hot inside cache alongside current hub end
          return 14 + candidateIndex;
        }
      }
    }
    return 10000 + candidateIndex;
  }
  const signedOffset = (candidateIndex - focus.centerFrame) * focus.direction;
  if (signedOffset >= 0) {
    // Frames directly ahead along travel path have lowest eviction penalty
    return signedOffset;
  }
  // Frames behind travel path keep a modest trailing buffer, then evict slightly faster than ahead
  return Math.abs(signedOffset) * 1.4 + 8;
}

function defaultDecodeBackend(): DecodeBackend<ImageBitmap> {
  return {
    async fetchBlob(url: string, priority: "high" | "low"): Promise<Blob> {
      const init: RequestInit & { fetchPriority?: "high" | "low" } = {
        priority,
        fetchPriority: priority,
      };
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} loading ${url}`);
      }
      return res.blob();
    },
    decodeBitmap(blob: Blob): Promise<ImageBitmap> {
      return createImageBitmap(blob, { premultiplyAlpha: "none" });
    },
    closeBitmap(bitmap: ImageBitmap): void {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
    },
  };
}

/**
 * Two-tier bounded frame asset manager:
 * - Tier 1 (GPU/Native): Sliding-window ImageBitmap cache capped at `maxActiveBitmaps`
 *   plus 6 pinned cross-stage boundary frames. Evicted bitmaps are immediately `.close()`d.
 * - Tier 2 (RAM): Bounded LRU cache of compressed WebP Blobs so bidirectional/reverse
 *   scrubbing re-decodes without re-fetching from the server.
 * - Priority Queue: Capped concurrency worker pool ordered dynamically by proximity
 *   to the live playhead, eliminating 100-300 request burst stampedes.
 */
export class FrameCacheManager<TBitmap = ImageBitmap> {
  private readonly config: Required<FrameCacheConfig>;
  private readonly backend: DecodeBackend<TBitmap>;

  private readonly pinnedKeys = new Set<string>();
  private readonly pinnedBitmaps = new Map<string, TBitmap>();
  private readonly bitmaps = new Map<string, TBitmap>();
  private readonly blobs = new Map<string, Blob>();

  private readonly pendingJobs = new Map<string, PendingJob<TBitmap>>();
  private readonly inFlightKeys = new Set<string>();
  private readonly inFlightBlobFetches = new Map<string, Promise<Blob>>();
  private readonly bgWarmQueue: Array<{ sequence: SequenceType; index: number; key: string }> = [];
  private readonly bgQueuedKeys = new Set<string>();
  private readonly bgInFlight = new Set<string>();

  private focus: PlaybackFocus = { sequence: "hero", centerFrame: 1, direction: 1 };
  private prewarmHeads: PrewarmHeadTarget[] = [];
  private lastDrawnKey: string | null = null;
  private isPlaybackActive = false;
  private destroyed = false;
  private activeWorkers = 0;
  private activeHttpFetches = 0;
  private bgWorkers = 0;
  private bgPumpTimer: ReturnType<typeof setTimeout> | null = null;
  private onFrameDecoded?: (sequence: SequenceType, index: number) => void;

  constructor(
    config: FrameCacheConfig,
    backend?: DecodeBackend<TBitmap>,
    onFrameDecoded?: (sequence: SequenceType, index: number) => void
  ) {
    const maxConcurrentDecodes = config.maxConcurrentDecodes ?? DEFAULT_MAX_CONCURRENT_DECODES;
    const maxConcurrentFetches = config.maxConcurrentFetches ?? maxConcurrentDecodes;
    this.config = {
      totalHeroFrames: config.totalHeroFrames,
      totalMateriFrames: config.totalMateriFrames,
      totalReadingFrames: config.totalReadingFrames,
      totalLatihanFrames: config.totalLatihanFrames ?? TOTAL_LATIHAN_FRAMES_DEFAULT,
      maxActiveBitmaps: config.maxActiveBitmaps ?? DEFAULT_MAX_ACTIVE_BITMAPS,
      maxCachedBlobs: config.maxCachedBlobs ?? DEFAULT_MAX_CACHED_BLOBS,
      maxConcurrentDecodes,
      maxConcurrentFetches,
      maxBackgroundWarms: config.maxBackgroundWarms ?? DEFAULT_MAX_BG_WARMS,
    };
    this.backend = (backend ?? defaultDecodeBackend()) as DecodeBackend<TBitmap>;
    this.onFrameDecoded = onFrameDecoded;

    // Pin boundary/bridge frames so transitions never suffer cold eviction
    this.pinnedKeys.add(makeFrameKey("hero", 1));
    this.pinnedKeys.add(makeFrameKey("hero", this.config.totalHeroFrames));
    this.pinnedKeys.add(makeFrameKey("materi", 1));
    this.pinnedKeys.add(makeFrameKey("materi", this.config.totalMateriFrames));
    this.pinnedKeys.add(makeFrameKey("reading", 1));
    this.pinnedKeys.add(makeFrameKey("reading", this.config.totalReadingFrames));
    this.pinnedKeys.add(makeFrameKey("latihan", 1));
    const seg1 = LATIHAN_SEGMENT_COUNTS.latihan;
    const seg2 = seg1 + LATIHAN_SEGMENT_COUNTS.hallway;
    if (this.config.totalLatihanFrames > seg1) {
      this.pinnedKeys.add(makeFrameKey("latihan", seg1));
      this.pinnedKeys.add(makeFrameKey("latihan", seg1 + 1));
    }
    if (this.config.totalLatihanFrames > seg2) {
      this.pinnedKeys.add(makeFrameKey("latihan", seg2));
      this.pinnedKeys.add(makeFrameKey("latihan", seg2 + 1));
    }
    this.pinnedKeys.add(makeFrameKey("latihan", this.config.totalLatihanFrames));
  }

  public getMaxFrames(sequence: SequenceType): number {
    if (sequence === "hero") return this.config.totalHeroFrames;
    if (sequence === "materi") return this.config.totalMateriFrames;
    if (sequence === "latihan") return this.config.totalLatihanFrames;
    return this.config.totalReadingFrames;
  }

  public setPlaybackActive(active: boolean): void {
    this.isPlaybackActive = active;
    if (!active || this.activeHttpFetches === 0) {
      this.scheduleBackgroundWarm();
    }
  }

  public setFocus(sequence: SequenceType, centerFrame: number, direction: 1 | -1): void {
    const clampedCenter = Math.max(1, Math.min(this.getMaxFrames(sequence), Math.round(centerFrame)));
    this.focus = {
      sequence,
      centerFrame: clampedCenter,
      direction,
    };

    if (this.prewarmHeads.length > 0) {
      if (
        this.prewarmHeads.some((t) => t.sequence === sequence) ||
        clampedCenter < this.getMaxFrames(sequence) - 25
      ) {
        this.prewarmHeads = [];
      }
    }
  }

  public setLastDrawn(sequence: SequenceType, index: number): void {
    this.lastDrawnKey = makeFrameKey(sequence, index);
  }

  public getBitmap(sequence: SequenceType, index: number): TBitmap | null {
    const key = makeFrameKey(sequence, index);
    return this.pinnedBitmaps.get(key) ?? this.bitmaps.get(key) ?? null;
  }

  public hasBitmap(sequence: SequenceType, index: number): boolean {
    const key = makeFrameKey(sequence, index);
    return this.pinnedBitmaps.has(key) || this.bitmaps.has(key);
  }

  public getActiveBitmapCount(): number {
    return this.bitmaps.size;
  }

  public getPinnedBitmapCount(): number {
    return this.pinnedBitmaps.size;
  }

  public getBlobCount(): number {
    return this.blobs.size;
  }

  public countContiguousReady(
    sequence: SequenceType,
    startFrame: number,
    direction: 1 | -1,
    maxCheck: number
  ): number {
    const maxFrames = this.getMaxFrames(sequence);
    const start = Math.max(1, Math.min(maxFrames, Math.round(startFrame)));
    let ready = 0;
    for (let i = 0; i < maxCheck; i++) {
      const idx = start + i * direction;
      if (idx < 1 || idx > maxFrames) break;
      if (!this.hasBitmap(sequence, idx)) break;
      ready++;
    }
    return ready;
  }

  public isFrameBusy(sequence: SequenceType, index: number): boolean {
    const key = makeFrameKey(sequence, index);
    return this.pendingJobs.has(key) || this.inFlightKeys.has(key);
  }

  /**
   * Finds the best ready bitmap with cross-sequence bridge continuity and direction-aware fallback
   * so out-of-order parallel decodes never flash future frames ahead of the playhead.
   */
  public getBestBitmap(
    sequence: SequenceType,
    targetIndex: number,
    direction: 1 | -1 = 1
  ): TBitmap | null {
    const clamped = Math.max(1, Math.min(this.getMaxFrames(sequence), Math.round(targetIndex)));
    const direct = this.getBitmap(sequence, clamped);
    if (direct) return direct;

    // Seamless cross-stage bridge fallbacks
    if (sequence === "reading" && clamped <= 5) {
      const bridge = this.getBitmap("materi", this.config.totalMateriFrames);
      if (bridge) return bridge;
    }
    if ((sequence === "materi" || sequence === "latihan") && clamped <= 5) {
      const bridge = this.getBitmap("hero", this.config.totalHeroFrames);
      if (bridge) return bridge;
    }
    if (sequence === "materi" && clamped >= this.config.totalMateriFrames - 5) {
      const bridge = this.getBitmap("reading", 1);
      if (bridge) return bridge;
    }
    if (sequence === "hero" && clamped >= this.config.totalHeroFrames - 5) {
      const bridge = this.getBitmap("materi", 1) ?? this.getBitmap("latihan", 1);
      if (bridge) return bridge;
    }

    const maxFrames = this.getMaxFrames(sequence);
    const radius = Math.min(30, maxFrames);
    const trailingStep = direction >= 0 ? -1 : 1;

    // Search strictly in the already-traversed trailing direction first to avoid ping-pong flicker
    for (let offset = 1; offset <= radius; offset++) {
      const trailingIdx = clamped + offset * trailingStep;
      if (trailingIdx >= 1 && trailingIdx <= maxFrames) {
        const b = this.getBitmap(sequence, trailingIdx);
        if (b) return b;
      }
    }

    // Fall back to ahead frames only when no trailing frame exists in cache
    for (let offset = 1; offset <= radius; offset++) {
      const aheadIdx = clamped - offset * trailingStep;
      if (aheadIdx >= 1 && aheadIdx <= maxFrames) {
        const b = this.getBitmap(sequence, aheadIdx);
        if (b) return b;
      }
    }

    return this.getBitmap(sequence, 1);
  }

  /**
   * Queues a single frame load through the bounded worker pool.
   */
  public loadFrame(
    sequence: SequenceType,
    index: number,
    urgent: boolean = false
  ): Promise<TBitmap | null> {
    if (this.destroyed) return Promise.resolve(null);

    const maxFrames = this.getMaxFrames(sequence);
    const clamped = Math.max(1, Math.min(maxFrames, Math.round(index)));
    const existing = this.getBitmap(sequence, clamped);
    if (existing) return Promise.resolve(existing);

    const key = makeFrameKey(sequence, clamped);
    const pending = this.pendingJobs.get(key);
    if (pending) {
      if (urgent) pending.urgent = true;
      return new Promise((resolve) => {
        pending.resolveList.push(resolve);
      });
    }

    return new Promise((resolve) => {
      this.pendingJobs.set(key, {
        key,
        sequence,
        index: clamped,
        urgent,
        resolveList: [resolve],
      });
      this.pumpWorkers();
    });
  }

  /**
   * Refreshes the active sliding decode window around `centerFrame` and cancels stale out-of-window jobs.
   */
  public requestWindow(
    sequence: SequenceType,
    centerFrame: number,
    direction: 1 | -1,
    lookahead: number = 48,
    lookbehind: number = 14
  ): void {
    if (this.destroyed) return;

    this.setFocus(sequence, centerFrame, direction);
    const maxFrames = this.getMaxFrames(sequence);
    const clampedCenter = this.focus.centerFrame;

    // Build active desired keys inside sliding window
    const desiredKeys = new Set<string>();
    const orderedTargets: Array<{ index: number; urgent: boolean }> = [];

    orderedTargets.push({ index: clampedCenter, urgent: true });
    desiredKeys.add(makeFrameKey(sequence, clampedCenter));

    for (let i = 1; i <= lookahead; i++) {
      const idx = clampedCenter + i * direction;
      if (idx >= 1 && idx <= maxFrames) {
        orderedTargets.push({ index: idx, urgent: i <= 6 });
        desiredKeys.add(makeFrameKey(sequence, idx));
      }
    }

    for (let i = 1; i <= lookbehind; i++) {
      const idx = clampedCenter - i * direction;
      if (idx >= 1 && idx <= maxFrames) {
        orderedTargets.push({ index: idx, urgent: false });
        desiredKeys.add(makeFrameKey(sequence, idx));
      }
    }

    // Prune unstarted non-pinned jobs far outside the new window so playhead moves aren't starved
    for (const [key, job] of this.pendingJobs.entries()) {
      if (
        !this.inFlightKeys.has(key) &&
        !this.pinnedKeys.has(key) &&
        !desiredKeys.has(key) &&
        !job.urgent
      ) {
        this.pendingJobs.delete(key);
        for (const r of job.resolveList) r(null);
      }
    }

    for (const target of orderedTargets) {
      if (!this.hasBitmap(sequence, target.index)) {
        void this.loadFrame(sequence, target.index, target.urgent);
      }
    }
  }

  /**
   * Queues background Blob-only warming (zero VRAM impact until scrolled near).
   */
  public queueBlobWarmup(sequence: SequenceType, startFrame: number, endFrame: number, step: number = 1): void {
    if (this.destroyed) return;
    const maxFrames = this.getMaxFrames(sequence);
    const from = Math.max(1, startFrame);
    const to = Math.min(maxFrames, endFrame);

    for (let i = from; i <= to; i += Math.max(1, step)) {
      const key = makeFrameKey(sequence, i);
      if (!this.blobs.has(key) && !this.hasBitmap(sequence, i) && !this.bgQueuedKeys.has(key) && !this.bgInFlight.has(key)) {
        this.bgQueuedKeys.add(key);
        this.bgWarmQueue.push({ sequence, index: i, key });
      }
    }

    this.scheduleBackgroundWarm();
  }

  /**
   * Moves any pending background Blob warmup items for `sequence` to the front of the queue.
   */
  public reprioritizeBlobWarmup(sequence: SequenceType): void {
    if (this.destroyed || this.bgWarmQueue.length <= 1) return;
    const prioritized: Array<{ sequence: SequenceType; index: number; key: string }> = [];
    const others: Array<{ sequence: SequenceType; index: number; key: string }> = [];
    for (const item of this.bgWarmQueue) {
      if (item.sequence === sequence) {
        prioritized.push(item);
      } else {
        others.push(item);
      }
    }
    if (prioritized.length === 0) return;
    this.bgWarmQueue.length = 0;
    this.bgWarmQueue.push(...prioritized, ...others);
    this.scheduleBackgroundWarm();
  }

  /**
   * Gently pre-decodes the first N frames of an upcoming sequence while paused at a hub.
   */
  public warmSequenceHead(sequence: SequenceType, count: number = 40, append: boolean = false): void {
    if (this.destroyed) return;
    const limit = Math.min(this.getMaxFrames(sequence), count);
    // Keep active sequence window intact by capping head warmup comfortably under maxActiveBitmaps
    const safeHeadCount = Math.min(limit, Math.max(12, Math.floor(this.config.maxActiveBitmaps * 0.45)));
    const nextTarget: PrewarmHeadTarget = { sequence, count: safeHeadCount };
    if (append) {
      this.prewarmHeads = [
        ...this.prewarmHeads.filter((t) => t.sequence !== sequence),
        nextTarget,
      ];
    } else {
      this.prewarmHeads = [nextTarget];
    }
    for (let i = 1; i <= safeHeadCount; i++) {
      if (!this.hasBitmap(sequence, i)) {
        void this.loadFrame(sequence, i, false);
      }
    }
    this.reprioritizeBlobWarmup(sequence);
    if (limit > safeHeadCount) {
      this.queueBlobWarmup(sequence, safeHeadCount + 1, limit, 1);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.bgPumpTimer !== null) {
      clearTimeout(this.bgPumpTimer);
      this.bgPumpTimer = null;
    }

    for (const job of this.pendingJobs.values()) {
      for (const resolve of job.resolveList) resolve(null);
    }
    this.pendingJobs.clear();
    this.inFlightBlobFetches.clear();
    this.bgWarmQueue.length = 0;
    this.bgQueuedKeys.clear();

    for (const bitmap of this.pinnedBitmaps.values()) {
      this.safeClose(bitmap);
    }
    this.pinnedBitmaps.clear();

    for (const bitmap of this.bitmaps.values()) {
      this.safeClose(bitmap);
    }
    this.bitmaps.clear();
    this.blobs.clear();
  }

  private safeClose(bitmap: TBitmap): void {
    try {
      this.backend.closeBitmap(bitmap);
    } catch (err) {
      void err;
    }
  }

  private storeBlob(key: string, blob: Blob): void {
    if (this.blobs.has(key)) {
      // Refresh LRU recency
      this.blobs.delete(key);
      this.blobs.set(key, blob);
      return;
    }

    this.blobs.set(key, blob);
    while (this.blobs.size > this.config.maxCachedBlobs) {
      const oldestKey = this.blobs.keys().next().value;
      if (oldestKey === undefined) break;
      this.blobs.delete(oldestKey);
    }
  }

  private getBlob(key: string): Blob | undefined {
    const existing = this.blobs.get(key);
    if (existing) {
      this.blobs.delete(key);
      this.blobs.set(key, existing);
    }
    return existing;
  }

  private storeBitmap(sequence: SequenceType, index: number, bitmap: TBitmap): boolean {
    const key = makeFrameKey(sequence, index);

    if (this.pinnedKeys.has(key)) {
      const prev = this.pinnedBitmaps.get(key);
      if (prev && prev !== bitmap) this.safeClose(prev);
      this.pinnedBitmaps.set(key, bitmap);
      return true;
    }

    // If an in-flight decode finished well after user jumped elsewhere, drop stale bitmap cleanly
    if (
      this.bitmaps.size >= this.config.maxActiveBitmaps &&
      computeEvictionPenalty(sequence, index, this.focus, this.prewarmHeads) > 75 &&
      key !== this.lastDrawnKey
    ) {
      this.safeClose(bitmap);
      return false;
    }

    const existing = this.bitmaps.get(key);
    if (existing && existing !== bitmap) {
      this.safeClose(existing);
    }
    this.bitmaps.set(key, bitmap);

    this.evictExcessBitmaps();
    return this.bitmaps.has(key);
  }

  private evictExcessBitmaps(): void {
    while (this.bitmaps.size > this.config.maxActiveBitmaps) {
      let worstKey: string | null = null;
      let worstPenalty = -1;

      for (const candidateKey of this.bitmaps.keys()) {
        if (candidateKey === this.lastDrawnKey || this.pinnedKeys.has(candidateKey)) {
          continue;
        }
        const parsed = parseFrameKey(candidateKey);
        const penalty = computeEvictionPenalty(parsed.sequence, parsed.index, this.focus, this.prewarmHeads);
        if (penalty > worstPenalty) {
          worstPenalty = penalty;
          worstKey = candidateKey;
        }
      }

      if (!worstKey) break;
      const victim = this.bitmaps.get(worstKey);
      this.bitmaps.delete(worstKey);
      if (victim) {
        this.safeClose(victim);
      }
    }
  }

  private pickNextJob(): PendingJob<TBitmap> | null {
    let bestJob: PendingJob<TBitmap> | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const job of this.pendingJobs.values()) {
      if (this.inFlightKeys.has(job.key)) continue;

      let score = computeEvictionPenalty(job.sequence, job.index, this.focus, this.prewarmHeads);
      if (job.urgent) score -= 500;
      if (this.pinnedKeys.has(job.key)) score -= 250;

      if (score < bestScore) {
        bestScore = score;
        bestJob = job;
      }
    }

    return bestJob;
  }

  private pumpWorkers(): void {
    while (!this.destroyed && this.activeWorkers < this.config.maxConcurrentDecodes) {
      const job = this.pickNextJob();
      if (!job) break;

      this.inFlightKeys.add(job.key);
      this.activeWorkers++;
      void this.runJob(job);
    }

    if (this.canRunBackgroundWarm()) {
      this.scheduleBackgroundWarm();
    }
  }

  private fetchBlobShared(
    sequence: SequenceType,
    index: number,
    key: string,
    priority: "high" | "low",
    trackAsActiveHttp: boolean
  ): Promise<Blob> {
    const cached = this.getBlob(key);
    if (cached) return Promise.resolve(cached);

    const existingFetch = this.inFlightBlobFetches.get(key);
    if (existingFetch) return existingFetch;

    const url = getFrameUrl(sequence, index, this.getMaxFrames(sequence));
    if (trackAsActiveHttp) {
      this.activeHttpFetches++;
    }

    const fetchPromise = this.backend
      .fetchBlob(url, priority)
      .then((blob) => {
        if (!this.destroyed) {
          this.storeBlob(key, blob);
        }
        return blob;
      })
      .finally(() => {
        this.inFlightBlobFetches.delete(key);
        if (trackAsActiveHttp) {
          this.activeHttpFetches = Math.max(0, this.activeHttpFetches - 1);
          if (this.canRunBackgroundWarm()) {
            this.scheduleBackgroundWarm();
          }
        }
      });

    this.inFlightBlobFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  private async runJob(job: PendingJob<TBitmap>): Promise<void> {
    let resolvedBitmap: TBitmap | null = null;

    try {
      const blob = await this.fetchBlobShared(
        job.sequence,
        job.index,
        job.key,
        job.urgent ? "high" : "low",
        true
      );

      if (!this.destroyed) {
        const decoded = await this.backend.decodeBitmap(blob);
        if (this.destroyed) {
          this.safeClose(decoded);
        } else {
          const kept = this.storeBitmap(job.sequence, job.index, decoded);
          resolvedBitmap = kept ? decoded : null;
          if (kept) {
            this.onFrameDecoded?.(job.sequence, job.index);
          }
        }
      }
    } catch {
      resolvedBitmap = null;
    } finally {
      this.inFlightKeys.delete(job.key);
      this.pendingJobs.delete(job.key);
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);

      for (const resolve of job.resolveList) {
        resolve(resolvedBitmap);
      }

      if (!this.destroyed) {
        this.pumpWorkers();
      }
    }
  }

  private getActiveBgLimit(): number {
    const cap = Math.min(this.config.maxBackgroundWarms, this.config.maxConcurrentFetches);
    return this.isPlaybackActive ? Math.min(2, cap) : cap;
  }

  private canRunBackgroundWarm(): boolean {
    if (this.destroyed || this.activeHttpFetches > 0 || this.bgWarmQueue.length === 0) {
      return false;
    }
    return this.bgWorkers < this.getActiveBgLimit();
  }

  private scheduleBackgroundWarm(): void {
    if (this.bgPumpTimer !== null || !this.canRunBackgroundWarm()) return;

    this.bgPumpTimer = setTimeout(() => {
      this.bgPumpTimer = null;
      this.pumpBackgroundWarms();
    }, 2);
  }

  private pumpBackgroundWarms(): void {
    const bgLimit = this.getActiveBgLimit();
    while (
      !this.destroyed &&
      this.activeHttpFetches === 0 &&
      this.bgWorkers < bgLimit &&
      this.bgWarmQueue.length > 0
    ) {
      const next = this.bgWarmQueue.shift();
      if (!next) break;
      this.bgQueuedKeys.delete(next.key);
      if (this.blobs.has(next.key) || this.inFlightBlobFetches.has(next.key) || this.bgInFlight.has(next.key)) {
        continue;
      }

      this.bgInFlight.add(next.key);
      this.bgWorkers++;
      void this.runBackgroundWarm(next.sequence, next.index, next.key);
    }
  }

  private async runBackgroundWarm(sequence: SequenceType, index: number, key: string): Promise<void> {
    try {
      await this.fetchBlobShared(sequence, index, key, "low", false);
    } catch (err) {
      // Non-critical background prefetch; active loader retries on demand
      void err;
    } finally {
      this.bgInFlight.delete(key);
      this.bgWorkers = Math.max(0, this.bgWorkers - 1);
      if (this.canRunBackgroundWarm()) {
        this.scheduleBackgroundWarm();
      }
    }
  }
}
