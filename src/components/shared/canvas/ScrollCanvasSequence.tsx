"use client";

import { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLenis } from "@/components/shared/providers/SmoothScrollProvider";
import {
  computeCoverStageMetrics,
  computeMobile3dCameraTransform,
  type Mobile3dCameraTarget,
} from "@/lib/ui/bookHomography";
import {
  type SequenceType,
  easeSmoothCruise,
  scrollYToFrame,
  frameToScrollY,
  computeHeroExitProgress,
} from "./sequenceEasing";
import {
  FrameCacheManager,
  LATIHAN_SEGMENT_COUNTS,
  TOTAL_LATIHAN_FRAMES_DEFAULT,
  detectAdaptiveCacheBudget,
  type AdaptiveCacheBudget,
} from "./frameCacheManager";
import { SEQUENCE_PACK_CHUNKS } from "./sequencePacksManifest";

export type { SequenceType };

export interface DiscreteSequenceState {
  readonly activeSequence: SequenceType;
  readonly activeAutoplayTarget: SequenceType | null;
  readonly heroStep: 1 | 2 | 3;
  readonly isHeroContentVisible: boolean;
  readonly isHeroInteractive: boolean;
  readonly isHeroAtEnd: boolean;
  readonly isMateriAtEnd: boolean;
  readonly isReadingAtEnd: boolean;
  readonly isLatihanAtEnd: boolean;
  readonly isScrolledPastStart: boolean;
}

export interface AutoplayOptions {
  readonly startFrame?: number;
  readonly durationMs: number;
  readonly interruptible?: boolean;
  readonly syncScrollOnComplete?: boolean;
  readonly onComplete?: () => void;
}

export interface ScrollCanvasController {
  playTo: (sequence: SequenceType, targetFrame: number, options: AutoplayOptions) => void;
  snapTo: (sequence: SequenceType, frame: number, suppressScrollSync?: boolean) => void;
  prepareFrame: (sequence: SequenceType, frame: number) => Promise<boolean>;
  releaseScrollSync: (syncScrollY?: number) => void;
  cancelAutoplay: (keepScrollLocked?: boolean) => void;
  getCurrentFrame: (sequence: SequenceType) => number;
  getScrollableHeight: (sequence: SequenceType) => number;
}

function hasScrollableAncestor(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.documentElement && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScrollY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight;
    const canScrollX =
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth;
    if (canScrollY || canScrollX) return true;
    node = node.parentElement;
  }
  return false;
}

interface ScrollCanvasSequenceProps {
  readonly isMateriUnlocked?: boolean;
  readonly isReadingUnlocked?: boolean;
  readonly isLatihanUnlocked?: boolean;
  readonly isReverseScrolling?: boolean;
  readonly isStudioBookFocused?: boolean;
  readonly isScrollLocked?: boolean;
  readonly mobile3dCameraTarget?: Mobile3dCameraTarget;
  readonly containerRef: React.RefObject<HTMLElement | null>;
  readonly materiContainerRef?: React.RefObject<HTMLElement | null>;
  readonly readingContainerRef?: React.RefObject<HTMLElement | null>;
  readonly latihanContainerRef?: React.RefObject<HTMLElement | null>;
  readonly heroOverlayRef?: React.RefObject<HTMLDivElement | null>;
  readonly controllerRef?: React.RefObject<ScrollCanvasController | null>;
  readonly heroMaxFrame?: number;
  readonly totalHeroFrames?: number;
  readonly totalMateriFrames?: number;
  readonly totalReadingFrames?: number;
  readonly totalLatihanFrames?: number;
  readonly onDiscreteStateChange?: (state: DiscreteSequenceState) => void;
}

type VideoClipKey =
  | "hero"
  | "hero-rev"
  | "materi"
  | "materi-rev"
  | "reading"
  | "reading-rev"
  | "latihan";

interface ActiveAutoplay {
  mode: "canvas" | "video";
  sequence: SequenceType;
  startFrame: number;
  targetFrame: number;
  startTime: number;
  startedAtMs: number;
  durationMs: number;
  primingStartTime: number | null;
  primeTargetCount: number;
  maxPrimeWaitMs: number;
  lastClockTime: number;
  stalledFrame: number;
  currentFrameStallMs: number;
  totalStallMs: number;
  videoSessionId: number;
  videoStartedAt: number;
  videoDirection: 1 | -1;
  videoClipKey: VideoClipKey | null;
  videoStartTimeSec: number;
  videoTargetTimeSec: number;
  videoSeekReady: boolean;
  videoHasPaintedFrame: boolean;
  videoLastTime: number;
  videoLastProgressAt: number;
  videoFallbackTriggered: boolean;
  interruptible: boolean;
  syncScrollOnComplete: boolean;
  onComplete?: () => void;
}

const SEQUENCE_VIDEO_URLS: Readonly<Record<VideoClipKey, string>> = {
  hero: "/seq-videos/hero.mp4",
  "hero-rev": "/seq-videos/hero-rev.mp4",
  materi: "/seq-videos/materi.mp4",
  "materi-rev": "/seq-videos/materi-rev.mp4",
  reading: "/seq-videos/reading.mp4",
  "reading-rev": "/seq-videos/reading-rev.mp4",
  latihan: "/seq-videos/latihan.mp4",
};
const SEQUENCE_VIDEO_FPS = 60;

function resolveVideoClipKey(sequence: SequenceType, direction: 1 | -1): VideoClipKey | null {
  if (direction === 1) return sequence;
  if (sequence === "hero") return "hero-rev";
  if (sequence === "materi") return "materi-rev";
  if (sequence === "reading") return "reading-rev";
  return null;
}

const TOTAL_HERO_FRAMES_DEFAULT = 240;
const TOTAL_MATERI_FRAMES_DEFAULT = 299;
const TOTAL_READING_FRAMES_DEFAULT = 537;

// Frame-rate normalized smoothing factors: crisp Lenis lock for small deltas, fluid glide on scrollbar jumps
const MANUAL_LERP_LENIS_LOCK_60HZ = 0.78;
const MANUAL_LERP_SCRUB_JUMP_60HZ = 0.48;
const HERO_EXIT_START_FRAME = 20;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

function getRuntimeLookahead(budget: AdaptiveCacheBudget): number {
  if (budget.tier === "low") return 48;
  if (budget.tier === "balanced") return 60;
  return 72;
}

function getRuntimeWarmBlocks(
  cache: FrameCacheManager<ImageBitmap>,
  totalMateriFrames: number,
  totalLatihanFrames: number,
  stride: number
): void {
  const blockSize = 48;
  const maxTotal = Math.max(totalMateriFrames, totalLatihanFrames);
  for (let start = 1; start <= maxTotal; start += blockSize) {
    if (start <= totalMateriFrames) {
      cache.queueBlobWarmup(
        "materi",
        start,
        Math.min(totalMateriFrames, start + blockSize - 1),
        stride
      );
    }
    if (start <= totalLatihanFrames) {
      cache.queueBlobWarmup(
        "latihan",
        start,
        Math.min(totalLatihanFrames, start + blockSize - 1),
        stride
      );
    }
  }
}

