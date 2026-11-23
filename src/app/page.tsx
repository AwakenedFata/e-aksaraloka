"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/shared/navigation/Navbar";
import {
  ScrollCanvasSequence,
  type DiscreteSequenceState,
  type ScrollCanvasController,
} from "@/components/shared/canvas/ScrollCanvasSequence";
import { calculateAutoplayDurationMs } from "@/components/shared/canvas/sequenceEasing";
import {
  PortalTransitionOverlay,
  type PortalTransitionPhase,
  type PortalTransitionSpeed,
} from "@/components/shared/ui/PortalTransitionOverlay";
import type { SequenceType } from "@/components/shared/canvas/sequenceEasing";
import { HeroSection } from "@/components/hero/HeroSection";
import { MateriStage } from "@/components/materi/MateriStage";
import { ReadingStage } from "@/components/materi/ReadingStage";
import { MateriBookshelfButton } from "@/components/materi/MateriBookshelfButton";
import { MateriReadButton } from "@/components/materi/MateriReadButton";
import { KitabMateriOverlay } from "@/components/materi/KitabMateriOverlay";
import { LatihanHubButton } from "@/components/latihan/LatihanHubButton";
import { LatihanStage } from "@/components/latihan/LatihanStage";
import { StudioTulisStageOverlay } from "@/components/latihan/StudioTulisStageOverlay";
import { PetaHubButton } from "@/components/peta/PetaHubButton";
import { PetaPembelajaranModal } from "@/components/peta/PetaPembelajaranModal";
import { TOTAL_LATIHAN_FRAMES_DEFAULT } from "@/components/shared/canvas/frameCacheManager";
import { useLenis } from "@/components/shared/providers/SmoothScrollProvider";
import type { Mobile3dCameraTarget } from "@/lib/ui/bookHomography";
import type { GrimoireChapterId } from "@/lib/learning/narrativeCurriculumData";
import { setActiveGrimoireChapter } from "@/lib/learning/learningStore";
import {
  initAudioAutoUnlock,
  playChime,
  playPortalTransition,
  setAudioStageContext,
  stopSpeechNarration,
} from "@/lib/learning/audioEngine";

const TOTAL_HERO_FRAMES = 240;
const TOTAL_MATERI_FRAMES = 299;
const TOTAL_READING_FRAMES = 537;
const TOTAL_LATIHAN_FRAMES = TOTAL_LATIHAN_FRAMES_DEFAULT;

const PAGE_FLIP_START_FRAME = 355;
const PAGE_FLIP_END_FRAME = 445;
const PAGE_FLIP_DURATION_MS = 460;

const INITIAL_DISCRETE_STATE: DiscreteSequenceState = {
  activeSequence: "hero",
  activeAutoplayTarget: null,
  heroStep: 1,
  isHeroContentVisible: true,
  isHeroInteractive: true,
  isHeroAtEnd: false,
  isMateriAtEnd: false,
  isReadingAtEnd: false,
  isLatihanAtEnd: false,
  isScrolledPastStart: false,
};

interface PortalVisualMeta {
  readonly speed: PortalTransitionSpeed;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
}

const DEFAULT_PORTAL_META: PortalVisualMeta = {
  speed: "normal",
  eyebrow: "PORTAL PUSTAKA",
  title: "Kembali ke Ruang Pustaka",
  subtitle: "Menyelaraskan gerbang utama...",
};

/**
 * Aksaraloka — Beranda Pembelajaran Bahasa Indonesia Kelas VII.
 *
 * Implements a unified, uninterrupted cinematic journey powered by a bounded
 * sliding-window canvas pipeline and a single-rAF timeline controller:
 * 1. Stage 1 (Hero Hub, frames 1-240): Descent into Grand Library hub.
 * 2. Stage 2 (Materi Sequence, frames 1-299): Camera moves towards bookshelf.
 * 3. Stage 3 (Reading Sequence, frames 1-537): POV taking book from shelf & opening pages,
 *    followed by the interactive 3-Chapter Kitab Materi with physical page-flip animations (355-445).
 * 4. Stage 4 (Latihan Sequence, frames 1-561): POV walking through hallway to Studio Tulis desk.
 */
