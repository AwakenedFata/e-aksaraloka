"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLenis } from "@/components/shared/providers/SmoothScrollProvider";
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

interface ScrollCanvasSequenceProps {
  readonly isMateriUnlocked?: boolean;
  readonly isReadingUnlocked?: boolean;
  readonly isLatihanUnlocked?: boolean;
  readonly isReverseScrolling?: boolean;
  readonly isStudioBookFocused?: boolean;
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

interface ActiveAutoplay {
  sequence: SequenceType;
  startFrame: number;
  targetFrame: number;
  startTime: number;
  durationMs: number;
  primingStartTime: number | null;
  primeTargetCount: number;
  maxPrimeWaitMs: number;
  lastClockTime: number;
  stalledFrame: number;
  currentFrameStallMs: number;
  totalStallMs: number;
  interruptible: boolean;
  syncScrollOnComplete: boolean;
  onComplete?: () => void;
}

const TOTAL_HERO_FRAMES_DEFAULT = 240;
const TOTAL_MATERI_FRAMES_DEFAULT = 299;
const TOTAL_READING_FRAMES_DEFAULT = 537;

// Frame-rate normalized smoothing factor for manual Lenis wheel scrubbing (~60fps baseline)
const MANUAL_LERP_60HZ = 0.42;
const HERO_EXIT_START_FRAME = 20;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

export function ScrollCanvasSequence({
  isMateriUnlocked = false,
  isReadingUnlocked = false,
  isLatihanUnlocked = false,
  isReverseScrolling = false,
  isStudioBookFocused = false,
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
  useEffect(() => {
    isMateriUnlockedRef.current = isMateriUnlocked;
    isReadingUnlockedRef.current = isReadingUnlocked;
    isLatihanUnlockedRef.current = isLatihanUnlocked;
    isReverseScrollingRef.current = isReverseScrolling;
  }, [isMateriUnlocked, isReadingUnlocked, isLatihanUnlocked, isReverseScrolling]);

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
  const lastWindowCenterRef = useRef<number>(-1);
  const lastWindowSeqRef = useRef<SequenceType | null>(null);
  const scrollDirectionRef = useRef<1 | -1>(1);
  const lastScrollYRef = useRef<number>(0);

  const autoplayRef = useRef<ActiveAutoplay | null>(null);
  const suppressScrollReadRef = useRef<boolean>(false);
  const lastHeroExitWrittenRef = useRef<string>("");
  const lastDiscreteRef = useRef<DiscreteSequenceState | null>(null);
  const prefersReducedMotionRef = useRef<boolean>(false);

  const rafIdRef = useRef<number | null>(null);
  const prevTickTimeRef = useRef<number>(0);
  const cacheManagerRef = useRef<FrameCacheManager<ImageBitmap> | null>(null);
  const cacheBudgetRef = useRef<AdaptiveCacheBudget>(detectAdaptiveCacheBudget());
  const warmupTriggeredRef = useRef<{ heroToMateri: boolean; materiToReading: boolean }>({
    heroToMateri: false,
    materiToReading: false,
  });

  const [isFirstFrameReady, setIsFirstFrameReady] = useState<boolean>(false);

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

    const heroEl = containerRef.current;
    scrollableHeightsRef.current.hero = heroEl
      ? Math.max(1, heroEl.offsetHeight - vh)
      : Math.round(vh * 1.5);

    const materiEl = materiContainerRef?.current;
    scrollableHeightsRef.current.materi = materiEl
      ? Math.max(1, materiEl.offsetHeight - vh)
      : Math.round(vh * 1.5);

    const readingEl = readingContainerRef?.current;
    scrollableHeightsRef.current.reading = readingEl
      ? Math.max(1, readingEl.offsetHeight - vh)
      : Math.round(vh * 2.5);

    const latihanEl = latihanContainerRef?.current;
    scrollableHeightsRef.current.latihan = latihanEl
      ? Math.max(1, latihanEl.offsetHeight - vh)
      : Math.round(vh * 2.8);
  }, [containerRef, materiContainerRef, readingContainerRef, latihanContainerRef]);