export const ScrollCanvasSequence = memo(function ScrollCanvasSequence({
  isMateriUnlocked = false,
  isReadingUnlocked = false,
  isLatihanUnlocked = false,
  isReverseScrolling = false,
  isStudioBookFocused = false,
  isScrollLocked = isStudioBookFocused,
  mobile3dCameraTarget = "none",
  containerRef,
  materiContainerRef,
  readingContainerRef,
  latihanContainerRef,
  heroOverlayRef,
  controllerRef,
  heroMaxFrame = 50,
  totalHeroFrames = TOTAL_HERO_FRAMES_DEFAULT,
  totalMateriFrames = TOTAL_MATERI_FRAMES_DEFAULT,
  totalReadingFrames = TOTAL_READING_FRAMES_DEFAULT,
  totalLatihanFrames = TOTAL_LATIHAN_FRAMES_DEFAULT,
  onDiscreteStateChange,
}: ScrollCanvasSequenceProps) {
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    readonly width: number;
    readonly height: number;
  }>({ width: 1280, height: 800 });
  const onDiscreteStateChangeRef = useRef(onDiscreteStateChange);
  useEffect(() => {
    onDiscreteStateChangeRef.current = onDiscreteStateChange;
  }, [onDiscreteStateChange]);

  const heroOverlayRefHolder = useRef(heroOverlayRef);
  useEffect(() => {
    heroOverlayRefHolder.current = heroOverlayRef;
  }, [heroOverlayRef]);

  const activeSequenceRef = useRef<SequenceType>("hero");
  const isMateriUnlockedRef = useRef(isMateriUnlocked);
  const isReadingUnlockedRef = useRef(isReadingUnlocked);
  const isLatihanUnlockedRef = useRef(isLatihanUnlocked);
  const isReverseScrollingRef = useRef(isReverseScrolling);
  const isScrollLockedRef = useRef(isScrollLocked);
  const wasScrollLockedRef = useRef(false);
  useEffect(() => {
    isMateriUnlockedRef.current = isMateriUnlocked;
    isReadingUnlockedRef.current = isReadingUnlocked;
    isLatihanUnlockedRef.current = isLatihanUnlocked;
    isReverseScrollingRef.current = isReverseScrolling;
    isScrollLockedRef.current = isScrollLocked;
  }, [isMateriUnlocked, isReadingUnlocked, isLatihanUnlocked, isReverseScrolling, isScrollLocked]);

  const currentFramesRef = useRef<Record<SequenceType, number>>({
    hero: 1,
    materi: 1,
    reading: 1,
    latihan: 1,
  });
  const targetFramesRef = useRef<Record<SequenceType, number>>({
    hero: 1,
    materi: 1,
    reading: 1,
    latihan: 1,
  });

  // Cached DOM scroll heights — updated strictly outside renderLoop (resize/stage switch)
  const scrollableHeightsRef = useRef<Record<SequenceType, number>>({
    hero: 1,
    materi: 1,
    reading: 1,
    latihan: 1,
  });
  const viewportHeightRef = useRef<number>(900);

  const drawBoundsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: SOURCE_WIDTH,
    height: SOURCE_HEIGHT,
  });

  const lastDrawnSeqRef = useRef<SequenceType | null>(null);
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastDrawnBitmapRef = useRef<ImageBitmap | null>(null);
  const lastDrawWasExactRef = useRef<boolean>(false);
  const lastDisplayedSourceSeqRef = useRef<SequenceType | null>(null);
  const lastDisplayedSourceFrameRef = useRef<number>(-1);
  const lastWindowCenterRef = useRef<number>(-1);
  const lastWindowSeqRef = useRef<SequenceType | null>(null);
  const scrollDirectionRef = useRef<1 | -1>(1);
  const lastScrollYRef = useRef<number>(0);

  const autoplayRef = useRef<ActiveAutoplay | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoSessionIdRef = useRef<number>(0);
  const isVideoActiveRef = useRef<boolean>(false);
  const videoBlobUrlsRef = useRef<Map<VideoClipKey, string>>(new Map());
  const videoPrefetchQueueRef = useRef<VideoClipKey[]>([]);
  const videoPrefetchInFlightRef = useRef<VideoClipKey | null>(null);
  const videoPrefetchAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastViewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const pendingResizeAfterAutoplayRef = useRef<boolean>(false);
  const suppressScrollReadRef = useRef<boolean>(false);
  const lastHeroExitWrittenRef = useRef<string>("");
  const lastDiscreteRef = useRef<DiscreteSequenceState | null>(null);
  const prefersReducedMotionRef = useRef<boolean>(false);

  const rafIdRef = useRef<number | null>(null);
  const prevTickTimeRef = useRef<number>(0);
  const cacheManagerRef = useRef<FrameCacheManager<ImageBitmap> | null>(null);
  const cacheBudgetRef = useRef<AdaptiveCacheBudget>(detectAdaptiveCacheBudget());
  const warmupTriggeredRef = useRef<{
    heroToMateri: boolean;
    materiToReading: boolean;
    readingPageFlip: boolean;
  }>({
    heroToMateri: false,
    materiToReading: false,
    readingPageFlip: false,
  });

  const [isFirstFrameReady, setIsFirstFrameReady] = useState<boolean>(false);
  const [isVideoVisible, setIsVideoVisible] = useState<boolean>(false);

  const drainVideoPrefetchRef = useRef<() => void>(() => {});

  const queueVideoPrefetch = useCallback((clips: readonly VideoClipKey[]) => {
    if (cacheBudgetRef.current.isConstrainedNetwork) return;
    const queue = videoPrefetchQueueRef.current;
    for (const clip of clips) {
      if (
        videoBlobUrlsRef.current.has(clip) ||
        videoPrefetchInFlightRef.current === clip ||
        queue.includes(clip)
      ) {
        continue;
      }
      queue.push(clip);
    }
    drainVideoPrefetchRef.current();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const drainVideoPrefetch = () => {
      if (
        !isMountedRef.current ||
        videoPrefetchInFlightRef.current !== null ||
        autoplayRef.current !== null ||
        isVideoActiveRef.current
      ) {
        return;
      }

      const nextClip = videoPrefetchQueueRef.current.shift();
      if (!nextClip) return;
      if (videoBlobUrlsRef.current.has(nextClip)) {
        drainVideoPrefetch();
        return;
      }

      videoPrefetchInFlightRef.current = nextClip;
      const controller = new AbortController();
      videoPrefetchAbortRef.current = controller;

      void fetch(SEQUENCE_VIDEO_URLS[nextClip], {
        signal: controller.signal,
        cache: "force-cache",
      })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (!blob || !isMountedRef.current) return;
          const objectUrl = URL.createObjectURL(blob);
          videoBlobUrlsRef.current.set(nextClip, objectUrl);

          // If this clip is the primary next clip and <video> is idle, prime decoder from RAM immediately
          const videoEl = videoRef.current;
          if (
            videoEl &&
            !isVideoActiveRef.current &&
            autoplayRef.current === null &&
            ((nextClip === "hero" && activeSequenceRef.current === "hero" && currentFramesRef.current.hero < 10) ||
              (nextClip === "reading" && activeSequenceRef.current === "materi") ||
              (nextClip === "materi" && activeSequenceRef.current === "hero" && currentFramesRef.current.hero >= totalHeroFrames - 2))
          ) {
            videoEl.setAttribute("data-clip", nextClip);
            videoEl.preload = "auto";
            videoEl.src = objectUrl;
            videoEl.load();
          }

          // On mobile, only start hero WebP chunk warmup AFTER hero.mp4 is safely cached in RAM
          if (
            nextClip === "hero" &&
            cacheBudgetRef.current.tier === "low" &&
            cacheManagerRef.current
          ) {
            cacheManagerRef.current.queueBlobWarmup("hero", 1, totalHeroFrames, 1);
          }
        })
        .catch(() => {
          // Non-fatal prefetch abort/network error — direct CDN URL fallback remains active
        })
        .finally(() => {
          if (videoPrefetchAbortRef.current === controller) {
            videoPrefetchAbortRef.current = null;
          }
          if (videoPrefetchInFlightRef.current === nextClip) {
            videoPrefetchInFlightRef.current = null;
          }
          if (isMountedRef.current) {
            drainVideoPrefetch();
          }
        });
    };

    drainVideoPrefetchRef.current = drainVideoPrefetch;
    const blobMap = videoBlobUrlsRef.current;
    const prefetchQueue = videoPrefetchQueueRef.current;

    return () => {
      isMountedRef.current = false;
      videoPrefetchAbortRef.current?.abort();
      videoPrefetchAbortRef.current = null;
      videoPrefetchInFlightRef.current = null;
      prefetchQueue.length = 0;
      for (const url of blobMap.values()) {
        URL.revokeObjectURL(url);
      }
      blobMap.clear();
    };
  }, [totalHeroFrames]);

  const stopHardwareVideo = useCallback(() => {
    videoSessionIdRef.current++;
    isVideoActiveRef.current = false;
    setIsVideoVisible(false);
    const video = videoRef.current;
    if (video && !video.paused) {
      try {
        video.pause();
      } catch {
        // Ignore media teardown interruptions
      }
    }
  }, []);

  const getMaxFrames = useCallback(
    (seq: SequenceType): number => {
      if (seq === "hero") return totalHeroFrames;
      if (seq === "materi") return totalMateriFrames;
      if (seq === "latihan") return totalLatihanFrames;
      return totalReadingFrames;
    },
    [totalHeroFrames, totalMateriFrames, totalReadingFrames, totalLatihanFrames]
  );

  const measureScrollableHeights = useCallback(() => {
    const vh = Math.max(1, window.innerHeight || 900);
    viewportHeightRef.current = vh;
    const docMaxScroll = Math.max(1, document.documentElement.scrollHeight - vh);

    const clampActiveTrack = (el: HTMLElement | null | undefined, fallbackMult: number) => {
      if (!el || el.offsetHeight <= 0) return Math.round(vh * fallbackMult);
      const raw = Math.max(1, el.offsetHeight - vh);
      return Math.min(raw, docMaxScroll);
    };

    scrollableHeightsRef.current.hero = clampActiveTrack(containerRef.current, 2.0);
    scrollableHeightsRef.current.materi = clampActiveTrack(materiContainerRef?.current, 2.2);
    scrollableHeightsRef.current.reading = clampActiveTrack(readingContainerRef?.current, 3.4);
    scrollableHeightsRef.current.latihan = clampActiveTrack(latihanContainerRef?.current, 3.6);
  }, [containerRef, materiContainerRef, readingContainerRef, latihanContainerRef]);

  const drawFrame = useCallback((seq: SequenceType, rawFrame: number) => {
    const cache = cacheManagerRef.current;
    const ctx = ctxRef.current;
    if (!cache || !ctx) return;

    const frame = Math.max(1, Math.min(cache.getMaxFrames(seq), Math.round(rawFrame)));
    const best = cache.getBestBitmapWithFrame(seq, frame, scrollDirectionRef.current);
    if (!best) return;

    const sameSequence = lastDisplayedSourceSeqRef.current === seq;
    const dir = scrollDirectionRef.current;
    const isMonotonicRegression =
      !best.exact &&
      sameSequence &&
      lastDrawnBitmapRef.current !== null &&
      lastDisplayedSourceFrameRef.current > 0 &&
      ((dir >= 0 && best.frame < lastDisplayedSourceFrameRef.current) ||
        (dir < 0 && best.frame > lastDisplayedSourceFrameRef.current));

    if (!isMonotonicRegression) {
      if (best.bitmap !== lastDrawnBitmapRef.current) {
        const bounds = drawBoundsRef.current;
        ctx.drawImage(best.bitmap, bounds.x, bounds.y, bounds.width, bounds.height);
        lastDrawnBitmapRef.current = best.bitmap;
      }
      lastDisplayedSourceSeqRef.current = seq;
      lastDisplayedSourceFrameRef.current = best.frame;
    }

    cache.setLastDrawn(seq, frame);
    lastDrawnSeqRef.current = seq;
    lastDrawnFrameRef.current = frame;
    lastDrawWasExactRef.current = best.exact;
  }, []);

  const syncHeroCssVar = useCallback(
    (seq: SequenceType, heroFrame: number) => {
      const overlay = heroOverlayRefHolder.current?.current;
      if (!overlay) return;
      if (seq !== "hero") {
        if (lastHeroExitWrittenRef.current !== "1") {
          lastHeroExitWrittenRef.current = "1";
          overlay.style.setProperty("--hero-exit", "1");
        }
        return;
      }
      const exitProgress = prefersReducedMotionRef.current
        ? 0
        : computeHeroExitProgress(heroFrame, HERO_EXIT_START_FRAME, heroMaxFrame);
      const formatted = exitProgress <= 0.0005 ? "0" : exitProgress >= 0.9995 ? "1" : exitProgress.toFixed(4);
      if (formatted !== lastHeroExitWrittenRef.current) {
        lastHeroExitWrittenRef.current = formatted;
        overlay.style.setProperty("--hero-exit", formatted);
      }
    },
    [heroMaxFrame]
  );

  const emitDiscreteStateIfChanged = useCallback(
    (isAnimatingNow: boolean) => {
      const seq = activeSequenceRef.current;
      const heroF = currentFramesRef.current.hero;
      const targetHeroF = targetFramesRef.current.hero;
      const materiF = currentFramesRef.current.materi;
      const targetMateriF = targetFramesRef.current.materi;
      const readingF = currentFramesRef.current.reading;
      const targetReadingF = targetFramesRef.current.reading;
      const latihanF = currentFramesRef.current.latihan;
      const targetLatihanF = targetFramesRef.current.latihan;

      const heroStep: 1 | 2 | 3 = heroF <= 18 ? 1 : heroF <= 35 ? 2 : 3;
      const exitProgress = prefersReducedMotionRef.current
        ? 0
        : computeHeroExitProgress(heroF, HERO_EXIT_START_FRAME, heroMaxFrame);

      const isHeroAtEnd =
        seq === "hero"
          ? Math.round(targetHeroF) >= totalHeroFrames && Math.abs(targetHeroF - heroF) < 0.35
          : true;

      const isMateriAtEnd =
        seq === "materi"
          ? Math.round(targetMateriF) >= totalMateriFrames && Math.abs(targetMateriF - materiF) < 0.35
          : seq === "reading";

      const isReadingAtEnd =
        seq === "reading"
          ? Math.round(targetReadingF) >= totalReadingFrames && Math.abs(targetReadingF - readingF) < 0.35
          : false;

      const isLatihanAtEnd =
        seq === "latihan"
          ? Math.round(targetLatihanF) >= totalLatihanFrames && Math.abs(targetLatihanF - latihanF) < 0.35
          : false;

      const isHeroContentVisible =
        seq === "hero" && !isHeroAtEnd && heroF <= heroMaxFrame + 0.5;
      const isHeroInteractive = isHeroContentVisible && exitProgress <= 0.75;

      const currentFrame = currentFramesRef.current[seq];
      const isScrolledPastStart =
        seq !== "hero" || isHeroAtEnd || isAnimatingNow || currentFrame > 5 || lastScrollYRef.current > 20;

      const activeAuto = autoplayRef.current;
      const activeAutoplayTarget =
        activeAuto &&
        activeAuto.interruptible &&
        activeAuto.targetFrame > activeAuto.startFrame &&
        activeAuto.targetFrame - currentFramesRef.current[activeAuto.sequence] > 18
          ? activeAuto.sequence
          : null;

      const nextState: DiscreteSequenceState = {
        activeSequence: seq,
        activeAutoplayTarget,
        heroStep,
        isHeroContentVisible,
        isHeroInteractive,
        isHeroAtEnd,
        isMateriAtEnd,
        isReadingAtEnd,
        isLatihanAtEnd,
        isScrolledPastStart,
      };

      const prev = lastDiscreteRef.current;
      if (
        prev &&
        prev.activeSequence === nextState.activeSequence &&
        prev.activeAutoplayTarget === nextState.activeAutoplayTarget &&
        prev.heroStep === nextState.heroStep &&
        prev.isHeroContentVisible === nextState.isHeroContentVisible &&
        prev.isHeroInteractive === nextState.isHeroInteractive &&
        prev.isHeroAtEnd === nextState.isHeroAtEnd &&
        prev.isMateriAtEnd === nextState.isMateriAtEnd &&
        prev.isReadingAtEnd === nextState.isReadingAtEnd &&
        prev.isLatihanAtEnd === nextState.isLatihanAtEnd &&
        prev.isScrolledPastStart === nextState.isScrolledPastStart
      ) {
        return;
      }

      lastDiscreteRef.current = nextState;
      onDiscreteStateChangeRef.current?.(nextState);

      // Idle cross-stage lookahead warmup sized to current device hardware tier & network condition
      const cache = cacheManagerRef.current;
      const budget = cacheBudgetRef.current;
      const headBudget = budget.warmHeadCount;
      const warmStride = budget.isConstrainedNetwork ? 4 : 1;
      if (cache && seq === "hero" && isHeroAtEnd && !warmupTriggeredRef.current.heroToMateri) {
        warmupTriggeredRef.current.heroToMateri = true;
        // Always pin crisp 1080p endpoints directly (<1MB total) without starving mobile MP4 playback
        void cache.loadFrame("materi", totalMateriFrames, false, true);
        void cache.loadFrame("reading", 1, false, true);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan, false, true);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan + 1, false, true);
        void cache.loadFrame("latihan", totalLatihanFrames, false, true);
        // Pre-warm next stage MP4s into local RAM Blobs so tapping Materi / Latihan / Back starts in 0ms
        queueVideoPrefetch(["materi", "latihan", "hero-rev"]);
        if (budget.tier !== "low") {
          cache.warmSequenceHead("materi", headBudget, false);
          cache.warmSequenceHead("latihan", headBudget, true);
          getRuntimeWarmBlocks(cache, totalMateriFrames, totalLatihanFrames, warmStride);
        }
      } else if (cache && seq === "materi" && isMateriAtEnd && !warmupTriggeredRef.current.materiToReading) {
        warmupTriggeredRef.current.materiToReading = true;
        void cache.loadFrame("reading", totalReadingFrames, false, true);
        queueVideoPrefetch(["reading", "materi-rev"]);
        if (budget.tier !== "low") {
          cache.warmSequenceHead(
            "reading",
            Math.min(42, Math.max(headBudget, Math.round(budget.maxActiveBitmaps * 0.4)))
          );
          cache.queueBlobWarmup("reading", 1, totalReadingFrames, warmStride);
        }
      } else if (
        cache &&
        seq === "reading" &&
        isReadingAtEnd &&
        !warmupTriggeredRef.current.readingPageFlip
      ) {
        warmupTriggeredRef.current.readingPageFlip = true;
        queueVideoPrefetch(["reading-rev"]);
        if (!budget.isConstrainedNetwork) {
          // Warm only the compact 3D page-turn clip (~1.2 MB) so book page flips stay instant even on mobile
          cache.queueBlobWarmup("reading", 355, Math.min(445, totalReadingFrames), budget.tier === "low" ? 2 : 1);
        }
      }
    },
    [
      heroMaxFrame,
      totalHeroFrames,
      totalMateriFrames,
      totalReadingFrames,
      totalLatihanFrames,
      queueVideoPrefetch,
    ]
  );

  const syncDomScrollInstant = useCallback(
    (seq: SequenceType, frame: number) => {
      measureScrollableHeights();
      const targetY = frameToScrollY(
        seq,
        frame,
        scrollableHeightsRef.current[seq],
        getMaxFrames(seq),
        heroMaxFrame
      );
      suppressScrollReadRef.current = true;
      lastScrollYRef.current = targetY;
      window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
      lenisRef.current.resize();
      lenisRef.current.scrollTo(targetY, { immediate: true, force: true });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressScrollReadRef.current = false;
        });
      });
    },
    [measureScrollableHeights, getMaxFrames, heroMaxFrame]
  );

  // Hard scroll-lock while 2D reading/writing books or fullscreen modals are active
  useEffect(() => {
    isScrollLockedRef.current = isScrollLocked;

    if (isScrollLocked) {
      wasScrollLockedRef.current = true;
      lenisRef.current.stop();

      const htmlEl = document.documentElement;
      const bodyEl = document.body;
      const prevHtmlOverflow = htmlEl.style.overflow;
      const prevHtmlOverscroll = htmlEl.style.overscrollBehavior;
      const prevBodyOverflow = bodyEl.style.overflow;
      const prevBodyOverscroll = bodyEl.style.overscrollBehavior;

      htmlEl.style.overflow = "hidden";
      htmlEl.style.overscrollBehavior = "none";
      bodyEl.style.overflow = "hidden";
      bodyEl.style.overscrollBehavior = "none";

      const handleLockedTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 1) return;
        if (hasScrollableAncestor(e.target)) return;
        if (e.cancelable) {
          e.preventDefault();
        }
      };

      window.addEventListener("touchmove", handleLockedTouchMove, { passive: false });

      return () => {
        window.removeEventListener("touchmove", handleLockedTouchMove);
        htmlEl.style.overflow = prevHtmlOverflow;
        htmlEl.style.overscrollBehavior = prevHtmlOverscroll;
        bodyEl.style.overflow = prevBodyOverflow;
        bodyEl.style.overscrollBehavior = prevBodyOverscroll;
      };
    }

    if (wasScrollLockedRef.current) {
      wasScrollLockedRef.current = false;
      const activeAuto = autoplayRef.current;
      if (activeAuto) {
        if (activeAuto.interruptible) {
          lenisRef.current.start();
        }
        return;
      }

      suppressScrollReadRef.current = true;
      lenisRef.current.start();
      const activeSeq = activeSequenceRef.current;
      syncDomScrollInstant(activeSeq, currentFramesRef.current[activeSeq]);
    }
  }, [isScrollLocked, syncDomScrollInstant]);

  const renderLoopRef = useRef<(now: number) => void>(() => {});

  const ensureLoopActive = useCallback(() => {
    if (rafIdRef.current !== null) return;
    prevTickTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame((ts) => renderLoopRef.current(ts));
  }, []);

  const syncTargetFromWindowScroll = useCallback(() => {
    if (autoplayRef.current || suppressScrollReadRef.current || isScrollLockedRef.current) return;

    const seq = isLatihanUnlockedRef.current
      ? "latihan"
      : isReadingUnlockedRef.current
      ? "reading"
      : isMateriUnlockedRef.current
      ? "materi"
      : "hero";
    activeSequenceRef.current = seq;

    const scrollY = lenisRef.current.getAnimatedScroll();
    if (scrollY > lastScrollYRef.current + 0.05) {
      scrollDirectionRef.current = 1;
    } else if (scrollY < lastScrollYRef.current - 0.05) {
      scrollDirectionRef.current = -1;
    }
    lastScrollYRef.current = scrollY;

    const scrollable = scrollableHeightsRef.current[seq];
    const maxFrames = getMaxFrames(seq);
    const nextTarget =
      scrollable > 100 && scrollY >= scrollable - 28
        ? maxFrames
        : scrollYToFrame(seq, scrollY, scrollable, maxFrames, heroMaxFrame);
    targetFramesRef.current[seq] = nextTarget;
  }, [getMaxFrames, heroMaxFrame]);

  // Persistent controller API for smooth single-rAF forward & reverse cutscenes
  useEffect(() => {
    if (!controllerRef) return;

    const controller: ScrollCanvasController = {
      playTo(sequence, rawTargetFrame, options) {
        stopHardwareVideo();
        const cache = cacheManagerRef.current;
        const maxFrames = getMaxFrames(sequence);
        const clampedTarget = Math.max(1, Math.min(maxFrames, rawTargetFrame));

        if (options.startFrame !== undefined || activeSequenceRef.current !== sequence) {
          lastDisplayedSourceSeqRef.current = null;
          lastDisplayedSourceFrameRef.current = -1;
        }
        activeSequenceRef.current = sequence;
        if (options.startFrame !== undefined) {
          const clampedStart = Math.max(1, Math.min(maxFrames, options.startFrame));
          currentFramesRef.current[sequence] = clampedStart;
          targetFramesRef.current[sequence] = clampedStart;
        }

        const startFrame = currentFramesRef.current[sequence];
        const direction: 1 | -1 = clampedTarget >= startFrame ? 1 : -1;
        scrollDirectionRef.current = direction;

        const now = performance.now();
        const spanFrames = Math.ceil(Math.abs(clampedTarget - startFrame));
        const videoEl = videoRef.current;
        const isShortBookFlip =
          sequence === "reading" && startFrame >= 340 && clampedTarget <= 460;
        const clipKey = resolveVideoClipKey(sequence, direction);
        const useHardwareVideo =
          Boolean(videoEl) &&
          clipKey !== null &&
          !prefersReducedMotionRef.current &&
          spanFrames > 15 &&
          !isShortBookFlip;

        if (useHardwareVideo || !(options.interruptible ?? true)) {
          // Pause Lenis rAF & native overscroll during hardware video playback
          lenisRef.current.stop();
        } else {
          // Cancel any leftover wheel momentum cleanly before direct timeline playback
          lenisRef.current.scrollTo(window.scrollY, { immediate: true, force: true });
        }

        const expectedDurationSec = maxFrames / SEQUENCE_VIDEO_FPS;
        const maxSpan = Math.max(1, maxFrames - 1);
        const estStartSec =
          direction === 1
            ? ((startFrame - 1) / maxSpan) * expectedDurationSec
            : ((maxFrames - startFrame) / maxSpan) * expectedDurationSec;
        const estTargetSec =
          direction === 1
            ? ((clampedTarget - 1) / maxSpan) * expectedDurationSec
            : ((maxFrames - clampedTarget) / maxSpan) * expectedDurationSec;
        const sessionId = useHardwareVideo ? ++videoSessionIdRef.current : videoSessionIdRef.current;

        const primeTargetCount = Math.min(12, Math.max(1, spanFrames));
        const readyAhead = cache
          ? cache.countContiguousReady(sequence, Math.round(startFrame), direction, primeTargetCount)
          : primeTargetCount;

        autoplayRef.current = {
          mode: useHardwareVideo ? "video" : "canvas",
          sequence,
          startFrame,
          targetFrame: clampedTarget,
          startTime: now,
          startedAtMs: now,
          durationMs: Math.max(16, options.durationMs),
          primingStartTime: useHardwareVideo || readyAhead >= primeTargetCount ? null : now,
          primeTargetCount,
          maxPrimeWaitMs: 900,
          lastClockTime: now,
          stalledFrame: -1,
          currentFrameStallMs: 0,
          totalStallMs: 0,
          videoSessionId: sessionId,
          videoStartedAt: now,
          videoDirection: direction,
          videoClipKey: clipKey,
          videoStartTimeSec: estStartSec,
          videoTargetTimeSec: estTargetSec,
          videoSeekReady: false,
          videoHasPaintedFrame: false,
          videoLastTime: estStartSec,
          videoLastProgressAt: now,
          videoFallbackTriggered: false,
          interruptible: options.interruptible ?? true,
          syncScrollOnComplete: options.syncScrollOnComplete ?? true,
          onComplete: options.onComplete,
        };

        // Always pre-fetch the single crisp 1080p destination endpoint directly so handoff is instant
        if (cache) {
          cache.setPlaybackActive(true);
          void cache.loadFrame(sequence, Math.round(clampedTarget), true, true);
          if (!useHardwareVideo) {
            const budget = cacheBudgetRef.current;
            cache.queueBlobWarmup(sequence, 1, maxFrames, 1);
            cache.reprioritizeBlobWarmup(sequence);
            cache.requestWindow(
              sequence,
              Math.round(startFrame),
              direction,
              getRuntimeLookahead(budget),
              budget.lookbehind
            );
          }
        }

        if (useHardwareVideo && videoEl && clipKey) {
          isVideoActiveRef.current = true;
          // Yield cellular bandwidth immediately if a different background clip is being fetched
          if (videoPrefetchInFlightRef.current && videoPrefetchInFlightRef.current !== clipKey) {
            const abortedClip = videoPrefetchInFlightRef.current;
            videoPrefetchAbortRef.current?.abort();
            if (!videoPrefetchQueueRef.current.includes(abortedClip)) {
              videoPrefetchQueueRef.current.unshift(abortedClip);
            }
          }

          const cachedBlobUrl = videoBlobUrlsRef.current.get(clipKey);
          const mediaSrc = cachedBlobUrl ?? SEQUENCE_VIDEO_URLS[clipKey];
          const rawDesiredRate =
            (Math.max(0.05, estTargetSec - estStartSec) * 1000) / Math.max(100, options.durationMs);
          // Lock to exact 1.0x whenever within 14% of native 60fps so iOS/Android stay on zero-copy HW video overlay
          const desiredRate =
            Math.abs(rawDesiredRate - 1.0) < 0.14
              ? 1.0
              : Math.max(0.5, Math.min(2.0, rawDesiredRate));

          const prevClip = videoEl.getAttribute("data-clip");
          const needsReload =
            prevClip !== clipKey || (Boolean(cachedBlobUrl) && videoEl.src !== cachedBlobUrl);
          if (needsReload) {
            videoEl.setAttribute("data-clip", clipKey);
            videoEl.preload = "auto";
            videoEl.src = mediaSrc;
            videoEl.load();
          }
          videoEl.muted = true;
          videoEl.defaultMuted = true;
          videoEl.playsInline = true;
          videoEl.loop = false;
          videoEl.playbackRate = desiredRate;

          const triggerFallbackToCanvas = () => {
            const active = autoplayRef.current;
            if (
              videoSessionIdRef.current !== sessionId ||
              !active ||
              active.mode !== "video" ||
              active.videoFallbackTriggered
            ) {
              return;
            }
            active.videoFallbackTriggered = true;
            active.mode = "canvas";
            active.startTime = performance.now();
            active.lastClockTime = performance.now();
            active.startFrame = currentFramesRef.current[sequence];
            active.primingStartTime = null;
            stopHardwareVideo();
            if (cache) {
              const budget = cacheBudgetRef.current;
              cache.queueBlobWarmup(sequence, 1, maxFrames, 1);
              cache.reprioritizeBlobWarmup(sequence);
              cache.requestWindow(
                sequence,
                Math.round(active.startFrame),
                direction,
                getRuntimeLookahead(budget),
                budget.lookbehind
              );
            }
          };

          const startVideoAtOffset = () => {
            if (videoSessionIdRef.current !== sessionId) return;
            const realDur =
              Number.isFinite(videoEl.duration) && videoEl.duration > 0.1
                ? videoEl.duration
                : expectedDurationSec;
            const exactStartSec =
              direction === 1
                ? ((startFrame - 1) / maxSpan) * realDur
                : ((maxFrames - startFrame) / maxSpan) * realDur;
            const exactTargetSec =
              direction === 1
                ? ((clampedTarget - 1) / maxSpan) * realDur
                : ((maxFrames - clampedTarget) / maxSpan) * realDur;
            const active = autoplayRef.current;
            if (active && active.videoSessionId === sessionId) {
              active.videoStartTimeSec = exactStartSec;
              active.videoTargetTimeSec = exactTargetSec;
              active.videoLastTime = exactStartSec;
            }
            const rawRate =
              (Math.max(0.05, exactTargetSec - exactStartSec) * 1000) /
              Math.max(100, options.durationMs);
            const rate =
              Math.abs(rawRate - 1.0) < 0.14 ? 1.0 : Math.max(0.5, Math.min(2.0, rawRate));
            videoEl.playbackRate = rate;
            if (Math.abs(videoEl.currentTime - exactStartSec) > 0.08) {
              if (active && active.videoSessionId === sessionId) {
                active.videoSeekReady = false;
              }
              try {
                videoEl.currentTime = exactStartSec;
              } catch {
                // Seek retried automatically once data loads
              }
            }
            const playResult = videoEl.play();
            if (playResult && typeof playResult.catch === "function") {
              playResult.catch(() => {
                triggerFallbackToCanvas();
              });
            }
          };

          const onVideoError = () => {
            triggerFallbackToCanvas();
          };
          videoEl.addEventListener("error", onVideoError, { once: true });

          if (videoEl.readyState >= 1) {
            startVideoAtOffset();
          } else {
            const onMeta = () => {
              startVideoAtOffset();
            };
            videoEl.addEventListener("loadedmetadata", onMeta, { once: true });
            // Unlock media element synchronously inside the user click gesture (critical for iOS Safari)
            void videoEl.play().catch(() => {});
          }
        }

        const roundedStart = Math.round(startFrame);
        if (lastDrawnSeqRef.current !== sequence || lastDrawnFrameRef.current !== roundedStart) {
          drawFrame(sequence, roundedStart);
        }
        syncHeroCssVar(sequence, startFrame);
        emitDiscreteStateIfChanged(true);
        ensureLoopActive();
      },

      snapTo(sequence, rawFrame, suppressScrollSync = false) {
        stopHardwareVideo();
        autoplayRef.current = null;
        suppressScrollReadRef.current = suppressScrollSync;
        lastDisplayedSourceSeqRef.current = sequence;
        lastDisplayedSourceFrameRef.current = -1;

        const maxFrames = getMaxFrames(sequence);
        const frame = Math.max(1, Math.min(maxFrames, rawFrame));

        activeSequenceRef.current = sequence;
        currentFramesRef.current[sequence] = frame;
        targetFramesRef.current[sequence] = frame;
        scrollDirectionRef.current = frame >= maxFrames - 5 ? -1 : 1;

        const cache = cacheManagerRef.current;
        if (cache) {
          const budget = cacheBudgetRef.current;
          cache.setPlaybackActive(false);
          cache.requestWindow(
            sequence,
            Math.round(frame),
            scrollDirectionRef.current,
            getRuntimeLookahead(budget),
            budget.lookbehind
          );
        }

        drawFrame(sequence, Math.round(frame));
        syncHeroCssVar(sequence, frame);
        emitDiscreteStateIfChanged(false);
      },

      async prepareFrame(sequence, rawFrame) {
        const cache = cacheManagerRef.current;
        if (!cache) return false;
        const maxFrames = getMaxFrames(sequence);
        const clamped = Math.max(1, Math.min(maxFrames, Math.round(rawFrame)));
        const bitmap = await cache.loadFrame(sequence, clamped, true, true);
        if (bitmap && activeSequenceRef.current === sequence) {
          drawFrame(sequence, clamped);
        }
        return Boolean(bitmap);
      },

      releaseScrollSync(syncScrollY) {
        measureScrollableHeights();
        if (syncScrollY !== undefined) {
          lastScrollYRef.current = syncScrollY;
          window.scrollTo({ top: syncScrollY, behavior: "instant" as ScrollBehavior });
          lenisRef.current.resize();
          lenisRef.current.scrollTo(syncScrollY, { immediate: true, force: true });
        }
        if (!isScrollLockedRef.current) {
          lenisRef.current.start();
        }
        requestAnimationFrame(() => {
          suppressScrollReadRef.current = false;
        });
      },

      cancelAutoplay(keepScrollLocked = false) {
        stopHardwareVideo();
        autoplayRef.current = null;
        cacheManagerRef.current?.setPlaybackActive(false);
        emitDiscreteStateIfChanged(false);
        if (keepScrollLocked || isScrollLockedRef.current) {
          lenisRef.current.stop();
        } else {
          lenisRef.current.start();
        }
      },

      getCurrentFrame(sequence) {
        return currentFramesRef.current[sequence];
      },

      getScrollableHeight(sequence) {
        measureScrollableHeights();
        return scrollableHeightsRef.current[sequence];
      },
    };

    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
    };
  }, [
    controllerRef,
    getMaxFrames,
    drawFrame,
    syncHeroCssVar,
    emitDiscreteStateIfChanged,
    ensureLoopActive,
    measureScrollableHeights,
    stopHardwareVideo,
  ]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d", {
        alpha: false,
      });
    }

    const displayWidth = Math.max(1, window.innerWidth);
    const displayHeight = Math.max(1, window.innerHeight);
    lastViewportRef.current = { width: displayWidth, height: displayHeight };
    setViewportSize((prev) =>
      prev.width === displayWidth && prev.height === displayHeight
        ? prev
        : { width: displayWidth, height: displayHeight }
    );
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);

    // Cap mobile physical backing store to 1280x720 (2.25x lighter GPU fillrate than 1920x1080 on 390px screens)
    const maxPhysicalW = displayWidth < 768 ? 1280 : SOURCE_WIDTH;
    const maxPhysicalH = displayWidth < 768 ? 720 : SOURCE_HEIGHT;
    const baseStage = computeCoverStageMetrics(
      displayWidth,
      displayHeight,
      SOURCE_WIDTH,
      SOURCE_HEIGHT
    );
    const physicalScale = Math.min(
      rawDpr,
      maxPhysicalW / Math.max(1, baseStage.width),
      maxPhysicalH / Math.max(1, baseStage.height)
    );

    const physicalWidth = Math.max(1, Math.round(baseStage.width * physicalScale));
    const physicalHeight = Math.max(1, Math.round(baseStage.height * physicalScale));

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      lastDrawnFrameRef.current = -1;
      lastDrawnBitmapRef.current = null;
    }

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
    }

    drawBoundsRef.current = {
      x: 0,
      y: 0,
      width: physicalWidth,
      height: physicalHeight,
    };

    measureScrollableHeights();

    const seq = activeSequenceRef.current;
    drawFrame(seq, Math.round(currentFramesRef.current[seq]));
  }, [drawFrame, measureScrollableHeights]);

  // Keep scrollable track dimensions synced whenever stage components mount/unmount
  useEffect(() => {
    measureScrollableHeights();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measureScrollableHeights())
        : null;

    if (ro) {
      if (containerRef.current) ro.observe(containerRef.current);
      if (materiContainerRef?.current) ro.observe(materiContainerRef.current);
      if (readingContainerRef?.current) ro.observe(readingContainerRef.current);
      if (latihanContainerRef?.current) ro.observe(latihanContainerRef.current);
    }

    return () => {
      ro?.disconnect();
    };
  }, [
    isMateriUnlocked,
    isReadingUnlocked,
    isLatihanUnlocked,
    containerRef,
    materiContainerRef,
    readingContainerRef,
    latihanContainerRef,
    measureScrollableHeights,
  ]);

  // Initialize cache pipeline, render loop, and passive scroll listeners once
  useEffect(() => {
    prefersReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const budget = detectAdaptiveCacheBudget();
    cacheBudgetRef.current = budget;

    const runtimeMaxBitmaps =
      budget.tier === "low" ? 60 : budget.tier === "balanced" ? 90 : 120;
    const runtimeMaxBlobs =
      budget.tier === "low" ? 720 : budget.tier === "balanced" ? 1400 : 1800;
    const runtimeMaxDecodes = budget.tier === "low" ? 3 : 4;

    const cache = new FrameCacheManager<ImageBitmap>(
      {
        totalHeroFrames,
        totalMateriFrames,
        totalReadingFrames,
        totalLatihanFrames,
        packChunks: SEQUENCE_PACK_CHUNKS,
        maxActiveBitmaps: runtimeMaxBitmaps,
        maxCachedBlobs: runtimeMaxBlobs,
        maxConcurrentDecodes: runtimeMaxDecodes,
        maxConcurrentFetches: budget.maxConcurrentFetches,
        maxBackgroundWarms: budget.isConstrainedNetwork ? 2 : 4,
      },
      undefined,
      (decodedSeq, decodedIndex) => {
        if (decodedSeq !== activeSequenceRef.current) return;
        const activeRounded = Math.round(currentFramesRef.current[decodedSeq]);
        if (decodedIndex === activeRounded || !lastDrawWasExactRef.current) {
          ensureLoopActive();
        }
      }
    );
    cacheManagerRef.current = cache;

    const renderLoop = (now: number) => {
      rafIdRef.current = null;
      const dt = Math.min(Math.max((now - prevTickTimeRef.current) / 1000, 0.001), 0.05);
      prevTickTimeRef.current = now;

      const autoplay = autoplayRef.current;
      let isMoving = false;
      let completedAutoplay: ActiveAutoplay | null = null;

      if (autoplay) {
        isMoving = true;
        const seq = autoplay.sequence;
        activeSequenceRef.current = seq;
        const maxSeqFrames = getMaxFrames(seq);
        const stepDt = Math.max(0, Math.min(50, now - autoplay.lastClockTime));
        autoplay.lastClockTime = now;

        if (prefersReducedMotionRef.current) {
          currentFramesRef.current[seq] = autoplay.targetFrame;
          targetFramesRef.current[seq] = autoplay.targetFrame;
          autoplayRef.current = null;
          cache.setPlaybackActive(false);
          completedAutoplay = autoplay;
          isMoving = false;
        } else if (autoplay.mode === "video") {
          const videoEl = videoRef.current;
          const vDir = autoplay.videoDirection;
          const fallbackToCanvas = () => {
            autoplay.videoFallbackTriggered = true;
            autoplay.mode = "canvas";
            autoplay.startFrame = currentFramesRef.current[seq];
            autoplay.startTime = now;
            autoplay.lastClockTime = now;
            autoplay.primingStartTime = null;
            stopHardwareVideo();
            const curBudget = cacheBudgetRef.current;
            cache.queueBlobWarmup(seq, 1, maxSeqFrames, 1);
            cache.reprioritizeBlobWarmup(seq);
            cache.requestWindow(
              seq,
              Math.round(autoplay.startFrame),
              vDir,
              getRuntimeLookahead(curBudget),
              curBudget.lookbehind
            );
          };

          if (!videoEl || videoEl.error !== null) {
            fallbackToCanvas();
          } else if (videoEl.readyState >= 2) {
            if (!autoplay.videoSeekReady) {
              const needSeekGuard =
                autoplay.videoTargetTimeSec - autoplay.videoStartTimeSec > 0.25;
              const seekMatchesStart =
                !videoEl.seeking &&
                videoEl.currentTime >= autoplay.videoStartTimeSec - 0.12 &&
                (!needSeekGuard || videoEl.currentTime < autoplay.videoTargetTimeSec - 0.12);
              if (seekMatchesStart) {
                autoplay.videoSeekReady = true;
                autoplay.videoLastTime = videoEl.currentTime;
                autoplay.videoLastProgressAt = now;
              }
            }

            if (autoplay.videoSeekReady) {
              const realDur =
                Number.isFinite(videoEl.duration) && videoEl.duration > 0.1
                  ? videoEl.duration
                  : maxSeqFrames / SEQUENCE_VIDEO_FPS;

              if (videoEl.currentTime > autoplay.videoLastTime + 0.005) {
                autoplay.videoLastTime = videoEl.currentTime;
                autoplay.videoLastProgressAt = now;
              }

              if (
                !autoplay.videoHasPaintedFrame &&
                (videoEl.currentTime > autoplay.videoStartTimeSec + 0.008 ||
                  videoEl.currentTime > 0.01 ||
                  videoEl.ended)
              ) {
                autoplay.videoHasPaintedFrame = true;
                setIsVideoVisible(true);
              }

              const progress = Math.max(0, Math.min(1, videoEl.currentTime / Math.max(0.05, realDur)));
              const videoFrame =
                vDir === 1
                  ? 1 + progress * (maxSeqFrames - 1)
                  : maxSeqFrames - progress * (maxSeqFrames - 1);
              const nextFrame =
                vDir === 1
                  ? Math.max(currentFramesRef.current[seq], Math.min(autoplay.targetFrame, videoFrame))
                  : Math.min(currentFramesRef.current[seq], Math.max(autoplay.targetFrame, videoFrame));
              currentFramesRef.current[seq] = nextFrame;
              targetFramesRef.current[seq] = nextFrame;

              const reachedEnd =
                videoEl.ended ||
                videoEl.currentTime >= autoplay.videoTargetTimeSec - 0.025 ||
                (vDir === 1
                  ? nextFrame >= autoplay.targetFrame - 0.25
                  : nextFrame <= autoplay.targetFrame + 0.25);

              if (reachedEnd) {
                if (!videoEl.paused) {
                  try {
                    videoEl.pause();
                  } catch {
                    // Ignore media pause error
                  }
                }
                currentFramesRef.current[seq] = autoplay.targetFrame;
                targetFramesRef.current[seq] = autoplay.targetFrame;
                autoplayRef.current = null;
                cache.setPlaybackActive(false);
                completedAutoplay = autoplay;
                isMoving = false;
              } else if (
                autoplay.videoHasPaintedFrame &&
                videoEl.paused &&
                !videoEl.ended &&
                now - autoplay.videoLastProgressAt > 1200
              ) {
                fallbackToCanvas();
              }
            }
          }

          if (
            autoplay.mode === "video" &&
            !completedAutoplay &&
            !autoplay.videoHasPaintedFrame &&
            now - autoplay.videoStartedAt > 3500
          ) {
            fallbackToCanvas();
          }
        } else {
          // Soft Pre-Buffer Priming: allow initial decode workers a brief runway before advancing
          if (autoplay.primingStartTime !== null) {
            const direction: 1 | -1 = autoplay.targetFrame >= autoplay.startFrame ? 1 : -1;
            const readyCount = cache.countContiguousReady(
              seq,
              Math.round(autoplay.startFrame),
              direction,
              autoplay.primeTargetCount
            );
            if (
              readyCount >= autoplay.primeTargetCount ||
              now - autoplay.primingStartTime >= autoplay.maxPrimeWaitMs
            ) {
              autoplay.primingStartTime = null;
            }
            autoplay.startTime = now;
          }

          let rawT =
            autoplay.primingStartTime !== null
              ? 0
              : Math.min(1, (now - autoplay.startTime) / autoplay.durationMs);
          let easedT = rawT >= 1 ? 1 : easeSmoothCruise(rawT);
          let exactFrame =
            autoplay.startFrame + (autoplay.targetFrame - autoplay.startFrame) * easedT;
          const candidateRounded = Math.max(1, Math.min(maxSeqFrames, Math.round(exactFrame)));

          if (candidateRounded !== autoplay.stalledFrame) {
            autoplay.stalledFrame = candidateRounded;
            autoplay.currentFrameStallMs = 0;
          }

          // Buffer-Aware Velocity Pacing: hold cleanly until 450KB micro-chunk unpacks and gently cushion
          // cruise cadence to ~0.58x when ahead runway drops below 4 decoded frames so playback never jumps
          const direction: 1 | -1 = autoplay.targetFrame >= autoplay.startFrame ? 1 : -1;
          const isTargetReady = cache.hasBitmap(seq, candidateRounded);
          const aheadReady = isTargetReady
            ? cache.countContiguousReady(seq, candidateRounded, direction, 8)
            : 0;

          if (
            autoplay.primingStartTime === null &&
            rawT < 1 &&
            autoplay.totalStallMs < 4000
          ) {
            if (
              !isTargetReady &&
              cache.isFrameBusy(seq, candidateRounded) &&
              autoplay.currentFrameStallMs < 650
            ) {
              autoplay.startTime += stepDt;
              autoplay.currentFrameStallMs += stepDt;
              autoplay.totalStallMs += stepDt;
              rawT = Math.min(1, (now - autoplay.startTime) / autoplay.durationMs);
              easedT = rawT >= 1 ? 1 : easeSmoothCruise(rawT);
              exactFrame =
                autoplay.startFrame + (autoplay.targetFrame - autoplay.startFrame) * easedT;
            } else if (aheadReady < 4 && autoplay.currentFrameStallMs < 650) {
              const cushion = stepDt * 0.42;
              autoplay.startTime += cushion;
              autoplay.totalStallMs += cushion;
              rawT = Math.min(1, (now - autoplay.startTime) / autoplay.durationMs);
              easedT = rawT >= 1 ? 1 : easeSmoothCruise(rawT);
              exactFrame =
                autoplay.startFrame + (autoplay.targetFrame - autoplay.startFrame) * easedT;
            }
          }

          currentFramesRef.current[seq] = exactFrame;
          targetFramesRef.current[seq] = exactFrame;

          if (rawT >= 1) {
            currentFramesRef.current[seq] = autoplay.targetFrame;
            targetFramesRef.current[seq] = autoplay.targetFrame;
            autoplayRef.current = null;
            cache.setPlaybackActive(false);
            completedAutoplay = autoplay;
            isMoving = false;
          }
        }
      } else {
        if (!suppressScrollReadRef.current) {
          syncTargetFromWindowScroll();
        }

        const seq = activeSequenceRef.current;
        const cur = currentFramesRef.current[seq];
        const tgt = targetFramesRef.current[seq];
        const diff = tgt - cur;
        const absDiff = Math.abs(diff);

        if (absDiff > 0.015) {
          isMoving = true;
          const baseRate = prefersReducedMotionRef.current
            ? 1
            : absDiff < 8
              ? MANUAL_LERP_LENIS_LOCK_60HZ
              : MANUAL_LERP_SCRUB_JUMP_60HZ;
          const alpha = baseRate === 1 ? 1 : 1 - Math.pow(1 - baseRate, dt * 60);
          currentFramesRef.current[seq] = cur + diff * alpha;
        } else if (cur !== tgt) {
          currentFramesRef.current[seq] = tgt;
        }
      }

      const activeSeq = activeSequenceRef.current;
      const maxActiveFrames = getMaxFrames(activeSeq);
      const currentFrame = currentFramesRef.current[activeSeq];
      const roundedFrame = Math.max(1, Math.min(maxActiveFrames, Math.round(currentFrame)));

      syncHeroCssVar(activeSeq, currentFramesRef.current.hero);

      // Skip canvas WebP decode/draw while hardware <video> owns forward playback
      const videoOwnsPlayback =
        autoplayRef.current?.mode === "video" || completedAutoplay?.mode === "video";

      if (!videoOwnsPlayback) {
        const isLowTierCanvasAutoplay =
          autoplayRef.current?.mode === "canvas" &&
          cacheBudgetRef.current.tier === "low" &&
          roundedFrame > 2 &&
          roundedFrame < maxActiveFrames - 2;
        const drawTargetFrame =
          isLowTierCanvasAutoplay && roundedFrame % 2 !== 0 ? roundedFrame - 1 : roundedFrame;

        if (
          lastDrawnSeqRef.current !== activeSeq ||
          lastDrawnFrameRef.current !== drawTargetFrame ||
          !lastDrawWasExactRef.current
        ) {
          drawFrame(activeSeq, drawTargetFrame);

          if (
            lastWindowSeqRef.current !== activeSeq ||
            Math.abs(drawTargetFrame - lastWindowCenterRef.current) >= 2
          ) {
            const curBudget = cacheBudgetRef.current;
            lastWindowSeqRef.current = activeSeq;
            lastWindowCenterRef.current = drawTargetFrame;
            cache.requestWindow(
              activeSeq,
              drawTargetFrame,
              scrollDirectionRef.current,
              getRuntimeLookahead(curBudget),
              curBudget.lookbehind
            );
          }
        }
      }

      if (completedAutoplay) {
        const doneSeq = completedAutoplay.sequence;
        const doneTarget = Math.max(
          1,
          Math.min(getMaxFrames(doneSeq), Math.round(completedAutoplay.targetFrame))
        );
        const doneSessionId = completedAutoplay.videoSessionId;

        if (completedAutoplay.mode === "video") {
          if (cache.hasBitmap(doneSeq, doneTarget)) {
            drawFrame(doneSeq, doneTarget);
            stopHardwareVideo();
          } else {
            // Keep video frozen on its final frame until crisp 1080p WebP endpoint paints atomically
            void cache.loadFrame(doneSeq, doneTarget, true, true).then((bmp) => {
              if (videoSessionIdRef.current !== doneSessionId) return;
              if (bmp && activeSequenceRef.current === doneSeq) {
                drawFrame(doneSeq, doneTarget);
              } else if (activeSequenceRef.current === doneSeq) {
                drawFrame(doneSeq, doneTarget);
              }
              stopHardwareVideo();
            });
          }
        } else if (cache.hasBitmap(doneSeq, doneTarget)) {
          drawFrame(doneSeq, doneTarget);
        } else {
          void cache.loadFrame(doneSeq, doneTarget, true, true).then((bmp) => {
            if (
              bmp &&
              activeSequenceRef.current === doneSeq &&
              Math.round(currentFramesRef.current[doneSeq]) === doneTarget
            ) {
              drawFrame(doneSeq, doneTarget);
            }
          });
        }

        emitDiscreteStateIfChanged(false);

        if (completedAutoplay.syncScrollOnComplete) {
          syncDomScrollInstant(doneSeq, completedAutoplay.targetFrame);
        }
        if (!isScrollLockedRef.current && !completedAutoplay.onComplete) {
          lenisRef.current.start();
        }
        completedAutoplay.onComplete?.();

        if (pendingResizeAfterAutoplayRef.current) {
          pendingResizeAfterAutoplayRef.current = false;
          handleResize();
        }
        drainVideoPrefetchRef.current();
      } else {
        emitDiscreteStateIfChanged(isMoving);
      }

      const activeSeqNow = activeSequenceRef.current;
      const remainingDiff = Math.abs(
        targetFramesRef.current[activeSeqNow] - currentFramesRef.current[activeSeqNow]
      );
      if (autoplayRef.current !== null || remainingDiff > 0.015) {
        rafIdRef.current = requestAnimationFrame((ts) => renderLoopRef.current(ts));
      } else {
        cache.setPlaybackActive(false);
      }
    };

    renderLoopRef.current = renderLoop;

    handleResize();
    syncTargetFromWindowScroll();

    const startSeq = activeSequenceRef.current;
    const initialFrame = Math.max(
      1,
      Math.min(getMaxFrames(startSeq), Math.round(targetFramesRef.current[startSeq]))
    );
    currentFramesRef.current[startSeq] = initialFrame;
    targetFramesRef.current[startSeq] = initialFrame;

    // Direct single-frame fast-path for instant frame 1 paint, while window/chunk packs stream ahead
    void cache.loadFrame(startSeq, initialFrame, true, true).then((bitmap) => {
      if (bitmap) {
        setIsFirstFrameReady(true);
        drawFrame(startSeq, initialFrame);
      }
      // Queue hero.mp4 RAM-blob prefetch right after frame 1 paints so CTA starts in 0ms
      queueVideoPrefetch(["hero"]);
    });

    cache.requestWindow(
      startSeq,
      initialFrame,
      1,
      budget.tier === "low" ? 18 : getRuntimeLookahead(budget),
      Math.max(4, budget.lookbehind - 4)
    );
    void cache.loadFrame("hero", totalHeroFrames, false, true);
    void cache.loadFrame("materi", 1, false, true);
    void cache.loadFrame("latihan", 1, false, true);

    const mountVideoEl = videoRef.current;
    if (budget.tier !== "low") {
      cache.queueBlobWarmup("hero", 1, totalHeroFrames, 1);
      if (!budget.isConstrainedNetwork) {
        // Desktop/high-tier: also warm WebP chunks behind Hero for instant manual reverse/scrub
        cache.queueBlobWarmup("materi", 1, Math.min(36, totalMateriFrames), 1);
        cache.queueBlobWarmup("latihan", 1, Math.min(36, totalLatihanFrames), 1);
        getRuntimeWarmBlocks(cache, totalMateriFrames, totalLatihanFrames, 1);
      }
    }

    syncHeroCssVar(startSeq, initialFrame);
    emitDiscreteStateIfChanged(false);

    const handleNativeScroll = () => {
      if (suppressScrollReadRef.current || autoplayRef.current || isScrollLockedRef.current) return;
      syncTargetFromWindowScroll();
      cache.setPlaybackActive(true);
      ensureLoopActive();
    };

    const unsubscribeLenisScroll = lenisRef.current.subscribeScroll(() => {
      handleNativeScroll();
    });

    const handleManualInterrupt = () => {
      const activeAuto = autoplayRef.current;
      if (!activeAuto || !activeAuto.interruptible) return;

      const seq = activeAuto.sequence;
      const curFrame = currentFramesRef.current[seq];
      const wasVideo = activeAuto.mode === "video";
      stopHardwareVideo();
      autoplayRef.current = null;
      cache.setPlaybackActive(false);

      if (!isScrollLockedRef.current) {
        lenisRef.current.start();
      }

      if (wasVideo) {
        const rounded = Math.max(1, Math.min(getMaxFrames(seq), Math.round(curFrame)));
        const curBudget = cacheBudgetRef.current;
        cache.requestWindow(
          seq,
          rounded,
          scrollDirectionRef.current,
          getRuntimeLookahead(curBudget),
          curBudget.lookbehind
        );
        void cache.loadFrame(seq, rounded, true, true).then((bmp) => {
          if (bmp && activeSequenceRef.current === seq) {
            drawFrame(seq, rounded);
          }
        });
      }

      syncDomScrollInstant(seq, curFrame);
      emitDiscreteStateIfChanged(false);
      ensureLoopActive();
      drainVideoPrefetchRef.current();
    };

    let touchStartPos: { x: number; y: number } | null = null;

    const handleTouchStartCapture = (e: TouchEvent) => {
      const activeAuto = autoplayRef.current;
      if (!activeAuto || !activeAuto.interruptible || e.touches.length !== 1) {
        touchStartPos = null;
        return;
      }
      // Prevent button-tap finger drift or release during the first 500ms from aborting autoplay
      if (performance.now() - activeAuto.startedAtMs < 500) {
        touchStartPos = null;
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest("button, a, input, select, textarea, [role='button']")
      ) {
        touchStartPos = null;
        return;
      }
      const t = e.touches[0]!;
      touchStartPos = { x: t.clientX, y: t.clientY };
    };

    const handleTouchMoveInterrupt = (e: TouchEvent) => {
      if (!touchStartPos || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      const dx = Math.abs(t.clientX - touchStartPos.x);
      const dy = Math.abs(t.clientY - touchStartPos.y);
      // Require an intentional vertical scroll swipe (>48px) before cancelling autoplay
      if (dy > 48 && dy > dx * 1.5) {
        touchStartPos = null;
        handleManualInterrupt();
      }
    };

    const handleTouchEndReset = () => {
      touchStartPos = null;
    };

    const handleWheelInterrupt = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= 4 || Math.abs(e.deltaX) >= 4) {
        handleManualInterrupt();
      }
    };

    const handleKeyInterrupt = (e: KeyboardEvent) => {
      if (e.key === " ") {
        const activeEl = document.activeElement;
        if (
          activeEl instanceof HTMLButtonElement ||
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl instanceof HTMLAnchorElement
        ) {
          return;
        }
      }
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "PageDown" ||
        e.key === "PageUp" ||
        e.key === " " ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        handleManualInterrupt();
      }
    };

    const onResize = () => {
      // Ignore mobile browser URL-bar height-only resize jitter during autoplay so canvas is never wiped
      if (
        (autoplayRef.current !== null || isVideoActiveRef.current) &&
        window.innerWidth === lastViewportRef.current.width &&
        Math.abs(window.innerHeight - lastViewportRef.current.height) < 180
      ) {
        pendingResizeAfterAutoplayRef.current = true;
        return;
      }
      handleResize();
      if (!autoplayRef.current && !isScrollLockedRef.current) {
        syncTargetFromWindowScroll();
      }
      ensureLoopActive();
    };

    window.addEventListener("scroll", handleNativeScroll, { passive: true });
    window.addEventListener("wheel", handleWheelInterrupt, { passive: true, capture: true });
    window.addEventListener("touchstart", handleTouchStartCapture, { passive: true, capture: true });
    window.addEventListener("touchmove", handleTouchMoveInterrupt, { passive: true, capture: true });
    window.addEventListener("touchend", handleTouchEndReset, { passive: true, capture: true });
    window.addEventListener("touchcancel", handleTouchEndReset, { passive: true, capture: true });
    window.addEventListener("keydown", handleKeyInterrupt, { passive: true, capture: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      unsubscribeLenisScroll();
      stopHardwareVideo();
      if (mountVideoEl) {
        mountVideoEl.removeAttribute("src");
        mountVideoEl.removeAttribute("data-clip");
        try {
          mountVideoEl.load();
        } catch {
          // Ignore media reset error on unmount
        }
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener("scroll", handleNativeScroll);
      window.removeEventListener("wheel", handleWheelInterrupt, { capture: true });
      window.removeEventListener("touchstart", handleTouchStartCapture, { capture: true });
      window.removeEventListener("touchmove", handleTouchMoveInterrupt, { capture: true });
      window.removeEventListener("touchend", handleTouchEndReset, { capture: true });
      window.removeEventListener("touchcancel", handleTouchEndReset, { capture: true });
      window.removeEventListener("keydown", handleKeyInterrupt, { capture: true });
      window.removeEventListener("resize", onResize);
      cache.destroy();
      cacheManagerRef.current = null;
    };
  }, [
    totalHeroFrames,
    totalMateriFrames,
    totalReadingFrames,
    totalLatihanFrames,
    getMaxFrames,
    handleResize,
    drawFrame,
    syncTargetFromWindowScroll,
    syncHeroCssVar,
    emitDiscreteStateIfChanged,
    syncDomScrollInstant,
    ensureLoopActive,
    stopHardwareVideo,
    queueVideoPrefetch,
  ]);

  const baseStage = useMemo(
    () =>
      computeCoverStageMetrics(
        viewportSize.width,
        viewportSize.height,
        SOURCE_WIDTH,
        SOURCE_HEIGHT
      ),
    [viewportSize.height, viewportSize.width]
  );

  const mobileCamera = useMemo(
    () =>
      isStudioBookFocused
        ? null
        : computeMobile3dCameraTransform(
            viewportSize.width,
            viewportSize.height,
            mobile3dCameraTarget
          ),
    [isStudioBookFocused, mobile3dCameraTarget, viewportSize.height, viewportSize.width]
  );

  const hasVerticalEdgeFade = Boolean(mobileCamera?.active && mobileCamera.zoom < 0.99);

  // Keep wrapper transform unset unless Studio 2D Focus zoom is active so mobile browsers
  // can promote <video> directly onto the zero-copy OS Hardware Video Overlay plane.
  const studioFocusStyle: React.CSSProperties | undefined = isStudioBookFocused
    ? {
        transformOrigin: "50% 68%",
        transform: "translate3d(0px, -4%, 0px) scale(1.36)",
      }
    : undefined;

  const verticalFadeMask = hasVerticalEdgeFade
    ? "linear-gradient(to bottom, transparent 0%, black 7%, black 90%, transparent 100%)"
    : undefined;

  const canvasCameraStyle: React.CSSProperties = {
    left: `${baseStage.offsetX}px`,
    top: `${baseStage.offsetY}px`,
    width: `${baseStage.width}px`,
    height: `${baseStage.height}px`,
    transformOrigin: mobileCamera?.active ? mobileCamera.transformOrigin : "50% 50%",
    transform: mobileCamera?.active
      ? mobileCamera.transformCss
      : "translate3d(0px, 0px, 0px) scale(1)",
    maskImage: verticalFadeMask,
    WebkitMaskImage: verticalFadeMask,
  };

  const videoStageStyle: React.CSSProperties = {
    left: `${baseStage.offsetX}px`,
    top: `${baseStage.offsetY}px`,
    width: `${baseStage.width}px`,
    height: `${baseStage.height}px`,
    transformOrigin: mobileCamera?.active ? mobileCamera.transformOrigin : "50% 50%",
    transform: mobileCamera?.active ? mobileCamera.transformCss : undefined,
  };

  return (
    <div
      className="fixed inset-0 z-0 h-dvh w-screen overflow-hidden select-none bg-[#030712] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className={`relative h-full w-full ${
          isStudioBookFocused
            ? "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : ""
        }`}
        style={studioFocusStyle}
      >
        {/* Pinned HTML5 Canvas — Hidden while hardware <video> owns playback to eliminate 2x GPU overdraw */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Animasi sinematik sekuens gerbang perpustakaan fantasi Aksaraloka"
          style={canvasCameraStyle}
          className={`absolute block max-w-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVideoVisible ? "invisible" : isFirstFrameReady ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Hardware-accelerated 60 FPS H.264 video layer for zero-judder forward & reverse autoplay */}
        <video
          ref={videoRef}
          muted
          playsInline
          preload="metadata"
          disableRemotePlayback
          aria-hidden="true"
          style={videoStageStyle}
          className={`absolute z-[1] block max-w-none object-fill pointer-events-none ${
            isVideoVisible ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        />
      </div>
      {/* Subtle edge vignette during 2D Book Focus Mode without darkening the book */}
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(3,7,18,0.02)_0%,rgba(3,7,18,0.26)_100%)] transition-opacity duration-700 ease-out ${
          isStudioBookFocused ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});