export default function Home() {
  const lenis = useLenis();
  const heroRef = useRef<HTMLElement | null>(null);
  const materiRef = useRef<HTMLElement | null>(null);
  const readingRef = useRef<HTMLElement | null>(null);
  const latihanRef = useRef<HTMLElement | null>(null);
  const heroOverlayRef = useRef<HTMLDivElement | null>(null);
  const canvasControllerRef = useRef<ScrollCanvasController | null>(null);

  const heroScrollHeightRef = useRef<number>(0);
  const materiScrollHeightRef = useRef<number>(0);

  const [isMateriUnlocked, setIsMateriUnlocked] = useState<boolean>(false);
  const [isReadingUnlocked, setIsReadingUnlocked] = useState<boolean>(false);
  const [isLatihanUnlocked, setIsLatihanUnlocked] = useState<boolean>(false);
  const [isReverseScrolling, setIsReverseScrolling] = useState<boolean>(false);
  const [isBookPageFlipping, setIsBookPageFlipping] = useState<boolean>(false);
  const [isKitabBookFocused, setIsKitabBookFocused] = useState<boolean>(false);
  const [kitab3dMobileSide, setKitab3dMobileSide] = useState<"left" | "right">("left");
  const [isStudioBookFocused, setIsStudioBookFocused] = useState<boolean>(false);
  const [studio3dMobileSide, setStudio3dMobileSide] = useState<"left" | "right">("left");
  const [isPetaModalOpen, setIsPetaModalOpen] = useState<boolean>(false);
  const [portalPhase, setPortalPhase] = useState<PortalTransitionPhase>("idle");
  const [portalMeta, setPortalMeta] = useState<PortalVisualMeta>(DEFAULT_PORTAL_META);
  const [sequenceState, setSequenceState] = useState<DiscreteSequenceState>(INITIAL_DISCRETE_STATE);

  const isMountedRef = useRef<boolean>(true);
  const portalRunIdRef = useRef<number>(0);
  const portalTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const portalRafsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    const cleanupAudio = initAudioAutoUnlock();
    const timers = portalTimersRef.current;
    const rafs = portalRafsRef.current;
    return () => {
      isMountedRef.current = false;
      cleanupAudio();
      stopSpeechNarration();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const id of rafs) cancelAnimationFrame(id);
      rafs.clear();
    };
  }, []);

  const handleDiscreteStateChange = useCallback((nextState: DiscreteSequenceState) => {
    setSequenceState(nextState);
  }, []);

  /**
   * Enter Materi sequence via the Bookshelf CTA button at Hero Frame 240.
   * Calibrated strictly below 60 Hz (~58.2 FPS peak cruise) for zero V-sync frame-skipping.
   */
  const handleEnterMateri = useCallback(() => {
    if (heroRef.current && heroRef.current.offsetHeight > 0) {
      heroScrollHeightRef.current = heroRef.current.offsetHeight - window.innerHeight;
    }

    stopSpeechNarration();
    playPortalTransition();
    setIsPetaModalOpen(false);
    setIsKitabBookFocused(false);
    setIsStudioBookFocused(false);
    setIsMateriUnlocked(true);
    setIsReadingUnlocked(false);
    setIsLatihanUnlocked(false);
    setSequenceState((prev) => ({
      ...prev,
      activeSequence: "materi",
      isHeroAtEnd: true,
      isMateriAtEnd: false,
      isReadingAtEnd: false,
      isLatihanAtEnd: false,
      isScrolledPastStart: true,
    }));

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    lenis.scrollTo(0, { immediate: true, force: true });

    canvasControllerRef.current?.playTo("materi", TOTAL_MATERI_FRAMES, {
      startFrame: 1,
      durationMs: 4983,
      interruptible: true,
      syncScrollOnComplete: true,
    });
  }, [lenis]);

  /**
   * Enter Latihan sequence via the Latihan Hub button at Hero Frame 240.
   * Seamlessly traverses latihan-frames (1-185) -> hallway-frames (186-373) -> studio-tulis-frames (374-561)
   * at locked 60 FPS (1:1 VSync hardware cadence).
   */
  const handleEnterLatihan = useCallback(() => {
    if (heroRef.current && heroRef.current.offsetHeight > 0) {
      heroScrollHeightRef.current = heroRef.current.offsetHeight - window.innerHeight;
    }

    stopSpeechNarration();
    playPortalTransition();
    setIsPetaModalOpen(false);
    setIsKitabBookFocused(false);
    setIsStudioBookFocused(false);
    setIsLatihanUnlocked(true);
    setIsMateriUnlocked(false);
    setIsReadingUnlocked(false);
    setSequenceState((prev) => ({
      ...prev,
      activeSequence: "latihan",
      isHeroAtEnd: true,
      isMateriAtEnd: false,
      isReadingAtEnd: false,
      isLatihanAtEnd: false,
      isScrolledPastStart: true,
    }));

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    lenis.scrollTo(0, { immediate: true, force: true });

    canvasControllerRef.current?.playTo("latihan", TOTAL_LATIHAN_FRAMES, {
      startFrame: 1,
      durationMs: 9350,
      interruptible: true,
      syncScrollOnComplete: true,
    });
  }, [lenis]);

  /**
   * Enter Reading sequence via the Read Book CTA button at Materi Frame 299 (locked 60 FPS).
   */
  const handleEnterReading = useCallback(() => {
    if (materiRef.current && materiRef.current.offsetHeight > 0) {
      materiScrollHeightRef.current = materiRef.current.offsetHeight - window.innerHeight;
    }

    stopSpeechNarration();
    playPortalTransition();
    setIsKitabBookFocused(false);
    setIsReadingUnlocked(true);
    setSequenceState((prev) => ({
      ...prev,
      activeSequence: "reading",
      isHeroAtEnd: true,
      isMateriAtEnd: true,
      isReadingAtEnd: false,
      isScrolledPastStart: true,
    }));

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    lenis.scrollTo(0, { immediate: true, force: true });

    canvasControllerRef.current?.playTo("reading", TOTAL_READING_FRAMES, {
      startFrame: 1,
      durationMs: 8950,
      interruptible: true,
      syncScrollOnComplete: true,
    });
  }, [lenis]);

  /**
   * Physical Book Page-Flip Animation using reading-frames 355-445.
   * Temporarily hides the Kitab overlay text while replaying the 3D hand page-turn frames
   * on the background canvas, then snaps cleanly back to reading-frames 537.
   */
  const handleTriggerBookPageFlip = useCallback(
    (direction: "next" | "prev", onFlipped: () => void) => {
      const controller = canvasControllerRef.current;
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!controller || reducedMotion || isBookPageFlipping) {
        onFlipped();
        return;
      }

      setIsBookPageFlipping(true);
      const startFrame =
        direction === "next" ? PAGE_FLIP_START_FRAME : PAGE_FLIP_END_FRAME;
      const targetFrame =
        direction === "next" ? PAGE_FLIP_END_FRAME : PAGE_FLIP_START_FRAME;

      controller.playTo("reading", targetFrame, {
        startFrame,
        durationMs: PAGE_FLIP_DURATION_MS,
        interruptible: false,
        syncScrollOnComplete: false,
        onComplete: () => {
          onFlipped();
          controller.snapTo("reading", TOTAL_READING_FRAMES, true);
          const scrollTarget =
            controller.getScrollableHeight("reading") ||
            Math.round(window.innerHeight * 3.4);
          controller.releaseScrollSync(scrollTarget);
          setIsBookPageFlipping(false);
        },
      });
    },
    [isBookPageFlipping]
  );

  /**
   * Reverse auto-playback from Reading back to Materi Frame 299.
   */
  const handleReverseToMateri = useCallback(() => {
    if (!isReadingUnlocked || isReverseScrolling || isBookPageFlipping) return;

    stopSpeechNarration();
    playChime();
    const controller = canvasControllerRef.current;
    const currentFrame = controller?.getCurrentFrame("reading") ?? TOTAL_READING_FRAMES;

    const returnToMateriHub = () => {
      controller?.snapTo("materi", TOTAL_MATERI_FRAMES, true);

      setIsKitabBookFocused(false);
      setIsReadingUnlocked(false);
      setIsReverseScrolling(false);
      setSequenceState((prev) => ({
        ...prev,
        activeSequence: "materi",
        isHeroAtEnd: true,
        isMateriAtEnd: true,
        isReadingAtEnd: false,
        isScrolledPastStart: true,
      }));

      // Wait for React to swap ReadingStage -> MateriStage before restoring DOM scrollY
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const materiScrollable = materiRef.current
            ? Math.max(1, materiRef.current.offsetHeight - window.innerHeight)
            : materiScrollHeightRef.current > 0
              ? materiScrollHeightRef.current
              : Math.round(window.innerHeight * 2.2);

          controller?.releaseScrollSync(materiScrollable);
        });
      });
    };

    if (currentFrame > 1.5 && controller) {
      const reverseDurationMs = calculateAutoplayDurationMs(
        currentFrame,
        1,
        TOTAL_READING_FRAMES,
        8950,
        2000
      );

      setIsReverseScrolling(true);
      controller.playTo("reading", 1, {
        durationMs: reverseDurationMs,
        interruptible: false,
        syncScrollOnComplete: false,
        onComplete: returnToMateriHub,
      });
    } else {
      returnToMateriHub();
    }
  }, [isReadingUnlocked, isReverseScrolling, isBookPageFlipping]);

  /**
   * Shared portal transition runner: smooth fade-out -> animated astrolabe veil while
   * decoding target frame & syncing DOM scroll -> smooth fade-in onto destination.
   */
  const runPortalJump = useCallback(
    async (params: {
      readonly targetSequence: SequenceType;
      readonly targetFrame: number;
      readonly meta: PortalVisualMeta;
      readonly applyStageState: () => void;
    }) => {
      if (isReverseScrolling || portalPhase !== "idle") return;

      stopSpeechNarration();
      playPortalTransition();
      const runId = ++portalRunIdRef.current;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const isFast = params.meta.speed === "fast";
      const fadeOutMs = reducedMotion ? 110 : isFast ? 210 : 440;
      const loadingMinMs = reducedMotion ? 140 : isFast ? 220 : 760;
      const fadeInMs = reducedMotion ? 120 : isFast ? 250 : 540;

      const waitMs = (ms: number) =>
        new Promise<void>((resolve) => {
          const id = setTimeout(() => {
            portalTimersRef.current.delete(id);
            resolve();
          }, ms);
          portalTimersRef.current.add(id);
        });

      const nextRaf = () =>
        new Promise<void>((resolve) => {
          const id = requestAnimationFrame(() => {
            portalRafsRef.current.delete(id);
            resolve();
          });
          portalRafsRef.current.add(id);
        });

      const controller = canvasControllerRef.current;
      setPortalMeta(params.meta);
      setIsReverseScrolling(true);
      setPortalPhase("fading-out");
      controller?.cancelAutoplay(true);

      await waitMs(fadeOutMs);
      if (!isMountedRef.current || portalRunIdRef.current !== runId) return;

      setPortalPhase("loading");

      const targetReadyPromise = controller
        ? controller.prepareFrame(params.targetSequence, params.targetFrame)
        : Promise.resolve(true);

      controller?.snapTo(params.targetSequence, params.targetFrame, true);
      params.applyStageState();

      await nextRaf();
      await nextRaf();
      if (!isMountedRef.current || portalRunIdRef.current !== runId) return;

      const scrollTarget =
        controller?.getScrollableHeight(params.targetSequence) ??
        Math.round(window.innerHeight * 1.5);
      window.scrollTo({ top: scrollTarget, behavior: "instant" as ScrollBehavior });

      await Promise.all([targetReadyPromise, waitMs(loadingMinMs)]);
      if (!isMountedRef.current || portalRunIdRef.current !== runId) return;

      setPortalPhase("fading-in");
      await waitMs(fadeInMs);
      if (!isMountedRef.current || portalRunIdRef.current !== runId) return;

      controller?.releaseScrollSync(scrollTarget);
      setPortalPhase("idle");
      setIsReverseScrolling(false);
    },
    [isReverseScrolling, portalPhase]
  );

  /**
   * Direct portal return from Menu Latihan back to Hero Frame 240 (Hub Menu).
   */
  const handleReturnFromLatihanToHero = useCallback(() => {
    if (!isLatihanUnlocked) return;
    void runPortalJump({
      targetSequence: "hero",
      targetFrame: TOTAL_HERO_FRAMES,
      meta: DEFAULT_PORTAL_META,
      applyStageState: () => {
        setIsKitabBookFocused(false);
        setIsStudioBookFocused(false);
        setIsMateriUnlocked(false);
        setIsReadingUnlocked(false);
        setIsLatihanUnlocked(false);
        setSequenceState({
          activeSequence: "hero",
          activeAutoplayTarget: null,
          heroStep: 3,
          isHeroContentVisible: false,
          isHeroInteractive: false,
          isHeroAtEnd: true,
          isMateriAtEnd: false,
          isReadingAtEnd: false,
          isLatihanAtEnd: false,
          isScrolledPastStart: true,
        });
      },
    });
  }, [isLatihanUnlocked, runPortalJump]);

  /**
   * Fast-travel directly to a specific Babak inside Kitab Materi (reading-frames 537).
   */
  const handleJumpToKitabChapter = useCallback(
    (chapter: GrimoireChapterId) => {
      setIsPetaModalOpen(false);
      if (isReadingUnlocked && sequenceState.isReadingAtEnd && !isReverseScrolling) {
        setActiveGrimoireChapter(chapter);
        setIsKitabBookFocused(true);
        return;
      }

      setActiveGrimoireChapter(chapter);
      void runPortalJump({
        targetSequence: "reading",
        targetFrame: TOTAL_READING_FRAMES,
        meta: {
          speed: "fast",
          eyebrow: "LOMPATAN PUSTAKA",
          title: "Pustaka Aksaraloka",
          subtitle: "Membuka lembaran babak materi naratif...",
        },
        applyStageState: () => {
          setIsKitabBookFocused(true);
          setIsStudioBookFocused(false);
          setIsMateriUnlocked(true);
          setIsReadingUnlocked(true);
          setIsLatihanUnlocked(false);
          setSequenceState({
            activeSequence: "reading",
            activeAutoplayTarget: null,
            heroStep: 3,
            isHeroContentVisible: false,
            isHeroInteractive: false,
            isHeroAtEnd: true,
            isMateriAtEnd: true,
            isReadingAtEnd: true,
            isLatihanAtEnd: false,
            isScrolledPastStart: true,
          });
        },
      });
    },
    [
      isReadingUnlocked,
      sequenceState.isReadingAtEnd,
      isReverseScrolling,
      runPortalJump,
    ]
  );

  /**
   * Navigate to Studio Tulis:
   * - If currently at the Hero Hub (Frame 240), triggers the 3D corridor walkthrough.
   * - Otherwise, performs a fast portal jump directly to Studio Tulis (Frame 561).
   */
  const handleNavigateToStudioTulis = useCallback(() => {
    setIsPetaModalOpen(false);
    setIsKitabBookFocused(false);
    if (isLatihanUnlocked && sequenceState.isLatihanAtEnd) return;

    const isAtHeroHub =
      !isMateriUnlocked &&
      !isReadingUnlocked &&
      !isLatihanUnlocked &&
      sequenceState.isHeroAtEnd;

    if (isAtHeroHub) {
      handleEnterLatihan();
      return;
    }

    void runPortalJump({
      targetSequence: "latihan",
      targetFrame: TOTAL_LATIHAN_FRAMES,
      meta: {
        speed: "fast",
        eyebrow: "LOMPATAN PUSTAKA",
        title: "Meja Studio Tulis",
        subtitle: "Menyiapkan ruang menulis mandiri...",
      },
      applyStageState: () => {
        setIsKitabBookFocused(false);
        setIsStudioBookFocused(false);
        setIsLatihanUnlocked(true);
        setIsMateriUnlocked(false);
        setIsReadingUnlocked(false);
        setSequenceState({
          activeSequence: "latihan",
          activeAutoplayTarget: null,
          heroStep: 3,
          isHeroContentVisible: false,
          isHeroInteractive: false,
          isHeroAtEnd: true,
          isMateriAtEnd: false,
          isReadingAtEnd: false,
          isLatihanAtEnd: true,
          isScrolledPastStart: true,
        });
      },
    });
  }, [
    isLatihanUnlocked,
    isMateriUnlocked,
    isReadingUnlocked,
    sequenceState.isLatihanAtEnd,
    sequenceState.isHeroAtEnd,
    handleEnterLatihan,
    runPortalJump,
  ]);

  /**
   * Fast skip ("Lewati Animasi ->", < 0.8s) jumping straight to the destination frame
   * of an active forward autoplay sequence via PortalTransitionOverlay.
   */
  const handleSkipAutoplay = useCallback(() => {
    const targetSeq = sequenceState.activeAutoplayTarget;
    if (!targetSeq) return;

    const configs: Record<
      SequenceType,
      { frame: number; meta: PortalVisualMeta; applyStageState: () => void }
    > = {
      latihan: {
        frame: TOTAL_LATIHAN_FRAMES,
        meta: {
          speed: "fast",
          eyebrow: "LOMPATAN PUSTAKA",
          title: "Meja Studio Tulis",
          subtitle: "Menyiapkan ruang menulis mandiri...",
        },
        applyStageState: () => {
          setIsLatihanUnlocked(true);
          setIsMateriUnlocked(false);
          setIsReadingUnlocked(false);
          setSequenceState({
            activeSequence: "latihan",
            activeAutoplayTarget: null,
            heroStep: 3,
            isHeroContentVisible: false,
            isHeroInteractive: false,
            isHeroAtEnd: true,
            isMateriAtEnd: false,
            isReadingAtEnd: false,
            isLatihanAtEnd: true,
            isScrolledPastStart: true,
          });
        },
      },
      reading: {
        frame: TOTAL_READING_FRAMES,
        meta: {
          speed: "fast",
          eyebrow: "LOMPATAN PUSTAKA",
          title: "Pustaka Aksaraloka",
          subtitle: "Membuka halaman materi bacaan...",
        },
        applyStageState: () => {
          setIsMateriUnlocked(true);
          setIsReadingUnlocked(true);
          setIsLatihanUnlocked(false);
          setSequenceState({
            activeSequence: "reading",
            activeAutoplayTarget: null,
            heroStep: 3,
            isHeroContentVisible: false,
            isHeroInteractive: false,
            isHeroAtEnd: true,
            isMateriAtEnd: true,
            isReadingAtEnd: true,
            isLatihanAtEnd: false,
            isScrolledPastStart: true,
          });
        },
      },
      materi: {
        frame: TOTAL_MATERI_FRAMES,
        meta: {
          speed: "fast",
          eyebrow: "LOMPATAN PUSTAKA",
          title: "Rak Pustaka Materi",
          subtitle: "Menuju rak bacaan utama...",
        },
        applyStageState: () => {
          setIsMateriUnlocked(true);
          setIsReadingUnlocked(false);
          setIsLatihanUnlocked(false);
          setSequenceState({
            activeSequence: "materi",
            activeAutoplayTarget: null,
            heroStep: 3,
            isHeroContentVisible: false,
            isHeroInteractive: false,
            isHeroAtEnd: true,
            isMateriAtEnd: true,
            isReadingAtEnd: false,
            isLatihanAtEnd: false,
            isScrolledPastStart: true,
          });
        },
      },
      hero: {
        frame: TOTAL_HERO_FRAMES,
        meta: {
          speed: "fast",
          eyebrow: "LOMPATAN PUSTAKA",
          title: "Ruang Pustaka Utama",
          subtitle: "Menuju pusat pilihan menu...",
        },
        applyStageState: () => {
          setIsMateriUnlocked(false);
          setIsReadingUnlocked(false);
          setIsLatihanUnlocked(false);
          setSequenceState({
            activeSequence: "hero",
            activeAutoplayTarget: null,
            heroStep: 3,
            isHeroContentVisible: false,
            isHeroInteractive: false,
            isHeroAtEnd: true,
            isMateriAtEnd: false,
            isReadingAtEnd: false,
            isLatihanAtEnd: false,
            isScrolledPastStart: true,
          });
        },
      },
    };

    const chosen = configs[targetSeq];
    void runPortalJump({
      targetSequence: targetSeq,
      targetFrame: chosen.frame,
      meta: chosen.meta,
      applyStageState: chosen.applyStageState,
    });
  }, [sequenceState.activeAutoplayTarget, runPortalJump]);

  /**
   * Return back to Hero Frame 240:
   * - From Latihan: smooth fade-out -> astrolabe loader -> fade-in direct skip to Hub.
   * - From Materi: locked reverse playback back to Hero Frame 240.
   */
  const handleReverseToHero = useCallback(() => {
    if (isLatihanUnlocked) {
      handleReturnFromLatihanToHero();
      return;
    }
    if (!isMateriUnlocked || isReverseScrolling) return;

    playChime();
    const controller = canvasControllerRef.current;
    const currentFrame = controller?.getCurrentFrame("materi") ?? TOTAL_MATERI_FRAMES;

    const returnToHeroHub = () => {
      controller?.snapTo("hero", TOTAL_HERO_FRAMES, true);

      setIsMateriUnlocked(false);
      setIsReadingUnlocked(false);
      setIsLatihanUnlocked(false);
      setIsReverseScrolling(false);
      setSequenceState({
        activeSequence: "hero",
        activeAutoplayTarget: null,
        heroStep: 3,
        isHeroContentVisible: false,
        isHeroInteractive: false,
        isHeroAtEnd: true,
        isMateriAtEnd: false,
        isReadingAtEnd: false,
        isLatihanAtEnd: false,
        isScrolledPastStart: true,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const heroScrollable = heroRef.current
            ? Math.max(1, heroRef.current.offsetHeight - window.innerHeight)
            : heroScrollHeightRef.current > 0
              ? heroScrollHeightRef.current
              : Math.round(window.innerHeight * 2.0);

          controller?.releaseScrollSync(heroScrollable);
        });
      });
    };

    if (currentFrame > 1.5 && controller) {
      const reverseDurationMs = calculateAutoplayDurationMs(
        currentFrame,
        1,
        TOTAL_MATERI_FRAMES,
        4983,
        1500
      );

      setIsReverseScrolling(true);
      controller.playTo("materi", 1, {
        durationMs: reverseDurationMs,
        interruptible: false,
        syncScrollOnComplete: false,
        onComplete: returnToHeroHub,
      });
    } else {
      returnToHeroHub();
    }
  }, [isLatihanUnlocked, isMateriUnlocked, isReverseScrolling, handleReturnFromLatihanToHero]);

  /**
   * Smoothly play from current Hero frame to Hero Frame 240 (locked 60 FPS).
   */
  const handleNavigateToHub = useCallback(() => {
    if (isMateriUnlocked || isReadingUnlocked || isLatihanUnlocked || isReverseScrolling) return;
    const controller = canvasControllerRef.current;
    if (!controller) return;

    const curFrame = controller.getCurrentFrame("hero");
    playChime();
    const durationMs = calculateAutoplayDurationMs(
      curFrame,
      TOTAL_HERO_FRAMES,
      TOTAL_HERO_FRAMES,
      4000,
      800
    );

    controller.playTo("hero", TOTAL_HERO_FRAMES, {
      durationMs,
      interruptible: true,
      syncScrollOnComplete: true,
    });
  }, [isMateriUnlocked, isReadingUnlocked, isLatihanUnlocked, isReverseScrolling]);

  /**
   * Smoothly return from Hero hub/midway back to Hero Frame 1 (locked 60 FPS).
   */
  const handleNavigateToTop = useCallback(() => {
    if (isMateriUnlocked || isReadingUnlocked || isLatihanUnlocked || isReverseScrolling) return;
    const controller = canvasControllerRef.current;
    if (!controller) return;

    const curFrame = controller.getCurrentFrame("hero");
    if (curFrame <= 1.1) return;

    playChime();
    const durationMs = calculateAutoplayDurationMs(curFrame, 1, TOTAL_HERO_FRAMES, 4000, 800);
    controller.playTo("hero", 1, {
      durationMs,
      interruptible: true,
      syncScrollOnComplete: true,
    });
  }, [isMateriUnlocked, isReadingUnlocked, isLatihanUnlocked, isReverseScrolling]);

  const activeStage = isLatihanUnlocked
    ? "latihan"
    : isReadingUnlocked
    ? "reading"
    : isMateriUnlocked
    ? "materi"
    : "hero";

  useEffect(() => {
    setAudioStageContext(activeStage);
  }, [activeStage]);
  const isStudioOverlayVisible =
    isLatihanUnlocked &&
    sequenceState.isLatihanAtEnd &&
    !isReverseScrolling &&
    portalPhase === "idle";

  const isStudioZenFocusActive = isStudioOverlayVisible && isStudioBookFocused;
  const isKitabOverlayVisible =
    isReadingUnlocked &&
    (sequenceState.isReadingAtEnd || isBookPageFlipping) &&
    !isReverseScrolling &&
    portalPhase === "idle";
  const isKitabZenFocusActive =
    isKitabOverlayVisible && isKitabBookFocused && !isBookPageFlipping;
  const isAnyBookZenFocusActive = isStudioZenFocusActive || isKitabZenFocusActive;

  const mobile3dCameraTarget: Mobile3dCameraTarget =
    isKitabOverlayVisible && !isKitabBookFocused
      ? kitab3dMobileSide === "left"
        ? "kitab-left"
        : "kitab-right"
      : isStudioOverlayVisible && !isStudioBookFocused
        ? studio3dMobileSide === "left"
          ? "studio-left"
          : "studio-right"
        : "none";

  const showBackButton =
    (isMateriUnlocked || isReadingUnlocked || isLatihanUnlocked) &&
    !isAnyBookZenFocusActive &&
    !isReverseScrolling &&
    !isBookPageFlipping &&
    portalPhase === "idle";
  const showSkipAutoplayButton =
    sequenceState.activeAutoplayTarget !== null &&
    !isReverseScrolling &&
    !isBookPageFlipping &&
    portalPhase === "idle";
  const isHubExited = isMateriUnlocked || isReadingUnlocked || isLatihanUnlocked;

  return (
    <div className="relative min-h-dvh bg-[#030712] text-stone-100 flex flex-col justify-between selection:bg-[#cda250]/30 selection:text-[#f4d993]">
      <PortalTransitionOverlay
        phase={portalPhase}
        speed={portalMeta.speed}
        eyebrow={portalMeta.eyebrow}
        title={portalMeta.title}
        subtitle={portalMeta.subtitle}
      />

      {/* Global Persistent Fixed Background: Bounded Sliding-Window Canvas */}
      <ScrollCanvasSequence
        isMateriUnlocked={isMateriUnlocked}
        isReadingUnlocked={isReadingUnlocked}
        isLatihanUnlocked={isLatihanUnlocked}
        isReverseScrolling={isReverseScrolling}
        isStudioBookFocused={isAnyBookZenFocusActive}
        isScrollLocked={isAnyBookZenFocusActive || isPetaModalOpen}
        mobile3dCameraTarget={mobile3dCameraTarget}
        containerRef={heroRef}
        materiContainerRef={materiRef}
        readingContainerRef={readingRef}
        latihanContainerRef={latihanRef}
        heroOverlayRef={heroOverlayRef}
        controllerRef={canvasControllerRef}
        heroMaxFrame={50}
        totalHeroFrames={TOTAL_HERO_FRAMES}
        totalMateriFrames={TOTAL_MATERI_FRAMES}
        totalReadingFrames={TOTAL_READING_FRAMES}
        totalLatihanFrames={TOTAL_LATIHAN_FRAMES}
        onDiscreteStateChange={handleDiscreteStateChange}
      />

      {/* Main Landmark: Scroll track placed behind interactive overlays; pointer-events disabled once hub exited */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative outline-none ${
          isHubExited ? "pointer-events-none z-0" : "z-10"
        }`}
      >
        {/* Stage 1: Hero Scroll Track (frames 1-240) */}
        <div
          className={
            isHubExited
              ? "pointer-events-none invisible absolute inset-x-0 top-0 opacity-0"
              : "relative block"
          }
          aria-hidden={isHubExited}
        >
          <HeroSection
            containerRef={heroRef}
            heroOverlayRef={heroOverlayRef}
            currentStep={sequenceState.heroStep}
            isHeroContentVisible={sequenceState.isHeroContentVisible}
            isHeroInteractive={sequenceState.isHeroInteractive}
            isHeroAtEnd={sequenceState.isHeroAtEnd}
            isMateriUnlocked={isHubExited}
            onNavigateToHub={handleNavigateToHub}
          />
        </div>

        {/* Stage 2: Materi Exploration Track (frames 1-299) */}
        {isMateriUnlocked && !isReadingUnlocked && <MateriStage containerRef={materiRef} />}

        {/* Stage 3: Reading Exploration Track (frames 1-537) */}
        {isReadingUnlocked && <ReadingStage containerRef={readingRef} />}

        {/* Menu Latihan Exploration Track (frames 1-561: latihan -> hallway -> studio-tulis) */}
        {isLatihanUnlocked && <LatihanStage containerRef={latihanRef} />}
      </main>

      {/* Navigation Header */}
      <Navbar
        activeStage={activeStage}
        isHeroAtEnd={sequenceState.isHeroAtEnd}
        isReverseScrolling={isReverseScrolling}
        isScrolledPastStart={sequenceState.isScrolledPastStart}
        isHidden={isAnyBookZenFocusActive}
        onReturnToHero={handleReverseToHero}
        onReturnToMateri={handleReverseToMateri}
        onNavigateToHub={handleNavigateToHub}
        onNavigateToTop={handleNavigateToTop}
        onOpenKitabChapter={handleJumpToKitabChapter}
        onNavigateToStudioTulis={handleNavigateToStudioTulis}
        onOpenPetaModal={() => setIsPetaModalOpen(true)}
      />

      {/* Contextual Back Button placed directly beneath the Navbar Brand Logo */}
      <div
        className={`fixed top-16 sm:top-20 lg:top-22 left-4 sm:left-8 lg:left-12 2xl:left-16 z-50 transition-all duration-500 ${
          showBackButton
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 -translate-x-3 pointer-events-none"
        }`}
        aria-hidden={!showBackButton}
      >
        <button
          type="button"
          onClick={isReadingUnlocked ? handleReverseToMateri : handleReverseToHero}
          disabled={!showBackButton}
          className="group flex items-center gap-2.5 rounded-full border border-[#cda250]/45 bg-[#030712]/92 hover:bg-[#071324] px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-medium text-stone-200 hover:text-[#f4d993] shadow-[0_8px_32px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition-all duration-300 hover:border-[#f4d993]/80 hover:-translate-x-1 hover:shadow-[0_12px_36px_rgba(205,162,80,0.25)] focus-visible:outline-2 focus-visible:outline-[#f4d993] cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          aria-label={isReadingUnlocked ? "Kembali ke Rak Buku" : "Kembali ke Ruang Pustaka"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          <span className="font-brand tracking-wider uppercase text-[11px] sm:text-xs">
            {isReadingUnlocked ? "Rak Buku" : "Ruang Pustaka"}
          </span>
        </button>
      </div>

      {/* Fast Skip Capsule ("Lewati Animasi ->") shown gracefully during forward autoplay */}
      <div
        className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 lg:bottom-10 lg:right-12 z-40 transition-all duration-300 ${
          showSkipAutoplayButton
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        aria-hidden={!showSkipAutoplayButton}
      >
        <button
          type="button"
          onClick={handleSkipAutoplay}
          disabled={!showSkipAutoplayButton}
          className="group flex items-center gap-2.5 rounded-full border border-[#cda250]/50 bg-[#030712]/90 hover:bg-[#071324] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium text-stone-200 hover:text-[#f4d993] shadow-[0_8px_32px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition-all duration-300 hover:border-[#f4d993]/85 hover:translate-x-0.5 hover:shadow-[0_12px_36px_rgba(205,162,80,0.28)] focus-visible:outline-2 focus-visible:outline-[#f4d993] cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          aria-label="Lewati animasi perjalanan menuju tujuan akhir"
        >
          <span className="font-brand tracking-wider uppercase text-[11px] sm:text-xs">
            Lewati Animasi
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-4 w-4 text-[#f4d993] transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </button>
      </div>

      {/* Stage 1: Hero Hub Interactive Discovery Buttons situated at Hero Frame 240 */}
      {!isHubExited && (
        <div
          className="fixed inset-0 z-30 pointer-events-none select-none"
          aria-hidden={!sequenceState.isHeroAtEnd}
        >
          <MateriBookshelfButton
            isHeroAtEnd={sequenceState.isHeroAtEnd}
            onEnterMateri={handleEnterMateri}
          />
          <LatihanHubButton
            isHeroAtEnd={sequenceState.isHeroAtEnd}
            onSelect={handleEnterLatihan}
          />
          <PetaHubButton
            isHeroAtEnd={sequenceState.isHeroAtEnd}
            onSelect={() => {
              playChime();
              setIsPetaModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Stage 2: Read Book Interactive Discovery Overlay situated at Materi Frame 299 */}
      {isMateriUnlocked && !isReadingUnlocked && (
        <div
          className="fixed inset-0 z-30 pointer-events-none select-none"
          aria-hidden={!sequenceState.isMateriAtEnd}
        >
          <MateriReadButton
            isMateriAtEnd={sequenceState.isMateriAtEnd}
            onEnterReading={handleEnterReading}
          />
        </div>
      )}

      {/* Stage 3: Interactive 3-Chapter Kitab Materi Overlay situated at Reading Frame 537 */}
      <KitabMateriOverlay
        isVisible={isKitabOverlayVisible}
        isBookFocused={isKitabBookFocused}
        onSetBookFocused={setIsKitabBookFocused}
        isPageFlipping={isBookPageFlipping}
        onTriggerPageFlip={handleTriggerBookPageFlip}
        mobile3dSide={kitab3dMobileSide}
        onChangeMobile3dSide={setKitab3dMobileSide}
        onOpenPetaModal={() => setIsPetaModalOpen(true)}
        onNavigateToStudioTulis={handleNavigateToStudioTulis}
      />

      {/* Stage 4: Interactive Studio Tulis Readiness Overlay situated at Latihan Frame 561 */}
      <StudioTulisStageOverlay
        isVisible={isStudioOverlayVisible}
        isBookFocused={isStudioBookFocused}
        onSetBookFocused={setIsStudioBookFocused}
        mobile3dSide={studio3dMobileSide}
        onChangeMobile3dSide={setStudio3dMobileSide}
        onJumpToKitabChapter={handleJumpToKitabChapter}
        onOpenPetaModal={() => setIsPetaModalOpen(true)}
      />

      {/* Interactive Astrolabe Peta Pembelajaran, Side-Quest & Printable LKS Modal */}
      <PetaPembelajaranModal
        isOpen={isPetaModalOpen}
        onClose={() => setIsPetaModalOpen(false)}
        onJumpToGrimoireChapter={handleJumpToKitabChapter}
        onJumpToStudio={handleNavigateToStudioTulis}
      />
    </div>
  );
}