  const drawFrame = useCallback((seq: SequenceType, rawFrame: number) => {
    const cache = cacheManagerRef.current;
    const ctx = ctxRef.current;
    if (!cache || !ctx) return;

    const frame = Math.max(1, Math.min(cache.getMaxFrames(seq), Math.round(rawFrame)));
    const exactBitmap = cache.getBitmap(seq, frame);
    const bitmap = exactBitmap ?? cache.getBestBitmap(seq, frame, scrollDirectionRef.current);
    if (!bitmap) return;

    if (bitmap !== lastDrawnBitmapRef.current) {
      const bounds = drawBoundsRef.current;
      ctx.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height);
      lastDrawnBitmapRef.current = bitmap;
    }

    cache.setLastDrawn(seq, frame);
    lastDrawnSeqRef.current = seq;
    lastDrawnFrameRef.current = frame;
    lastDrawWasExactRef.current = Boolean(exactBitmap);
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

      // Idle cross-stage lookahead warmup sized to current device hardware tier
      const cache = cacheManagerRef.current;
      const headBudget = cacheBudgetRef.current.warmHeadCount;
      if (cache && seq === "hero" && isHeroAtEnd && !warmupTriggeredRef.current.heroToMateri) {
        warmupTriggeredRef.current.heroToMateri = true;
        cache.warmSequenceHead("materi", headBudget, false);
        cache.warmSequenceHead("latihan", headBudget, true);
        void cache.loadFrame("materi", totalMateriFrames, false);
        void cache.loadFrame("reading", 1, false);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan, false);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan + 1, false);
        void cache.loadFrame("latihan", totalLatihanFrames, false);
        cache.queueBlobWarmup("materi", 1, totalMateriFrames, 1);
        cache.queueBlobWarmup("latihan", 1, totalLatihanFrames, 1);
      } else if (cache && seq === "materi" && isMateriAtEnd && !warmupTriggeredRef.current.materiToReading) {
        warmupTriggeredRef.current.materiToReading = true;
        cache.warmSequenceHead("reading", Math.min(42, Math.max(headBudget, Math.round(cacheBudgetRef.current.maxActiveBitmaps * 0.4))));
        void cache.loadFrame("reading", totalReadingFrames, false);
        cache.queueBlobWarmup("reading", 1, totalReadingFrames, 1);
      }
    },
    [heroMaxFrame, totalHeroFrames, totalMateriFrames, totalReadingFrames, totalLatihanFrames]
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
        suppressScrollReadRef.current = false;
      });
    },
    [measureScrollableHeights, getMaxFrames, heroMaxFrame]
  );

  const renderLoopRef = useRef<(now: number) => void>(() => {});

  const ensureLoopActive = useCallback(() => {
    if (rafIdRef.current !== null) return;
    prevTickTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame((ts) => renderLoopRef.current(ts));
  }, []);

  const syncTargetFromWindowScroll = useCallback(() => {
    if (autoplayRef.current || suppressScrollReadRef.current) return;

    const seq = isLatihanUnlockedRef.current
      ? "latihan"
      : isReadingUnlockedRef.current
      ? "reading"
      : isMateriUnlockedRef.current
      ? "materi"
      : "hero";
    activeSequenceRef.current = seq;

    const scrollY = window.scrollY;
    if (scrollY > lastScrollYRef.current) {
      scrollDirectionRef.current = 1;
    } else if (scrollY < lastScrollYRef.current) {
      scrollDirectionRef.current = -1;
    }
    lastScrollYRef.current = scrollY;

    const nextTarget = scrollYToFrame(
      seq,
      scrollY,
      scrollableHeightsRef.current[seq],
      getMaxFrames(seq),
      heroMaxFrame
    );
    targetFramesRef.current[seq] = nextTarget;
  }, [getMaxFrames, heroMaxFrame]);

  // Persistent controller API for smooth single-rAF forward & reverse cutscenes
  useEffect(() => {
    if (!controllerRef) return;

    const controller: ScrollCanvasController = {
      playTo(sequence, rawTargetFrame, options) {
        const cache = cacheManagerRef.current;
        const maxFrames = getMaxFrames(sequence);
        const clampedTarget = Math.max(1, Math.min(maxFrames, rawTargetFrame));

        activeSequenceRef.current = sequence;
        if (options.startFrame !== undefined) {
          const clampedStart = Math.max(1, Math.min(maxFrames, options.startFrame));
          currentFramesRef.current[sequence] = clampedStart;
          targetFramesRef.current[sequence] = clampedStart;
        }

        const startFrame = currentFramesRef.current[sequence];
        const direction: 1 | -1 = clampedTarget >= startFrame ? 1 : -1;
        scrollDirectionRef.current = direction;

        if (!(options.interruptible ?? true)) {
          lenisRef.current.stop();
        } else {
          // Cancel any leftover wheel momentum cleanly before direct timeline playback
          lenisRef.current.scrollTo(window.scrollY, { immediate: true, force: true });
        }

        const now = performance.now();
        const spanFrames = Math.ceil(Math.abs(clampedTarget - startFrame));
        const primeTargetCount = Math.min(28, Math.max(1, spanFrames));
        const readyAhead = cache
          ? cache.countContiguousReady(sequence, Math.round(startFrame), direction, primeTargetCount)
          : primeTargetCount;

        autoplayRef.current = {
          sequence,
          startFrame,
          targetFrame: clampedTarget,
          startTime: now,
          durationMs: Math.max(16, options.durationMs),
          primingStartTime: readyAhead >= primeTargetCount ? null : now,
          primeTargetCount,
          maxPrimeWaitMs: 550,
          lastClockTime: now,
          stalledFrame: -1,
          currentFrameStallMs: 0,
          totalStallMs: 0,
          interruptible: options.interruptible ?? true,
          syncScrollOnComplete: options.syncScrollOnComplete ?? true,
          onComplete: options.onComplete,
        };

        if (cache) {
          const budget = cacheBudgetRef.current;
          cache.setPlaybackActive(true);
          cache.queueBlobWarmup(sequence, 1, maxFrames, 1);
          cache.reprioritizeBlobWarmup(sequence);
          cache.requestWindow(
            sequence,
            Math.round(startFrame),
            direction,
            budget.lookahead,
            budget.lookbehind
          );
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
        autoplayRef.current = null;
        suppressScrollReadRef.current = suppressScrollSync;

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
            budget.lookahead,
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
        const bitmap = await cache.loadFrame(sequence, clamped, true);
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
        lenisRef.current.start();
        requestAnimationFrame(() => {
          suppressScrollReadRef.current = false;
        });
      },

      cancelAutoplay(keepScrollLocked = false) {
        autoplayRef.current = null;
        cacheManagerRef.current?.setPlaybackActive(false);
        emitDiscreteStateIfChanged(false);
        if (keepScrollLocked) {
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
  ]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
    }

    const displayWidth = Math.max(1, window.innerWidth);
    const displayHeight = Math.max(1, window.innerHeight);
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);

    // Clamp physical canvas pixels to source WebP resolution (1920x1080) to eliminate 4x GPU fillrate waste
    const rawPhysicalW = displayWidth * rawDpr;
    const rawPhysicalH = displayHeight * rawDpr;
    const capRatio = Math.min(
      1,
      SOURCE_WIDTH / Math.max(1, rawPhysicalW),
      SOURCE_HEIGHT / Math.max(1, rawPhysicalH)
    );
    const effectiveDpr = rawDpr * capRatio;

    const physicalWidth = Math.max(1, Math.round(displayWidth * effectiveDpr));
    const physicalHeight = Math.max(1, Math.round(displayHeight * effectiveDpr));

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      lastDrawnFrameRef.current = -1;
      lastDrawnBitmapRef.current = null;
    }

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
    }

    const hRatio = physicalWidth / SOURCE_WIDTH;
    const vRatio = physicalHeight / SOURCE_HEIGHT;
    const ratio = Math.max(hRatio, vRatio);

    const drawWidth = SOURCE_WIDTH * ratio;
    const drawHeight = SOURCE_HEIGHT * ratio;
    drawBoundsRef.current = {
      x: (physicalWidth - drawWidth) / 2,
      y: (physicalHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
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

    const cache = new FrameCacheManager<ImageBitmap>(
      {
        totalHeroFrames,
        totalMateriFrames,
        totalReadingFrames,
        totalLatihanFrames,
        maxActiveBitmaps: budget.maxActiveBitmaps,
        maxCachedBlobs: budget.maxCachedBlobs,
        maxConcurrentDecodes: budget.maxConcurrentDecodes,
        maxConcurrentFetches: budget.tier === "low" ? 4 : 6,
        maxBackgroundWarms: budget.tier === "low" ? 2 : 4,
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

          // Decode-Starvation Clock Guard: hold clock momentarily instead of skipping undecoded frames
          const needsDecodeWait =
            autoplay.primingStartTime === null &&
            rawT < 1 &&
            (!lastDrawWasExactRef.current || candidateRounded !== lastDrawnFrameRef.current) &&
            !cache.hasBitmap(seq, candidateRounded) &&
            cache.isFrameBusy(seq, candidateRounded) &&
            autoplay.currentFrameStallMs < 160 &&
            autoplay.totalStallMs < 2500;

          if (needsDecodeWait) {
            autoplay.startTime += stepDt;
            autoplay.currentFrameStallMs += stepDt;
            autoplay.totalStallMs += stepDt;
            rawT = Math.min(1, (now - autoplay.startTime) / autoplay.durationMs);
            easedT = rawT >= 1 ? 1 : easeSmoothCruise(rawT);
            exactFrame =
              autoplay.startFrame + (autoplay.targetFrame - autoplay.startFrame) * easedT;
          }

          currentFramesRef.current[seq] = exactFrame;
          targetFramesRef.current[seq] = exactFrame;

          if (rawT >= 1) {
            autoplayRef.current = null;
            cache.setPlaybackActive(false);
            completedAutoplay = autoplay;
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

        if (Math.abs(diff) > 0.015) {
          isMoving = true;
          const alpha = prefersReducedMotionRef.current
            ? 1
            : 1 - Math.pow(1 - MANUAL_LERP_60HZ, dt * 60);
          currentFramesRef.current[seq] = cur + diff * alpha;
        } else if (cur !== tgt) {
          currentFramesRef.current[seq] = tgt;
        }
      }

      const activeSeq = activeSequenceRef.current;
      const currentFrame = currentFramesRef.current[activeSeq];
      const roundedFrame = Math.max(
        1,
        Math.min(getMaxFrames(activeSeq), Math.round(currentFrame))
      );

      syncHeroCssVar(activeSeq, currentFramesRef.current.hero);

      if (
        lastDrawnSeqRef.current !== activeSeq ||
        lastDrawnFrameRef.current !== roundedFrame ||
        !lastDrawWasExactRef.current
      ) {
        drawFrame(activeSeq, roundedFrame);

        if (
          lastWindowSeqRef.current !== activeSeq ||
          Math.abs(roundedFrame - lastWindowCenterRef.current) >= 3
        ) {
          const budget = cacheBudgetRef.current;
          lastWindowSeqRef.current = activeSeq;
          lastWindowCenterRef.current = roundedFrame;
          cache.requestWindow(
            activeSeq,
            roundedFrame,
            scrollDirectionRef.current,
            budget.lookahead,
            budget.lookbehind
          );
        }
      }

      emitDiscreteStateIfChanged(isMoving);

      if (completedAutoplay) {
        if (completedAutoplay.syncScrollOnComplete) {
          syncDomScrollInstant(completedAutoplay.sequence, completedAutoplay.targetFrame);
        }
        completedAutoplay.onComplete?.();
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

    // Prioritize initial hero window + boundary bridges only (no 1000-frame stampede)
    void cache.loadFrame(startSeq, initialFrame, true).then((bitmap) => {
      if (bitmap) {
        setIsFirstFrameReady(true);
        drawFrame(startSeq, initialFrame);
      }
    });

    cache.requestWindow(
      startSeq,
      initialFrame,
      1,
      budget.lookahead,
      Math.max(6, budget.lookbehind - 4)
    );
    void cache.loadFrame("hero", totalHeroFrames, false);
    void cache.loadFrame("materi", 1, false);
    void cache.loadFrame("latihan", 1, false);
    cache.queueBlobWarmup("hero", 1, totalHeroFrames, 1);
    if (budget.tier !== "low") {
      cache.queueBlobWarmup("materi", 1, totalMateriFrames, 1);
      cache.queueBlobWarmup("latihan", 1, totalLatihanFrames, 1);
    }

    syncHeroCssVar(startSeq, initialFrame);
    emitDiscreteStateIfChanged(false);

    const handleNativeScroll = () => {
      if (suppressScrollReadRef.current || autoplayRef.current) return;
      syncTargetFromWindowScroll();
      cache.setPlaybackActive(true);
      ensureLoopActive();
    };

    const handleManualInterrupt = () => {
      const activeAuto = autoplayRef.current;
      if (!activeAuto || !activeAuto.interruptible) return;

      const seq = activeAuto.sequence;
      const curFrame = currentFramesRef.current[seq];
      autoplayRef.current = null;
      cache.setPlaybackActive(false);
      syncDomScrollInstant(seq, curFrame);
      emitDiscreteStateIfChanged(false);
      ensureLoopActive();
    };

    const handleKeyInterrupt = (e: KeyboardEvent) => {
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
      handleResize();
      if (!autoplayRef.current) {
        syncTargetFromWindowScroll();
      }
      ensureLoopActive();
    };

    window.addEventListener("scroll", handleNativeScroll, { passive: true });
    window.addEventListener("wheel", handleManualInterrupt, { passive: true, capture: true });
    window.addEventListener("touchstart", handleManualInterrupt, { passive: true, capture: true });
    window.addEventListener("keydown", handleKeyInterrupt, { passive: true, capture: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener("scroll", handleNativeScroll);
      window.removeEventListener("wheel", handleManualInterrupt, { capture: true });
      window.removeEventListener("touchstart", handleManualInterrupt, { capture: true });
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
  ]);

  return (
    <div
      className="fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none bg-black pointer-events-none"
      aria-hidden="true"
    >
      {/* Pinned HTML5 Canvas — Bounded Sliding-Window ImageBitmap Renderer */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Animasi sinematik sekuens gerbang perpustakaan fantasi Aksaraloka"
        style={{ transformOrigin: "50% 68%" }}
        className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isFirstFrameReady ? "opacity-100" : "opacity-0"
        } ${isStudioBookFocused ? "scale-[1.36] -translate-y-[4%]" : "scale-100 translate-y-0"}`}
      />
      {/* Subtle edge vignette during 2D Book Focus Mode without darkening the book */}
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(3,7,18,0.02)_0%,rgba(3,7,18,0.26)_100%)] transition-opacity duration-700 ease-out ${
          isStudioBookFocused ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
