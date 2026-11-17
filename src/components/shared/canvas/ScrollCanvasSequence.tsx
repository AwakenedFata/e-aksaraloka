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

// Frame-rate normalized smoothing factors: crisp Lenis lock for small deltas, fluid glide on scrollbar jumps
const MANUAL_LERP_LENIS_LOCK_60HZ = 0.78;
const MANUAL_LERP_SCRUB_JUMP_60HZ = 0.48;
const HERO_EXIT_START_FRAME = 20;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

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
  const backdropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backdropCtxRef = useRef<CanvasRenderingContext2D | null>(null);
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
  const backdropDrawBoundsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 192,
    height: 108,
  });
  const lastBackdropBitmapRef = useRef<ImageBitmap | null>(null);
  const hasMobileAmbientBackdropRef = useRef<boolean>(false);

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

  const drawBackdropBitmap = useCallback((bitmap: ImageBitmap | null) => {
    if (!bitmap || !hasMobileAmbientBackdropRef.current) return;
    if (bitmap === lastBackdropBitmapRef.current) return;

    const backdropCanvas = backdropCanvasRef.current;
    if (!backdropCanvas) return;
    if (!backdropCtxRef.current) {
      backdropCtxRef.current = backdropCanvas.getContext("2d", {
        alpha: false,
      });
    }
    const backdropCtx = backdropCtxRef.current;
    if (!backdropCtx) return;

    const bBounds = backdropDrawBoundsRef.current;
    backdropCtx.drawImage(bitmap, bBounds.x, bBounds.y, bBounds.width, bBounds.height);
    lastBackdropBitmapRef.current = bitmap;
  }, []);

  const drawFrame = useCallback(
    (seq: SequenceType, rawFrame: number) => {
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
        drawBackdropBitmap(best.bitmap);
        lastDisplayedSourceSeqRef.current = seq;
        lastDisplayedSourceFrameRef.current = best.frame;
      }

      cache.setLastDrawn(seq, frame);
      lastDrawnSeqRef.current = seq;
      lastDrawnFrameRef.current = frame;
      lastDrawWasExactRef.current = best.exact;
    },
    [drawBackdropBitmap]
  );

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
        cache.warmSequenceHead("materi", headBudget, false);
        cache.warmSequenceHead("latihan", headBudget, true);
        void cache.loadFrame("materi", totalMateriFrames, false);
        void cache.loadFrame("reading", 1, false);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan, false);
        void cache.loadFrame("latihan", LATIHAN_SEGMENT_COUNTS.latihan + 1, false);
        void cache.loadFrame("latihan", totalLatihanFrames, false);
        cache.queueBlobWarmup("materi", 1, totalMateriFrames, warmStride);
        cache.queueBlobWarmup("latihan", 1, totalLatihanFrames, warmStride);
      } else if (cache && seq === "materi" && isMateriAtEnd && !warmupTriggeredRef.current.materiToReading) {
        warmupTriggeredRef.current.materiToReading = true;
        cache.warmSequenceHead(
          "reading",
          Math.min(42, Math.max(headBudget, Math.round(budget.maxActiveBitmaps * 0.4)))
        );
        void cache.loadFrame("reading", totalReadingFrames, false);
        cache.queueBlobWarmup("reading", 1, totalReadingFrames, warmStride);
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

        if (!(options.interruptible ?? true)) {
          lenisRef.current.stop();
        } else {
          // Cancel any leftover wheel momentum cleanly before direct timeline playback
          lenisRef.current.scrollTo(window.scrollY, { immediate: true, force: true });
        }

        const now = performance.now();
        const spanFrames = Math.ceil(Math.abs(clampedTarget - startFrame));
        const primeTargetCount = Math.min(8, Math.max(1, spanFrames));
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
          maxPrimeWaitMs: 180,
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
  ]);

  const syncBackdropCanvasSize = useCallback((displayWidth: number, displayHeight: number) => {
    const backdropCanvas = backdropCanvasRef.current;
    if (!backdropCanvas) return;

    const bgHeight = 160;
    const bgWidth = Math.max(
      64,
      Math.min(288, Math.round((bgHeight * displayWidth) / Math.max(1, displayHeight)))
    );

    if (backdropCanvas.width !== bgWidth || backdropCanvas.height !== bgHeight) {
      backdropCanvas.width = bgWidth;
      backdropCanvas.height = bgHeight;
      lastBackdropBitmapRef.current = null;
    }

    if (!backdropCtxRef.current) {
      backdropCtxRef.current = backdropCanvas.getContext("2d", {
        alpha: false,
      });
    }
    if (backdropCtxRef.current) {
      backdropCtxRef.current.imageSmoothingEnabled = true;
      backdropCtxRef.current.imageSmoothingQuality = "medium";
    }

    const bgCover = computeCoverStageMetrics(bgWidth, bgHeight, SOURCE_WIDTH, SOURCE_HEIGHT);
    backdropDrawBoundsRef.current = {
      x: bgCover.offsetX,
      y: bgCover.offsetY,
      width: bgCover.width,
      height: bgCover.height,
    };
  }, []);

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
    setViewportSize((prev) =>
      prev.width === displayWidth && prev.height === displayHeight
        ? prev
        : { width: displayWidth, height: displayHeight }
    );
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);

    // Size canvas to the full unclipped 16:9 cover stage (capped at 1920x1080) so CSS camera
    // pan/zoom reveals off-screen artwork smoothly instead of exposing black letterbox voids.
    const baseStage = computeCoverStageMetrics(
      displayWidth,
      displayHeight,
      SOURCE_WIDTH,
      SOURCE_HEIGHT
    );
    const physicalScale = Math.min(
      rawDpr,
      SOURCE_WIDTH / Math.max(1, baseStage.width),
      SOURCE_HEIGHT / Math.max(1, baseStage.height)
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

    syncBackdropCanvasSize(displayWidth, displayHeight);

    measureScrollableHeights();

    const seq = activeSequenceRef.current;
    drawFrame(seq, Math.round(currentFramesRef.current[seq]));
  }, [drawFrame, measureScrollableHeights, syncBackdropCanvasSize]);

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
        packChunks: SEQUENCE_PACK_CHUNKS,
        maxActiveBitmaps: budget.maxActiveBitmaps,
        maxCachedBlobs: budget.maxCachedBlobs,
        maxConcurrentDecodes: budget.maxConcurrentDecodes,
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

          // Fluid Buffer Pacing: gently dilate timeline progression while urgent frame decodes instead of hard 0-fps freezing
          const needsDecodeWait =
            autoplay.primingStartTime === null &&
            rawT < 1 &&
            (!lastDrawWasExactRef.current || candidateRounded !== lastDrawnFrameRef.current) &&
            !cache.hasBitmap(seq, candidateRounded) &&
            cache.isFrameBusy(seq, candidateRounded) &&
            autoplay.currentFrameStallMs < 110 &&
            autoplay.totalStallMs < 2400;

          if (needsDecodeWait) {
            autoplay.startTime += stepDt * 0.78;
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
          Math.abs(roundedFrame - lastWindowCenterRef.current) >= 2
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

    // Direct single-frame fast-path for instant frame 1 paint, while window/chunk packs stream ahead
    void cache.loadFrame(startSeq, initialFrame, true, true).then((bitmap) => {
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
    void cache.loadFrame("hero", totalHeroFrames, false, true);
    void cache.loadFrame("materi", 1, false, true);
    void cache.loadFrame("latihan", 1, false, true);
    cache.queueBlobWarmup("hero", 1, totalHeroFrames, 1);
    if (budget.tier !== "low" && !budget.isConstrainedNetwork) {
      cache.queueBlobWarmup("materi", 1, totalMateriFrames, 4);
      cache.queueBlobWarmup("latihan", 1, totalLatihanFrames, 4);
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
      autoplayRef.current = null;
      cache.setPlaybackActive(false);
      syncDomScrollInstant(seq, curFrame);
      emitDiscreteStateIfChanged(false);
      ensureLoopActive();
    };

    let touchStartPos: { x: number; y: number } | null = null;

    const handleTouchStartCapture = (e: TouchEvent) => {
      const activeAuto = autoplayRef.current;
      if (!activeAuto || !activeAuto.interruptible || e.touches.length !== 1) {
        touchStartPos = null;
        return;
      }
      const t = e.touches[0]!;
      touchStartPos = { x: t.clientX, y: t.clientY };
    };

    const handleTouchMoveInterrupt = (e: TouchEvent) => {
      if (!touchStartPos || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      const moved = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
      if (moved > 10) {
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

  const isMobilePortrait =
    viewportSize.width < 768 && viewportSize.width < viewportSize.height;
  const hasMobileAmbientBackdrop = Boolean(mobileCamera?.active && mobileCamera.zoom < 0.99);

  useEffect(() => {
    hasMobileAmbientBackdropRef.current = hasMobileAmbientBackdrop;
    if (hasMobileAmbientBackdrop) {
      syncBackdropCanvasSize(viewportSize.width, viewportSize.height);
      drawBackdropBitmap(lastDrawnBitmapRef.current);
    }
  }, [
    drawBackdropBitmap,
    hasMobileAmbientBackdrop,
    syncBackdropCanvasSize,
    viewportSize.height,
    viewportSize.width,
  ]);

  const studioFocusStyle: React.CSSProperties = isStudioBookFocused
    ? {
        transformOrigin: "50% 68%",
        transform: "translate3d(0px, -4%, 0px) scale(1.36)",
      }
    : {
        transformOrigin: "50% 50%",
        transform: "translate3d(0px, 0px, 0px) scale(1)",
      };

  const verticalFadeMask = hasMobileAmbientBackdrop
    ? "linear-gradient(to bottom, transparent 0%, black 9%, black 88%, transparent 100%)"
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

  return (
    <div
      className="fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none bg-[#030712] pointer-events-none"
      aria-hidden="true"
    >
      {isMobilePortrait && (
        <div
          className={`absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out ${
            hasMobileAmbientBackdrop && isFirstFrameReady ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Downsampled full-bleed ambient scene extension behind letterboxed 16:9 3D stages */}
          <canvas
            ref={backdropCanvasRef}
            className="h-full w-full scale-[1.14]"
            style={{ filter: "blur(26px) brightness(0.52) saturate(1.18)" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,7,18,0.62)_0%,rgba(3,7,18,0.16)_24%,rgba(3,7,18,0.12)_72%,rgba(3,7,18,0.68)_100%)]" />
        </div>
      )}
      <div
        className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={studioFocusStyle}
      >
        {/* Pinned HTML5 Canvas — Unclipped 16:9 Cover Stage ImageBitmap Renderer */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Animasi sinematik sekuens gerbang perpustakaan fantasi Aksaraloka"
          style={canvasCameraStyle}
          className={`absolute block max-w-none transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isFirstFrameReady ? "opacity-100" : "opacity-0"
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
