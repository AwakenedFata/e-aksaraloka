"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ParchmentInkFilters,
  ParchmentSpineShadowOverlay,
} from "@/components/shared/ParchmentInkFilters";
import { BookHomographyCalibrator } from "@/components/shared/BookHomographyCalibrator";
import { ParchmentSelect } from "@/components/shared/ui/ParchmentSelect";
import {
  buildPageDisplacementSpec,
  computeCoverStageMetrics,
  computeHomographyMatrix3d,
  computeMobile3dCameraTransform,
  READING_2D_DEFAULT_CALIBRATION,
  READING_BOOK_DEFAULT_CALIBRATION,
  STAGE_SOURCE_HEIGHT,
  STAGE_SOURCE_WIDTH,
  type BookSpreadCalibration,
  type CoverStageMetrics,
  type Quad2D,
} from "@/lib/ui/bookHomography";
import {
  type GrimoireChapterId,
  BOLA_WAKTU_AMANAT_OPTIONS,
  BOLA_WAKTU_AUDIO_SCRIPT,
  BOLA_WAKTU_DISPLAY_ORDER_IDS,
  BOLA_WAKTU_PLOT_BEATS,
  CHARACTER_EVIDENCE_CHALLENGES,
  DIALOGUE_TRANSMUTATION_CHALLENGES,
  EMAS_POUCH_DISPLAY_ORDER_IDS,
  EMAS_POUCH_STEPS,
  FANTASY_LEXICON_BANK,
  MAJAS_ASOSIASI_CHALLENGES,
  MAO_EMAS_AUDIO_SCRIPT,
  MISI_BAHASA_AUDIO_SCRIPT,
  PEMBUKA_PUSTAKA_AUDIO_SCRIPT,
  SENSORY_UPGRADE_CHALLENGES,
} from "@/lib/learning/narrativeCurriculumData";
import {
  isAmanatCorrect,
  isCharacterEvidenceComplete,
  isDialogueComplete,
  isMajasComplete,
  isPlotOrderCorrect,
  isPouchOrderComplete,
  isSensoryComplete,
  markGrimoireIntroOpened,
  setActiveGrimoireChapter,
  updateLearningState,
  useAksaralokaLearning,
} from "@/lib/learning/learningStore";
import {
  type NarrationTrackId,
  getActiveNarrationTrackSnapshot,
  playChime,
  playErrorTone,
  playPageFlip,
  playSealUnlock,
  stopSpeechNarration,
  subscribeAudioState,
  toggleNarrationTrack,
} from "@/lib/learning/audioEngine";

export interface KitabMateriOverlayProps {
  readonly isVisible: boolean;
  readonly isPageFlipping: boolean;
  readonly isBookFocused: boolean;
  readonly onSetBookFocused: (focused: boolean) => void;
  readonly onTriggerPageFlip: (
    direction: "next" | "prev",
    onMidpointChange: () => void
  ) => void;
  readonly mobile3dSide?: "left" | "right";
  readonly onChangeMobile3dSide?: (side: "left" | "right") => void;
  readonly onNavigateToStudioTulis: () => void;
  readonly onOpenPetaModal: () => void;
}

interface ChapterOrderItem {
  readonly id: GrimoireChapterId;
  readonly shortLabel: string;
  readonly label: string;
  readonly subtitle: string;
  readonly tpTag: string;
  readonly leftPageNo: number;
  readonly rightPageNo: number;
}

const CHAPTER_ORDER: readonly ChapterOrderItem[] = [
  {
    id: "alur",
    shortLabel: "Misi 1: Alur Cerita",
    label: "Misi 1: Jalan Cerita & Pesan Kebaikan",
    subtitle: "Kisah Bola-Bola Waktu, Gunung Alur & Pesan Cerita",
    tpTag: "Misi 1 · Urutan Kejadian & Pesan Cerita",
    leftPageNo: 1,
    rightPageNo: 2,
  },
  {
    id: "watak",
    shortLabel: "Misi 2: Tokoh & Indra",
    label: "Misi 2: Sifat Tokoh, Empat Kantong Ajaib & Pancaindra",
    subtitle: "Bukti Sifat Mao & Yari, Empat Kantong Emas & Kalimat Pancaindra",
    tpTag: "Misi 2 · Sifat Tokoh & Suasana Tempat",
    leftPageNo: 3,
    rightPageNo: 4,
  },
  {
    id: "bahasa",
    shortLabel: "Misi 3: Gaya Bahasa",
    label: "Misi 3: Kamus Kata, Perumpamaan & Dialog",
    subtitle: "Kamus Kata Fantasi, Perumpamaan & Kalimat Dialog",
    tpTag: "Misi 3 · Perumpamaan & Kalimat Dialog",
    leftPageNo: 5,
    rightPageNo: 6,
  },
] as const;

const TIME_ORB_DATA = [
  {
    id: "masa-kini-awal",
    eraLabel: "1. Pagi Hari (04.00)",
    location: "Rumah Ivan & Kantin Sekolah",
    summary:
      "Setiap pukul empat pagi Ivan membantu ibunya membuat kue basah untuk dijual di kantin sekolah. Namun Ivan merasa malu karena Fiam sering mengejeknya 'tukang kue'.",
    evidenceFocus:
      "Awal Cerita & Muncul Masalah: Mengenalkan Ivan dan rasa malunya karena diejek teman.",
  },
  {
    id: "lintas-tahun-2022",
    eraLabel: "2. Lompat ke Tahun 2022",
    location: "Lorong Bola Waktu -> Masa Depan",
    summary:
      "Pria berjubah hitam memberi Ivan bola-bola waktu bercahaya. Ivan memilih bola merah agar bisa langsung melompat ke tahun 2022 dan tidak perlu berjualan kue lagi.",
    evidenceFocus:
      "Masalah Membesar & Puncak (Klimaks): Pada tahun 2022, Ivan memang menjadi bintang basket, tetapi ia kaget dan sedih karena ayahnya sudah wafat akibat kelelahan bekerja sendirian.",
  },
  {
    id: "kembali-masa-kini",
    eraLabel: "3. Kembali ke Masa Kini",
    location: "Kamar Ivan & Pelukan Orang Tua",
    summary:
      "Ivan menangis menyesal hingga terbangun kembali di kamarnya. Ia langsung memeluk ayah dan ibunya, kemudian berjanji tidak akan malu lagi membantu ibunya sambil tetap berlatih basket.",
    evidenceFocus:
      "Akhir Cerita & Pesan Kebaikan: Sifat Ivan berubah menjadi anak yang bersyukur dan sayang keluarga.",
  },
] as const;

const PLOT_MOUNTAIN_COORDS: readonly {
  readonly order: number;
  readonly shortName: string;
  readonly x: number;
  readonly y: number;
}[] = [
  { order: 1, shortName: "Awal", x: 32, y: 82 },
  { order: 2, shortName: "Masalah", x: 108, y: 62 },
  { order: 3, shortName: "Naik", x: 180, y: 44 },
  { order: 4, shortName: "Puncak", x: 252, y: 28 },
  { order: 5, shortName: "Akhir", x: 326, y: 78 },
] as const;

const MATERI_TOUR_STORAGE_KEY = "aksaraloka:materi-tour-seen:v1";

const MATERI_TOUR_STEPS: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
    {
      title: "Langkah 1/3 · Baca Kisah di Halaman Kiri",
      body: "Di setiap Misi, halaman kiri berisi kisah seru dan rahasia cerita fantasi. Kamu juga bisa klik tombol [Dengarkan Suara Cerita]!",
    },
    {
      title: "Langkah 2/3 · Selesaikan Tantangan di Halaman Kanan",
      body: "Ikuti kotak 'Misi Sekarang' di bagian atas halaman tantangan agar kamu selalu tahu tombol apa yang harus diklik untuk membuka Segel!",
    },
    {
      title: "Langkah 3/3 · Kumpulkan 3 Segel lalu Mengarang!",
      body: "Setiap Misi membuka 1 Segel Rahasia. Setelah siap, klik 'Studio Tulis ->' di atas layar untuk mengarang cerita fantasimu sendiri!",
    },
  ];

const FIVE_SENSES_GUIDE = [
  {
    id: "sense-visual",
    sense: "1. Indra Penglihatan (Mata)",
    sceneContext: "Kisah Bola-Bola Waktu",
    weakExample: "Ivan melihat bola waktu yang bagus di tangan pria itu.",
    vividExample:
      "Bola kristal merah delima itu berpendar menembus kabut keperakan di sela jari pria berjubah hitam.",
  },
  {
    id: "sense-auditori",
    sense: "2. Indra Pendengaran (Telinga)",
    sceneContext: "Kisah Keberanian Emas",
    weakExample: "Suara langkah Raksasa terdengar sangat keras.",
    vividExample:
      "Dentuman langkah kaki Raksasa menggetarkan tanah hutan, disusul geraman berat yang merontokkan daun kering.",
  },
  {
    id: "sense-penciuman",
    sense: "3. Indra Penciuman & Peraba (Hidung & Kulit)",
    sceneContext: "Kisah Sihir Unik Mao",
    weakExample: "Mao menyihir kue cokelat dan stroberi yang enak.",
    vividExample:
      "Harum manis stroberi segar dan lelehan cokelat hangat seketika mengusir hawa dingin ruang kelas peri.",
  },
] as const;

export function KitabMateriOverlay({
  isVisible,
  isPageFlipping,
  isBookFocused,
  onSetBookFocused,
  onTriggerPageFlip,
  mobile3dSide = "left",
  onChangeMobile3dSide,
  onNavigateToStudioTulis,
  onOpenPetaModal,
}: KitabMateriOverlayProps) {
  const { state, metrics } = useAksaralokaLearning();
  const activeChapter = state.activeGrimoireChapter;

  const [isIntroViewOpen, setIsIntroViewOpen] = useState<boolean>(false);
  const [materiTourStep, setMateriTourStep] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(MATERI_TOUR_STORAGE_KEY) === "1"
        ? null
        : 0;
    } catch {
      return null;
    }
  });
  const [isMobileBook, setIsMobileBook] = useState<boolean>(false);
  const [mobilePageSide, setMobilePageSide] = useState<"left" | "right">("left");
  const [internal3dSide, setInternal3dSide] = useState<"left" | "right">("left");
  const active3dSide = onChangeMobile3dSide ? mobile3dSide : internal3dSide;
  const setActive3dSide = useCallback(
    (side: "left" | "right") => {
      if (onChangeMobile3dSide) {
        onChangeMobile3dSide(side);
      } else {
        setInternal3dSide(side);
      }
    },
    [onChangeMobile3dSide]
  );
  const touchStartRef = useRef<{ readonly x: number; readonly y: number } | null>(
    null
  );
  const didSwipeRef = useRef<boolean>(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(
    null
  );
  const flipTimerRef = useRef<number | null>(null);

  const [selectedOrbId, setSelectedOrbId] = useState<string>(
    TIME_ORB_DATA[0].id
  );
  const [visitedOrbIds, setVisitedOrbIds] = useState<readonly string[]>([
    TIME_ORB_DATA[0].id,
  ]);
  const [climaxSimMode, setClimaxSimMode] = useState<
    "idle" | "tanpa-klimaks" | "utuh"
  >("idle");
  const [climaxWarningMessage, setClimaxWarningMessage] = useState<
    string | null
  >(null);
  const [watakLeftTab, setWatakLeftTab] = useState<"mao" | "emas" | "indra">(
    "mao"
  );
  const [selectedLexiconCatId, setSelectedLexiconCatId] = useState<string>(
    FANTASY_LEXICON_BANK[0]?.id ?? "lex-cahaya"
  );
  const [lexiconTypeFilter, setLexiconTypeFilter] = useState<
    "Semua" | "Denotatif" | "Konotatif" | "Kiasan / Majas"
  >("Semua");
  const [activeNarrationTrack, setActiveNarrationTrack] =
    useState<NarrationTrackId | null>(() => getActiveNarrationTrackSnapshot());
  const [feedbackToast, setFeedbackToast] = useState<{
    tone: "emerald" | "amber" | "rose";
    text: string;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    readonly width: number;
    readonly height: number;
  }>({
    width: STAGE_SOURCE_WIDTH,
    height: STAGE_SOURCE_HEIGHT,
  });
  const [bookCalibration, setBookCalibration] = useState<BookSpreadCalibration>(
    READING_BOOK_DEFAULT_CALIBRATION
  );
  const book2dContainerRef = useRef<HTMLDivElement | null>(null);
  const [book2dLayout, setBook2dLayout] = useState<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }>({
    width: 946,
    height: 603,
    offsetX: 0,
    offsetY: 0,
  });
  const [book2dCalibration, setBook2dCalibration] = useState<BookSpreadCalibration>(
    READING_2D_DEFAULT_CALIBRATION
  );
  const [isCalibrating, setIsCalibrating] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("calibrate") === "1"
  );

  useEffect(() => {
    const syncCoverStage = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobileBook(w < 768);
      setViewportSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
    };
    const rafId = window.requestAnimationFrame(syncCoverStage);
    window.addEventListener("resize", syncCoverStage);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncCoverStage);
    };
  }, []);

  const mobileCamera = useMemo(
    () =>
      !isBookFocused && !isCalibrating
        ? computeMobile3dCameraTransform(
          viewportSize.width,
          viewportSize.height,
          active3dSide === "left" ? "kitab-left" : "kitab-right"
        )
        : computeMobile3dCameraTransform(
          viewportSize.width,
          viewportSize.height,
          "none"
        ),
    [active3dSide, isBookFocused, isCalibrating, viewportSize.height, viewportSize.width]
  );

  const stageMetrics: CoverStageMetrics = useMemo(
    () =>
      computeCoverStageMetrics(
        viewportSize.width,
        viewportSize.height
      ),
    [viewportSize.height, viewportSize.width]
  );

  useEffect(() => {
    if (!isVisible || !isBookFocused) return;
    const el = book2dContainerRef.current;
    if (!el) return;

    const syncBook2dLayout = () => {
      const target = book2dContainerRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const width = target.clientWidth || Math.round(rect.width);
      const height = target.clientHeight || Math.round(rect.height);
      if (width < 120 || height < 80) return;

      setBook2dLayout((prev) => {
        if (
          prev.width === width &&
          prev.height === height &&
          Math.abs(prev.offsetX - rect.left) < 0.5 &&
          Math.abs(prev.offsetY - rect.top) < 0.5
        ) {
          return prev;
        }
        return {
          width,
          height,
          offsetX: rect.left,
          offsetY: rect.top,
        };
      });
    };

    const rafId = window.requestAnimationFrame(syncBook2dLayout);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncBook2dLayout())
        : null;
    resizeObserver?.observe(el);
    window.addEventListener("resize", syncBook2dLayout);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncBook2dLayout);
    };
  }, [isVisible, isBookFocused, isCalibrating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        process.env.NODE_ENV === "development" &&
        e.altKey &&
        e.shiftKey &&
        e.code === "KeyK"
      ) {
        e.preventDefault();
        setIsCalibrating((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const unsub = subscribeAudioState(() => {
      setActiveNarrationTrack(getActiveNarrationTrackSnapshot());
    });
    return () => {
      unsub();
      stopSpeechNarration();
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (tone: "emerald" | "amber" | "rose", text: string) => {
      setFeedbackToast({ tone, text });
    },
    []
  );

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = window.setTimeout(() => setFeedbackToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedbackToast]);

  const activeChapterIndex = useMemo(
    () => CHAPTER_ORDER.findIndex((c) => c.id === activeChapter),
    [activeChapter]
  );

  const isShowingIntroSpread = !state.hasOpenedGrimoireIntro || isIntroViewOpen;

  const trigger2DHingeFlip = useCallback(
    (direction: "next" | "prev", onMidpoint: () => void) => {
      if (flipDirection !== null) return;
      playPageFlip();
      setFlipDirection(direction);
      window.setTimeout(() => {
        onMidpoint();
      }, 190);
      flipTimerRef.current = window.setTimeout(() => {
        setFlipDirection(null);
        flipTimerRef.current = null;
      }, 420);
    },
    [flipDirection]
  );

  const switchToChapter = useCallback(
    (targetChapter: GrimoireChapterId) => {
      if (targetChapter === activeChapter && !isShowingIntroSpread) {
        return;
      }
      if (isPageFlipping || flipDirection !== null) return;
      stopSpeechNarration();

      const targetIdx = CHAPTER_ORDER.findIndex((c) => c.id === targetChapter);
      const direction: "next" | "prev" =
        isShowingIntroSpread || targetIdx > activeChapterIndex
          ? "next"
          : "prev";

      if (isBookFocused) {
        if (isMobileBook) {
          setIsIntroViewOpen(false);
          setActiveGrimoireChapter(targetChapter);
          setMobilePageSide("left");
        } else {
          trigger2DHingeFlip(direction, () => {
            setIsIntroViewOpen(false);
            setActiveGrimoireChapter(targetChapter);
          });
        }
      } else {
        playPageFlip();
        onTriggerPageFlip(direction, () => {
          setIsIntroViewOpen(false);
          setActiveGrimoireChapter(targetChapter);
          setMobilePageSide("left");
          setActive3dSide("left");
        });
      }
    },
    [
      activeChapter,
      activeChapterIndex,
      flipDirection,
      isBookFocused,
      isMobileBook,
      isPageFlipping,
      isShowingIntroSpread,
      onTriggerPageFlip,
      setActive3dSide,
      trigger2DHingeFlip,
    ]
  );

  const handleOpenIntroSpread = useCallback(() => {
    if (isShowingIntroSpread || flipDirection !== null) return;
    stopSpeechNarration();
    if (isBookFocused) {
      if (isMobileBook) {
        setIsIntroViewOpen(true);
        setMobilePageSide("left");
      } else {
        trigger2DHingeFlip("prev", () => {
          setIsIntroViewOpen(true);
        });
      }
    } else {
      setIsIntroViewOpen(true);
      setMobilePageSide("left");
      onSetBookFocused(true);
      playPageFlip();
    }
  }, [
    flipDirection,
    isBookFocused,
    isMobileBook,
    isShowingIntroSpread,
    onSetBookFocused,
    trigger2DHingeFlip,
  ]);

  const handleOpenGrimoireScroll = useCallback(() => {
    stopSpeechNarration();
    if (isBookFocused) {
      if (isMobileBook) {
        markGrimoireIntroOpened();
        setIsIntroViewOpen(false);
        setActiveGrimoireChapter("alur");
        setMobilePageSide("left");
        showToast(
          "emerald",
          "Pustaka terbuka! Selesaikan setiap tantangan untuk membuka 3 Segel Rahasia."
        );
      } else {
        trigger2DHingeFlip("next", () => {
          markGrimoireIntroOpened();
          setIsIntroViewOpen(false);
          setActiveGrimoireChapter("alur");
          showToast(
            "emerald",
            "Pustaka terbuka! Selesaikan setiap tantangan untuk membuka 3 Segel Rahasia."
          );
        });
      }
    } else {
      markGrimoireIntroOpened();
      setIsIntroViewOpen(false);
      setActiveGrimoireChapter("alur");
      setMobilePageSide("left");
      playPageFlip();
      showToast(
        "emerald",
        "Pustaka terbuka! Selesaikan setiap tantangan untuk membuka 3 Segel Rahasia."
      );
    }
  }, [isBookFocused, isMobileBook, showToast, trigger2DHingeFlip]);

  // =========================================================================
  // BABAK 1 HANDLERS: BOLA WAKTU, GUNUNG ALUR & AMANAT
  // =========================================================================
  const handleDismissMateriTour = useCallback(() => {
    playChime();
    setMateriTourStep(null);
    try {
      window.localStorage.setItem(MATERI_TOUR_STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleNextMateriTour = useCallback(() => {
    playChime();
    setMateriTourStep((prev) => {
      if (prev === null || prev >= MATERI_TOUR_STEPS.length - 1) {
        try {
          window.localStorage.setItem(MATERI_TOUR_STORAGE_KEY, "1");
        } catch {
          // ignore
        }
        return null;
      }
      return prev + 1;
    });
  }, []);

  const handleTogglePembukaAudio = useCallback(() => {
    const started = toggleNarrationTrack(
      "pembuka-pustaka",
      PEMBUKA_PUSTAKA_AUDIO_SCRIPT
    );
    if (started) {
      showToast("amber", "Memutar narasi Pembuka Pustaka Aksaraloka...");
    }
  }, [showToast]);

  const handleToggleBolaWaktuAudio = useCallback(() => {
    const started = toggleNarrationTrack("bola-waktu", BOLA_WAKTU_AUDIO_SCRIPT);
    if (started) {
      showToast("amber", "Memutar sulih suara kisah Bola-Bola Waktu...");
    }
  }, [showToast]);

  const handleToggleMaoEmasAudio = useCallback(() => {
    const started = toggleNarrationTrack("mao-emas", MAO_EMAS_AUDIO_SCRIPT);
    if (started) {
      showToast("amber", "Memutar sulih suara kisah Sihir Unik Mao & Keberanian Emas...");
    }
  }, [showToast]);

  const handleToggleMisiBahasaAudio = useCallback(() => {
    const started = toggleNarrationTrack(
      "misi-bahasa",
      MISI_BAHASA_AUDIO_SCRIPT
    );
    if (started) {
      showToast("amber", "Memutar narasi panduan Misi 3: Gaya Bahasa...");
    }
  }, [showToast]);

  const handlePlaceNextPlotBeat = useCallback(
    (beatId: string) => {
      if (state.plotPlacedIds.includes(beatId)) return;
      const nextStepIdx = state.plotPlacedIds.length;
      const expectedBeat = BOLA_WAKTU_PLOT_BEATS[nextStepIdx];
      if (!expectedBeat) return;

      if (expectedBeat.id !== beatId) {
        playErrorTone();
        showToast(
          "rose",
          `Urutan alur belum tepat! Untuk tahap ke-${expectedBeat.correctOrder} (${expectedBeat.stagePosition}), pilih peristiwa yang menjadi sebab awalnya terlebih dahulu.`
        );
        return;
      }

      playChime();
      setClimaxWarningMessage(null);
      const wasUnlocked = state.sealAlurUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        plotPlacedIds: [...prev.plotPlacedIds, beatId],
      }));

      if (nextState.sealAlurUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(
        "emerald",
        `Tepat! "${expectedBeat.stageLabel}" terpasang pada Peta Gunung Alur.`
      );
    },
    [showToast, state.plotPlacedIds, state.sealAlurUnlocked]
  );

  const handleSimulateClimaxResolution = useCallback(
    (mode: "tanpa-klimaks" | "utuh") => {
      setClimaxSimMode(mode);
      if (mode === "tanpa-klimaks") {
        const wasUnlocked = state.sealAlurUnlocked;
        const nextState = updateLearningState((prev) => ({
          ...prev,
          climaxSimulationTested: true,
        }));

        if (nextState.sealAlurUnlocked && !wasUnlocked) {
          window.setTimeout(() => playSealUnlock(), 120);
        }

        playErrorTone();
        setClimaxWarningMessage(
          "SIMULASI TANPA PUNCAK (ALUR BOLONG): Lihat grafik merah di atas! Titik 4 (Puncak/Klimaks) hilang sehingga garis langsung jatuh dari 3 ke 5. Jika Ivan melompat ke tahun 2022 lalu langsung bahagia tanpa pernah menghadapi guncangan kehilangan ayahnya, cerita terasa datar dan tidak ada alasan logis mengapa Ivan berubah sikap!"
        );
      } else {
        playChime();
        setClimaxWarningMessage(
          state.climaxSimulationTested
            ? "ALUR UTUH DENGAN PUNCAK (KLIMAKS): Lihat grafik hijau di atas! Garis naik tajam menuju titik 4 (Puncak) saat Ivan mendapati makam Ayahnya, sehingga penyesalan dan perubahan sikap Ivan di titik 5 (Akhir) terasa kuat dan masuk akal."
            : "ALUR UTUH DENGAN PUNCAK (KLIMAKS): Garis naik ke titik 4 memicu perubahan sikap Ivan secara logis. Sekarang klik juga 'Coba Hapus Puncak Masalah!' agar kamu melihat gunung alurnya runtuh sekaligus menuntaskan syarat Simulasi Segel 1."
        );
      }
    },
    [state.climaxSimulationTested, state.sealAlurUnlocked]
  );

  const handleResetPlotMountain = useCallback(() => {
    updateLearningState((prev) => ({
      ...prev,
      plotPlacedIds: [],
    }));
    setClimaxSimMode("idle");
    setClimaxWarningMessage(null);
    showToast("amber", "Susunan Gunung Alur telah diatur ulang.");
  }, [showToast]);

  const handleSelectAmanat = useCallback(
    (optionId: string) => {
      const chosen = BOLA_WAKTU_AMANAT_OPTIONS.find((o) => o.id === optionId);
      if (!chosen) return;

      if (chosen.isCorrect) {
        playChime();
      } else {
        playErrorTone();
      }

      const wasUnlocked = state.sealAlurUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        selectedAmanatId: optionId,
      }));

      if (nextState.sealAlurUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(chosen.isCorrect ? "emerald" : "rose", chosen.feedback);
    },
    [showToast, state.sealAlurUnlocked]
  );

  const handleCustomAmanatChange = useCallback((value: string) => {
    updateLearningState((prev) => ({
      ...prev,
      customAmanatReflection: value,
    }));
  }, []);

  // =========================================================================
  // BABAK 2 HANDLERS: WATAK, 4 KANTONG EMAS & PANCAINDRA
  // =========================================================================
  const handleSelectCharacterTrait = useCallback(
    (challengeId: string, optionId: string) => {
      const challenge = CHARACTER_EVIDENCE_CHALLENGES.find(
        (c) => c.id === challengeId
      );
      const option = challenge?.options.find((o) => o.id === optionId);
      if (!challenge || !option) return;

      if (option.isValidEvidence) {
        playChime();
      } else {
        playErrorTone();
      }

      const wasUnlocked = state.sealWatakUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        characterEvidenceAnswers: {
          ...prev.characterEvidenceAnswers,
          [challengeId]: optionId,
        },
      }));

      if (nextState.sealWatakUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(
        option.isValidEvidence ? "emerald" : "rose",
        option.explanation
      );
    },
    [showToast, state.sealWatakUnlocked]
  );

  const handleAppendPouchStep = useCallback(
    (pouchId: string) => {
      if (state.pouchOrderIds.includes(pouchId)) return;
      const expectedStepIndex = state.pouchOrderIds.length;
      const expectedStep = EMAS_POUCH_STEPS[expectedStepIndex];
      if (!expectedStep) return;

      if (expectedStep.pouchId !== pouchId) {
        playErrorTone();
        showToast(
          "rose",
          `Urutan eskalasi belum tepat! Pilih kantong ke-${expectedStep.order} sesuai peningkatan bahaya kejaran Raksasa.`
        );
        return;
      }

      playChime();
      const wasUnlocked = state.sealWatakUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        pouchOrderIds: [...prev.pouchOrderIds, pouchId],
      }));

      if (nextState.sealWatakUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(
        "emerald",
        `${expectedStep.itemName}: ${expectedStep.transformation}`
      );
    },
    [showToast, state.pouchOrderIds, state.sealWatakUnlocked]
  );

  const handleResetPouchOrder = useCallback(() => {
    updateLearningState((prev) => ({
      ...prev,
      pouchOrderIds: [],
    }));
    showToast("amber", "Urutan eskalasi 4 Kantong Keajaiban Emas diatur ulang.");
  }, [showToast]);

  const handleSelectSensoryUpgrade = useCallback(
    (challengeId: string, optionId: string) => {
      const challenge = SENSORY_UPGRADE_CHALLENGES.find(
        (c) => c.id === challengeId
      );
      const option = challenge?.options.find((o) => o.id === optionId);
      if (!challenge || !option) return;

      if (option.isRichSensory) {
        playChime();
      } else {
        playErrorTone();
      }

      const wasUnlocked = state.sealWatakUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        sensoryUpgradeAnswers: {
          ...prev.sensoryUpgradeAnswers,
          [challengeId]: optionId,
        },
      }));

      if (nextState.sealWatakUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(option.isRichSensory ? "emerald" : "rose", option.feedback);
    },
    [showToast, state.sealWatakUnlocked]
  );

  // =========================================================================
  // BABAK 3 HANDLERS: LEKSIKON, MAJAS ASOSIASI & DIALOG
  // =========================================================================
  const handleUpdateMajasPair = useCallback(
    (challengeId: string, field: "connector" | "comparison", value: string) => {
      const challenge = MAJAS_ASOSIASI_CHALLENGES.find(
        (c) => c.id === challengeId
      );
      if (!challenge) return;

      const currentPair = state.majasAnswers[challengeId] ?? {
        connector: "",
        comparison: "",
      };
      const nextPair = {
        ...currentPair,
        [field]: value,
      };

      const isNowCompletePair =
        nextPair.connector !== "" && nextPair.comparison !== "";
      const isNowCorrect =
        nextPair.connector === challenge.correctConnector &&
        nextPair.comparison === challenge.correctComparison;

      if (isNowCompletePair) {
        if (isNowCorrect) {
          playChime();
          showToast("emerald", challenge.explanation);
        } else {
          playErrorTone();
          showToast(
            "rose",
            "Perpaduan kata pembanding atau perumpamaan majas asosiasi masih kurang tepat. Periksa kembali konteks kalimatnya!"
          );
        }
      } else {
        playChime();
      }

      const wasUnlocked = state.sealBahasaUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        majasAnswers: {
          ...prev.majasAnswers,
          [challengeId]: nextPair,
        },
      }));

      if (nextState.sealBahasaUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }
    },
    [showToast, state.majasAnswers, state.sealBahasaUnlocked]
  );

  const handleSelectDialogueOption = useCallback(
    (challengeId: string, optionId: string) => {
      const challenge = DIALOGUE_TRANSMUTATION_CHALLENGES.find(
        (c) => c.id === challengeId
      );
      const option = challenge?.options.find((o) => o.id === optionId);
      if (!challenge || !option) return;

      if (option.isCorrect) {
        playChime();
      } else {
        playErrorTone();
      }

      const wasUnlocked = state.sealBahasaUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        dialogueAnswers: {
          ...prev.dialogueAnswers,
          [challengeId]: optionId,
        },
      }));

      if (nextState.sealBahasaUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      showToast(option.isCorrect ? "emerald" : "rose", option.ruleExplanation);
    },
    [showToast, state.sealBahasaUnlocked]
  );

  // =========================================================================
  // DERIVED PROGRESS METRICS
  // =========================================================================
  const totalSealsUnlocked = metrics.unlockedSealsCount;
  const masteryPercentage = metrics.overallPercentage;

  const plotCorrectCount = state.plotPlacedIds.length;
  const isPlotComplete = isPlotOrderCorrect(state.plotPlacedIds);
  const isAmanatDone = isAmanatCorrect(state.selectedAmanatId);

  const charDone = isCharacterEvidenceComplete(state.characterEvidenceAnswers);
  const pouchDone = isPouchOrderComplete(state.pouchOrderIds);
  const sensoryDone = isSensoryComplete(state.sensoryUpgradeAnswers);

  const majasDone = isMajasComplete(state.majasAnswers);
  const dialogueDone = isDialogueComplete(state.dialogueAnswers);

  const selectedOrb =
    TIME_ORB_DATA.find((o) => o.id === selectedOrbId) ?? TIME_ORB_DATA[0];

  const selectedLexiconCategory =
    FANTASY_LEXICON_BANK.find((cat) => cat.id === selectedLexiconCatId) ??
    FANTASY_LEXICON_BANK[0]!;

  const activeChapterMeta =
    CHAPTER_ORDER.find((c) => c.id === activeChapter) ?? CHAPTER_ORDER[0]!;

  const basePageWidth = Math.max(220, Math.round(stageMetrics.width * 0.255));
  const basePageHeight = Math.max(280, Math.round(stageMetrics.height * 0.615));

  const leftMatrixCss = useMemo(() => {
    const quadPx = bookCalibration.leftQuadNorm.map(([nx, ny]) => [
      nx * stageMetrics.width,
      ny * stageMetrics.height,
    ]) as unknown as Quad2D;
    return computeHomographyMatrix3d(basePageWidth, basePageHeight, quadPx);
  }, [basePageHeight, basePageWidth, bookCalibration.leftQuadNorm, stageMetrics.height, stageMetrics.width]);

  const rightMatrixCss = useMemo(() => {
    const quadPx = bookCalibration.rightQuadNorm.map(([nx, ny]) => [
      nx * stageMetrics.width,
      ny * stageMetrics.height,
    ]) as unknown as Quad2D;
    return computeHomographyMatrix3d(basePageWidth, basePageHeight, quadPx);
  }, [basePageHeight, basePageWidth, bookCalibration.rightQuadNorm, stageMetrics.height, stageMetrics.width]);

  const leftDisp = useMemo(
    () =>
      buildPageDisplacementSpec(
        "left",
        bookCalibration.leftCurve,
        stageMetrics.scale
      ),
    [bookCalibration.leftCurve, stageMetrics.scale]
  );

  const rightDisp = useMemo(
    () =>
      buildPageDisplacementSpec(
        "right",
        bookCalibration.rightCurve,
        stageMetrics.scale
      ),
    [bookCalibration.rightCurve, stageMetrics.scale]
  );

  const book2dScale = book2dLayout.width / 946;
  const book2dLeftBaseW = Math.max(240, Math.round(book2dLayout.width * 0.388));
  const book2dRightBaseW = Math.max(240, Math.round(book2dLayout.width * 0.405));
  const book2dBaseH = Math.max(300, Math.round(book2dLayout.height * 0.896));

  const book2dLeftMatrixCss = useMemo(() => {
    const quadPx = book2dCalibration.leftQuadNorm.map(([nx, ny]) => [
      nx * book2dLayout.width,
      ny * book2dLayout.height,
    ]) as unknown as Quad2D;
    return computeHomographyMatrix3d(book2dLeftBaseW, book2dBaseH, quadPx);
  }, [
    book2dBaseH,
    book2dCalibration.leftQuadNorm,
    book2dLayout.height,
    book2dLayout.width,
    book2dLeftBaseW,
  ]);

  const book2dRightMatrixCss = useMemo(() => {
    const quadPx = book2dCalibration.rightQuadNorm.map(([nx, ny]) => [
      nx * book2dLayout.width,
      ny * book2dLayout.height,
    ]) as unknown as Quad2D;
    return computeHomographyMatrix3d(book2dRightBaseW, book2dBaseH, quadPx);
  }, [
    book2dBaseH,
    book2dCalibration.rightQuadNorm,
    book2dLayout.height,
    book2dLayout.width,
    book2dRightBaseW,
  ]);

  const book2dLeftDisp = useMemo(
    () =>
      buildPageDisplacementSpec(
        "left",
        book2dCalibration.leftCurve,
        book2dScale
      ),
    [book2dCalibration.leftCurve, book2dScale]
  );

  const book2dRightDisp = useMemo(
    () =>
      buildPageDisplacementSpec(
        "right",
        book2dCalibration.rightCurve,
        book2dScale
      ),
    [book2dCalibration.rightCurve, book2dScale]
  );

  const hasBook2dLeftCurve =
    Math.max(
      Math.abs(book2dCalibration.leftCurve.archLiftPx),
      Math.abs(book2dCalibration.leftCurve.spineDipPx),
      Math.abs(book2dCalibration.leftCurve.outerDropPx)
    ) > 0.1;

  const hasBook2dRightCurve =
    Math.max(
      Math.abs(book2dCalibration.rightCurve.archLiftPx),
      Math.abs(book2dCalibration.rightCurve.spineDipPx),
      Math.abs(book2dCalibration.rightCurve.outerDropPx)
    ) > 0.1;

  const book2dLeftPageStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `${book2dLeftBaseW}px`,
      height: `${book2dBaseH}px`,
      transformOrigin: "0 0",
      transform: book2dLeftMatrixCss,
      filter: hasBook2dLeftCurve ? "url(#reading-2d-curve-left)" : undefined,
    }),
    [book2dBaseH, book2dLeftBaseW, book2dLeftMatrixCss, hasBook2dLeftCurve]
  );

  const book2dRightPageStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `${book2dRightBaseW}px`,
      height: `${book2dBaseH}px`,
      transformOrigin: "0 0",
      transform: book2dRightMatrixCss,
      filter: hasBook2dRightCurve ? "url(#reading-2d-curve-right)" : undefined,
    }),
    [book2dBaseH, book2dRightBaseW, book2dRightMatrixCss, hasBook2dRightCurve]
  );

  const get2dPageStyle = (side: "left" | "right"): React.CSSProperties =>
    isMobileBook
      ? {
        display: mobilePageSide === side ? "flex" : "none",
        width: "100%",
        height: "100%",
      }
      : side === "left"
        ? book2dLeftPageStyle
        : book2dRightPageStyle;

  const page2dContainerClass = isMobileBook
    ? "parchment-ink parchment-ink-bleed mobile-parchment-sheet pointer-events-auto relative h-full w-full min-h-0 flex-col justify-between overflow-hidden px-4 py-3.5"
    : "parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5";

  if (!isVisible) return null;

  const scalePx = (n: number) => `${(n * stageMetrics.scale).toFixed(2)}px`;
  const leftFilterPad = Math.ceil(leftDisp.filterScale + 4);
  const rightFilterPad = Math.ceil(rightDisp.filterScale + 4);
  const book2dLeftFilterPad = Math.ceil(book2dLeftDisp.filterScale + 4);
  const book2dRightFilterPad = Math.ceil(book2dRightDisp.filterScale + 4);

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col justify-between overflow-hidden select-none">
      <ParchmentInkFilters />
      {/* =================================================================== */}
      {/* FLOATING TOAST NOTIFICATION                                         */}
      {/* =================================================================== */}
      {feedbackToast && (
        <div
          className={`pointer-events-none fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[60] flex justify-center ${isBookFocused ? "bottom-[72px] sm:bottom-auto sm:top-16" : "top-16 sm:top-20"
            }`}
        >
          <div
            role="status"
            aria-live="polite"
            className={`flex w-full max-w-[360px] sm:w-auto sm:max-w-lg items-center justify-center gap-2 rounded-2xl sm:rounded-full border px-4 py-2 text-center text-[11px] sm:text-xs font-semibold leading-snug shadow-[0_12px_28px_rgba(0,0,0,0.85)] md:backdrop-blur-md transition-all ${feedbackToast.tone === "emerald"
              ? "border-emerald-300/60 bg-emerald-950/95 text-emerald-100"
              : feedbackToast.tone === "rose"
                ? "border-rose-300/60 bg-rose-950/95 text-rose-100"
                : "border-[#f3d89b]/60 bg-slate-950/95 text-[#ffe8b6]"
              }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${feedbackToast.tone === "emerald"
                ? "bg-emerald-300"
                : feedbackToast.tone === "rose"
                  ? "bg-rose-300"
                  : "bg-[#f3d89b]"
                }`}
              aria-hidden="true"
            />
            <span>{feedbackToast.text}</span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STATE A: MODE BUKU 3D DI TANGAN (HOMOGRAPHY MATRIX3D + CURVE + DOCK) */}
      {/* =================================================================== */}
      {!isBookFocused && (
        <>
          <svg
            width="0"
            height="0"
            aria-hidden="true"
            className="pointer-events-none absolute overflow-hidden"
          >
            <defs>
              <filter
                id="reading-3d-curve-left"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
                x={-leftFilterPad}
                y={-leftFilterPad}
                width={basePageWidth + leftFilterPad * 2}
                height={basePageHeight + leftFilterPad * 2}
              >
                <feImage
                  href={leftDisp.dataUri}
                  x={0}
                  y={0}
                  width={basePageWidth}
                  height={basePageHeight}
                  preserveAspectRatio="none"
                  result="leftDispMap"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="leftDispMap"
                  scale={leftDisp.filterScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>

              <filter
                id="reading-3d-curve-right"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
                x={-rightFilterPad}
                y={-rightFilterPad}
                width={basePageWidth + rightFilterPad * 2}
                height={basePageHeight + rightFilterPad * 2}
              >
                <feImage
                  href={rightDisp.dataUri}
                  x={0}
                  y={0}
                  width={basePageWidth}
                  height={basePageHeight}
                  preserveAspectRatio="none"
                  result="rightDispMap"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="rightDispMap"
                  scale={rightDisp.filterScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>

          {/* Cover-Matched Stage Container: GPU-locked 1:1 with Canvas transform on Mobile Portrait, non-isolated on Desktop */}
          <div
            onTouchStart={(e) => {
              if (!mobileCamera.active || e.touches.length !== 1) return;
              const t = e.touches[0];
              if (!t) return;
              touchStartRef.current = { x: t.clientX, y: t.clientY };
              didSwipeRef.current = false;
            }}
            onTouchEnd={(e) => {
              if (!mobileCamera.active || !touchStartRef.current) return;
              const t = e.changedTouches[0];
              if (!t) return;
              const dx = t.clientX - touchStartRef.current.x;
              const dy = t.clientY - touchStartRef.current.y;
              touchStartRef.current = null;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                didSwipeRef.current = true;
                playPageFlip();
                setActive3dSide(dx < 0 ? "right" : "left");
              }
            }}
            className={`pointer-events-none fixed overflow-hidden ${mobileCamera.active
              ? "mix-blend-multiply transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
              : ""
              }`}
            style={{
              left: `${stageMetrics.offsetX}px`,
              top: `${stageMetrics.offsetY}px`,
              width: `${stageMetrics.width}px`,
              height: `${stageMetrics.height}px`,
              transformOrigin: mobileCamera.active ? mobileCamera.transformOrigin : undefined,
              transform: mobileCamera.active ? mobileCamera.transformCss : undefined,
            }}
          >
            {/* Left 3D Page: Calibrated 4-Point Homography + Smooth Page Arch Curve */}
            <div
              onClick={() => {
                if (isCalibrating) return;
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                playPageFlip();
                onSetBookFocused(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (isCalibrating) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playPageFlip();
                  onSetBookFocused(true);
                }
              }}
              aria-label="Klik halaman kiri buku untuk membuka tampilan baca penuh"
              className={`parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus:outline-none ${isPageFlipping ? "opacity-0" : ""
                }`}
              style={{
                width: `${basePageWidth}px`,
                height: `${basePageHeight}px`,
                padding: `${scalePx(20)} ${scalePx(22)} ${scalePx(26)} ${scalePx(22)}`,
                transformOrigin: "0 0",
                transform: leftMatrixCss,
                filter: "url(#reading-3d-curve-left)",
                maskImage:
                  "radial-gradient(ellipse 92% 90% at 58% 36%, black 60%, rgba(0,0,0,0.45) 82%, transparent 98%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 92% 90% at 58% 36%, black 60%, rgba(0,0,0,0.45) 82%, transparent 98%)",
              }}
            >
              <div
                key={`m3d-left-${isShowingIntroSpread ? "intro" : activeChapter}-${isPageFlipping ? "flip" : "idle"}`}
                className="book-ink-sweep-left flex flex-1 min-h-0 flex-col justify-between"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: scalePx(11) }}>
                  <div
                    className="book-ink-step-1 flex items-center justify-between border-b border-[#5c3d1e]/40 font-bold tracking-[0.14em] text-[#4b2e13]/90 uppercase"
                    style={{ fontSize: scalePx(12.5), paddingBottom: scalePx(5) }}
                  >
                    <span>
                      {isShowingIntroSpread
                        ? "PEMBUKA PUSTAKA"
                        : activeChapterMeta.shortLabel}
                    </span>
                    <span>
                      Hal.{" "}
                      {isShowingIntroSpread ? 1 : activeChapterMeta.leftPageNo}
                    </span>
                  </div>

                  <div className="book-ink-step-2">
                    {isShowingIntroSpread ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                        <p
                          className="font-serif font-bold text-[#241306]/92"
                          style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                        >
                          Pustaka Aksaraloka: Rahasia Cerita Fantasi
                        </p>
                        <p
                          className="font-serif text-[#2f1a09]/92"
                          style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                        >
                          Yuk bertualang mengenal rahasia cerita fantasi! Meskipun
                          tidak terjadi di dunia nyata, cerita fantasi memiliki
                          jalan cerita yang jelas dan dapat mengandung pesan
                          penulis.
                        </p>
                        <p
                          className="font-serif font-bold text-[#3f230b]/92 italic"
                          style={{ fontSize: scalePx(14.8), paddingTop: scalePx(8), lineHeight: 1.48 }}
                        >
                          3 Kisah Seru: &ldquo;Bola-Bola Waktu&rdquo;, &ldquo;Sihir
                          Unik Mao&rdquo; &amp; &ldquo;Keberanian Emas&rdquo;
                        </p>
                      </div>
                    ) : activeChapter === "alur" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                        <p
                          className="font-serif font-bold text-[#241306]/92"
                          style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                        >
                          Kisah &ldquo;Bola-Bola Waktu&rdquo;
                        </p>
                        <p
                          className="font-serif text-[#2f1a09]/92"
                          style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                        >
                          {selectedOrb.summary}
                        </p>
                        <p
                          className="font-serif font-semibold text-[#4b2e13]/92"
                          style={{ fontSize: scalePx(14.5), paddingTop: scalePx(6), lineHeight: 1.45 }}
                        >
                          Waktu Cerita: {selectedOrb.eraLabel} ({selectedOrb.location})
                        </p>
                        <p
                          className="font-serif text-[#3f230b]/92 italic"
                          style={{ fontSize: scalePx(14.5), lineHeight: 1.45 }}
                        >
                          Misi Segel 1:{" "}
                          {state.sealAlurUnlocked
                            ? "Selesai! (Gunung Alur & Pesan Cerita Beres)"
                            : `Urutan Kejadian ${plotCorrectCount}/5`}
                        </p>
                      </div>
                    ) : activeChapter === "watak" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                        <p
                          className="font-serif font-bold text-[#241306]/92"
                          style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                        >
                          Sifat Mao &amp; Yari, Empat Kantong Emas &amp; Pancaindra
                        </p>
                        <p
                          className="font-serif text-[#2f1a09]/92"
                          style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                        >
                          Mao pantang menyerah di Sekolah Peri Juara, sementara Emas
                          lolos dari kejaran Raksasa berkat 4 kantong ajaibnya (Biji
                          Timun, Jarum, Garam, Terasi).
                        </p>
                        <p
                          className="font-serif font-semibold text-[#4b2e13]/92"
                          style={{ fontSize: scalePx(14.5), paddingTop: scalePx(6), lineHeight: 1.45 }}
                        >
                          Urutan Kantong Emas: {state.pouchOrderIds.length}/4 Kantong
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                        <p
                          className="font-serif font-bold text-[#241306]/92"
                          style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                        >
                          Gaya Bahasa: Perumpamaan &amp; Dialog Tokoh
                        </p>
                        <p
                          className="font-serif text-[#2f1a09]/92"
                          style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                        >
                          Gunakan kata perumpamaan (seperti, bagaikan, laksana) agar
                          ceritamu indah, dan pelajari cara mengubah dialog tokoh
                          menjadi kalimat cerita!
                        </p>
                        <p
                          className="font-serif font-semibold text-[#4b2e13]/92"
                          style={{ fontSize: scalePx(14.5), paddingTop: scalePx(6), lineHeight: 1.45 }}
                        >
                          Kamus Kata: {selectedLexiconCategory.category}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="book-ink-step-4 border-t border-[#5c3d1e]/30 font-semibold text-[#5a3918]/85"
                  style={{ fontSize: scalePx(12.2), paddingTop: scalePx(5) }}
                >
                  Pustaka Aksaraloka · Bahasa Indonesia SMP Kelas VII
                </div>
              </div>
            </div>

            {/* Right 3D Page: Calibrated 4-Point Homography + Smooth Page Arch Curve */}
            <div
              onClick={() => {
                if (isCalibrating) return;
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                playPageFlip();
                onSetBookFocused(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (isCalibrating) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playPageFlip();
                  onSetBookFocused(true);
                }
              }}
              aria-label="Klik halaman kanan buku untuk membuka tampilan baca penuh"
              className={`parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus:outline-none ${isPageFlipping ? "opacity-0" : ""
                }`}
              style={{
                width: `${basePageWidth}px`,
                height: `${basePageHeight}px`,
                padding: `${scalePx(20)} ${scalePx(22)} ${scalePx(26)} ${scalePx(22)}`,
                transformOrigin: "0 0",
                transform: rightMatrixCss,
                filter: "url(#reading-3d-curve-right)",
                maskImage:
                  "radial-gradient(ellipse 92% 90% at 42% 36%, black 60%, rgba(0,0,0,0.45) 82%, transparent 98%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 92% 90% at 42% 36%, black 60%, rgba(0,0,0,0.45) 82%, transparent 98%)",
              }}
            >
              <div
                key={`m3d-right-${isShowingIntroSpread ? "intro" : activeChapter}-${isPageFlipping ? "flip" : "idle"}`}
                className="book-ink-sweep-right flex flex-1 min-h-0 flex-col justify-between"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: scalePx(11) }}>
                  <div
                    className="book-ink-step-1 flex items-center justify-between border-b border-[#5c3d1e]/40 font-bold tracking-[0.14em] text-[#4b2e13]/90 uppercase"
                    style={{ fontSize: scalePx(12.5), paddingBottom: scalePx(5) }}
                  >
                    <span>MISI &amp; 3 SEGEL CERITA</span>
                    <span>
                      Hal.{" "}
                      {isShowingIntroSpread ? 2 : activeChapterMeta.rightPageNo}
                    </span>
                  </div>

                  <div
                    className="book-ink-step-2 font-serif text-[#241306]/92"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: scalePx(10),
                      paddingTop: scalePx(6),
                      fontSize: scalePx(16.2),
                      lineHeight: 1.54,
                    }}
                  >
                    <p
                      className="font-bold text-[#241306]/95"
                      style={{ fontSize: scalePx(18.5), lineHeight: 1.3 }}
                    >
                      Segel yang Sudah Kamu Kumpulkan: {totalSealsUnlocked}/3 (
                      {masteryPercentage}%)
                    </p>
                    <p className="text-[#2f1a09]/92">
                      • Segel 1 (Alur &amp; Pesan):{" "}
                      <span className="font-bold">
                        {state.sealAlurUnlocked
                          ? "SELESAI ✓"
                          : `${plotCorrectCount}/5 Alur · ${state.climaxSimulationTested ? "Uji Klimaks ✓" : "Uji Klimaks"} · ${isAmanatDone ? "Pesan ✓" : "Pesan"}`}
                      </span>
                    </p>
                    <p className="text-[#2f1a09]/92">
                      • Segel 2 (Tokoh &amp; Indra):{" "}
                      <span className="font-bold">
                        {state.sealWatakUnlocked
                          ? "SELESAI ✓"
                          : `Tokoh ${charDone ? "✓" : "Belum"} · Kantong ${state.pouchOrderIds.length}/4 · Indra ${sensoryDone ? "✓" : "Belum"}`}
                      </span>
                    </p>
                    <p className="text-[#2f1a09]/92">
                      • Segel 3 (Perumpamaan &amp; Dialog):{" "}
                      <span className="font-bold">
                        {state.sealBahasaUnlocked
                          ? "SELESAI ✓"
                          : `Perumpamaan ${majasDone ? "Beres" : "Belum"} · Dialog ${dialogueDone ? "Beres" : "Belum"}`}
                      </span>
                    </p>
                  </div>
                </div>

                <div
                  className="book-ink-step-4 border-t border-[#5c3d1e]/30 text-right font-semibold text-[#5a3918]/85"
                  style={{ fontSize: scalePx(12.2), paddingTop: scalePx(5) }}
                >
                  Klik halaman buku untuk mulai bermain!
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* UNIFIED BOTTOM 3D THUMB STACK (CTA + ACTION DOCK BAR — ZERO COLLISION) */}
          {/* ================================================================= */}
          {!isCalibrating && (
            <div className="pointer-events-none fixed inset-x-0 bottom-2.5 sm:bottom-4 z-30 flex flex-col items-center gap-2 px-3 sm:px-6">
              {mobileCamera.active && (
                <div className="pointer-events-auto grid grid-cols-2 gap-1 rounded-full border border-[#cda250]/55 bg-slate-950/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.85)] md:backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      playPageFlip();
                      setActive3dSide("left");
                    }}
                    className={`min-h-[34px] rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${active3dSide === "left"
                      ? "bg-[#f3d89b] text-slate-950 shadow"
                      : "text-amber-100/85 hover:text-white"
                      }`}
                  >
                    &lt;- Hal. Kiri
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playPageFlip();
                      setActive3dSide("right");
                    }}
                    className={`min-h-[34px] rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${active3dSide === "right"
                      ? "bg-[#f3d89b] text-slate-950 shadow"
                      : "text-amber-100/85 hover:text-white"
                      }`}
                  >
                    Hal. Kanan -&gt;
                  </button>
                </div>
              )}

              <div className="flex flex-col items-center gap-1">
                {totalSealsUnlocked === 0 && (
                  <span className="hidden sm:inline-block rounded-full border border-[#f4d993]/75 bg-[#040915]/92 px-3 py-0.5 text-[10px] font-bold text-[#f4d993] shadow-lg animate-float-gentle text-center">
                    Petunjuk: Klik buku atau tombol di bawah buat mulai Misi 1!
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playPageFlip();
                    onSetBookFocused(true);
                  }}
                  className="pointer-events-auto cursor-pointer min-h-[44px] sm:min-h-0 rounded-full border border-[#f3d89b]/85 bg-slate-950/95 md:bg-slate-950/92 px-5 py-2 text-xs font-bold tracking-wider text-[#ffe8b6] shadow-[0_12px_30px_rgba(0,0,0,0.85)] md:backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:bg-slate-900"
                >
                  Buka Pustaka &amp; Mulai Misi Cerita! -&gt;
                </button>
              </div>

              <div className="parchment-scroll-hidden pointer-events-auto flex w-full max-w-[1180px] items-center gap-2 overflow-x-auto touch-pan-x md:flex-wrap md:justify-between md:overflow-visible rounded-2xl border border-[#d6b26f]/35 bg-slate-950/94 md:bg-slate-950/85 px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.85)] md:backdrop-blur-md">
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] font-medium text-amber-100/85 whitespace-nowrap">
                    Segel:{" "}
                    <strong className="font-bold text-[#ffe8b6]">
                      {totalSealsUnlocked}/3 ({masteryPercentage}%)
                    </strong>
                  </span>

                  <div className="mx-1 hidden h-3.5 w-px bg-[#d6b26f]/30 md:block" />

                  {CHAPTER_ORDER.map((chap) => {
                    const isCurrent =
                      activeChapter === chap.id && !isShowingIntroSpread;
                    const isUnlocked =
                      (chap.id === "alur" && state.sealAlurUnlocked) ||
                      (chap.id === "watak" && state.sealWatakUnlocked) ||
                      (chap.id === "bahasa" && state.sealBahasaUnlocked);

                    return (
                      <button
                        key={chap.id}
                        type="button"
                        disabled={isPageFlipping}
                        onClick={() => switchToChapter(chap.id)}
                        className={`cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1.5 md:py-1 text-[10.5px] font-bold tracking-wide transition-all disabled:opacity-40 sm:text-[11px] ${isCurrent
                          ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950 shadow-[0_0_12px_rgba(243,216,155,0.4)]"
                          : isUnlocked
                            ? "border-emerald-400/50 bg-emerald-950/70 text-emerald-200 hover:border-emerald-300"
                            : "border-[#d6b26f]/40 bg-slate-900/90 text-amber-100/85 hover:border-[#f3d89b]/70 hover:text-white"
                          }`}
                      >
                        {chap.shortLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={onOpenPetaModal}
                    className="cursor-pointer whitespace-nowrap rounded-full border border-[#d6b26f]/45 bg-slate-900/90 px-3 py-1.5 md:py-1 text-[11px] font-semibold text-[#f5ddab] transition hover:border-[#f3d89b] hover:bg-slate-800"
                  >
                    Peta &amp; LKS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playPageFlip();
                      onSetBookFocused(true);
                    }}
                    className="cursor-pointer whitespace-nowrap rounded-full border border-[#f3d89b]/70 bg-amber-950/80 px-3.5 py-1.5 md:py-1 text-[11px] font-bold text-[#ffe8b6] transition hover:border-[#f3d89b] hover:bg-amber-900/90"
                  >
                    Baca Penuh
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToStudioTulis}
                    className="cursor-pointer whitespace-nowrap rounded-full border border-emerald-400/60 bg-emerald-900/85 px-3.5 py-1.5 md:py-1 text-[11px] font-bold text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition hover:border-emerald-300 hover:bg-emerald-800"
                  >
                    Studio Tulis -&gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {isCalibrating && (
            <BookHomographyCalibrator
              stageWidth={stageMetrics.width}
              stageHeight={stageMetrics.height}
              stageOffsetX={stageMetrics.offsetX}
              stageOffsetY={stageMetrics.offsetY}
              calibration={bookCalibration}
              leftMatrixCss={leftMatrixCss}
              rightMatrixCss={rightMatrixCss}
              onChangeCalibration={setBookCalibration}
              onResetCalibration={() =>
                setBookCalibration(READING_BOOK_DEFAULT_CALIBRATION)
              }
              onClose={() => setIsCalibrating(false)}
            />
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* STATE B: MODE FOKUS BUKU 2D (PURE FLOATING BOOK ON THIN BLUR)       */}
      {/* =================================================================== */}
      {isBookFocused && (
        <div
          data-lenis-prevent
          className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 overscroll-none bg-black/15 px-2.5 py-2.5 backdrop-blur-[6px] transition-all duration-300 sm:px-4 sm:py-2.5"
        >
          <svg
            width="0"
            height="0"
            aria-hidden="true"
            className="pointer-events-none absolute overflow-hidden"
          >
            <defs>
              <filter
                id="reading-2d-curve-left"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
                x={-book2dLeftFilterPad}
                y={-book2dLeftFilterPad}
                width={book2dLeftBaseW + book2dLeftFilterPad * 2}
                height={book2dBaseH + book2dLeftFilterPad * 2}
              >
                <feFlood floodColor="rgb(128,128,128)" result="book2dLeftNeutralDisp" />
                <feImage
                  href={book2dLeftDisp.dataUri}
                  x={0}
                  y={0}
                  width={book2dLeftBaseW}
                  height={book2dBaseH}
                  preserveAspectRatio="none"
                  result="book2dLeftDispImg"
                />
                <feComposite
                  in="book2dLeftDispImg"
                  in2="book2dLeftNeutralDisp"
                  operator="over"
                  result="book2dLeftDispMap"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="book2dLeftDispMap"
                  scale={book2dLeftDisp.filterScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>

              <filter
                id="reading-2d-curve-right"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
                x={-book2dRightFilterPad}
                y={-book2dRightFilterPad}
                width={book2dRightBaseW + book2dRightFilterPad * 2}
                height={book2dBaseH + book2dRightFilterPad * 2}
              >
                <feFlood floodColor="rgb(128,128,128)" result="book2dRightNeutralDisp" />
                <feImage
                  href={book2dRightDisp.dataUri}
                  x={0}
                  y={0}
                  width={book2dRightBaseW}
                  height={book2dBaseH}
                  preserveAspectRatio="none"
                  result="book2dRightDispImg"
                />
                <feComposite
                  in="book2dRightDispImg"
                  in2="book2dRightNeutralDisp"
                  operator="over"
                  result="book2dRightDispMap"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="book2dRightDispMap"
                  scale={book2dRightDisp.filterScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>
          {/* --------------------------------------------------------------- */}
          {/* TOP FLOATING CONTROLS (COMPACT THUMB BAR DI HP, 1 BARIS DI DESKTOP) */}
          {/* --------------------------------------------------------------- */}
          <div className="relative z-40 flex w-full min-w-0 max-w-[1180px] shrink-0 flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:justify-between px-0.5 sm:px-1">
            {/* Mobile Row 1: Swipeable Utility Strip + Pinned Close Button | Desktop Right Group */}
            <div className="flex w-full min-w-0 items-center gap-1.5 md:order-2 md:w-auto">
              <div className="parchment-scroll-hidden flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto touch-pan-x pr-1 pb-0.5 md:flex-none md:overflow-visible md:pr-0 md:pb-0">
                <div className="shrink-0 rounded-full border border-[#d6b26f]/45 bg-slate-950/85 px-3 py-1.5 md:py-1 text-[11px] font-bold text-[#ffe8b6] shadow-md backdrop-blur-md whitespace-nowrap">
                  Segel: {totalSealsUnlocked}/3{" "}
                  <span className="mx-1 text-[#d6b26f]/50">|</span>
                  <span className="text-emerald-300">{masteryPercentage}%</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    setMateriTourStep(0);
                  }}
                  aria-label="Buka panduan cara belajar di Pustaka"
                  title="Panduan Singkat Pustaka"
                  className="shrink-0 cursor-pointer min-h-[36px] md:min-h-0 rounded-full border border-[#f3d89b]/55 bg-slate-950/85 px-2.5 py-1 text-[11px] font-bold text-[#ffe8b6] shadow-md backdrop-blur-md transition hover:bg-slate-900 whitespace-nowrap"
                >
                  ?
                </button>
                <button
                  type="button"
                  onClick={onOpenPetaModal}
                  className="shrink-0 cursor-pointer min-h-[36px] md:min-h-0 rounded-full border border-[#d6b26f]/45 bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-[#f5ddab] shadow-md backdrop-blur-md transition hover:border-[#f3d89b] hover:text-white whitespace-nowrap"
                >
                  Peta &amp; LKS
                </button>
                <button
                  type="button"
                  onClick={onNavigateToStudioTulis}
                  className="shrink-0 cursor-pointer min-h-[36px] md:min-h-0 rounded-full border border-emerald-400/55 bg-emerald-950/85 px-3 py-1 text-[11px] font-bold text-emerald-200 shadow-md backdrop-blur-md transition hover:border-emerald-300 hover:bg-emerald-900/90 whitespace-nowrap"
                >
                  Studio Tulis -&gt;
                </button>
              </div>

              <div className="flex shrink-0 items-center border-l border-[#d6b26f]/25 pl-1.5 md:border-l-0 md:pl-0">
                <button
                  type="button"
                  onClick={() => onSetBookFocused(false)}
                  aria-label="Tutup tampilan baca penuh"
                  className="shrink-0 cursor-pointer min-h-[36px] min-w-[40px] md:min-h-0 md:min-w-0 inline-flex items-center justify-center rounded-full border border-rose-300/55 bg-slate-950/90 px-2.5 md:px-3 py-1 text-[11px] font-bold text-rose-200 shadow-md backdrop-blur-md transition hover:border-rose-300 hover:bg-rose-950/80 whitespace-nowrap"
                >
                  <span className="md:hidden">[ X ]</span>
                  <span className="hidden md:inline">[ X ] Kembali ke Meja</span>
                </button>
              </div>
            </div>

            {/* Chapter & Intro Tabs (Horizontal swipeable strip on mobile) */}
            <div className="parchment-scroll-hidden flex w-full min-w-0 items-center gap-1.5 overflow-x-auto touch-pan-x pb-0.5 md:order-1 md:w-auto md:flex-wrap md:overflow-visible md:pb-0">
              <button
                type="button"
                onClick={handleOpenIntroSpread}
                className={`cursor-pointer shrink-0 min-h-[34px] md:min-h-0 rounded-full border px-2.5 md:px-3 py-1 text-[11px] font-bold tracking-wide shadow-md backdrop-blur-md transition-all whitespace-nowrap ${isShowingIntroSpread
                  ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                  : "border-[#d6b26f]/45 bg-slate-950/80 text-amber-100/90 hover:border-[#f3d89b]/70 hover:text-white"
                  }`}
              >
                <span className="md:hidden">Pembuka</span>
                <span className="hidden md:inline">Pembuka Pustaka</span>
              </button>

              {CHAPTER_ORDER.map((chap, idx) => {
                const isActive =
                  activeChapter === chap.id && !isShowingIntroSpread;
                const isSealDone =
                  (chap.id === "alur" && state.sealAlurUnlocked) ||
                  (chap.id === "watak" && state.sealWatakUnlocked) ||
                  (chap.id === "bahasa" && state.sealBahasaUnlocked);

                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => switchToChapter(chap.id)}
                    className={`cursor-pointer shrink-0 min-h-[34px] md:min-h-0 rounded-full border px-2.5 md:px-3 py-1 text-[11px] font-bold tracking-wide shadow-md backdrop-blur-md transition-all whitespace-nowrap ${isActive
                      ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                      : isSealDone
                        ? "border-emerald-400/55 bg-emerald-950/75 text-emerald-200 hover:border-emerald-300"
                        : "border-[#d6b26f]/45 bg-slate-950/80 text-amber-100/90 hover:border-[#f3d89b]/70 hover:text-white"
                      }`}
                  >
                    <span className="md:hidden">Misi {idx + 1}</span>
                    <span className="hidden md:inline">{chap.shortLabel}</span>{" "}
                    <span className="ml-0.5 text-[10px] opacity-85">
                      {isSealDone ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* BOOK SPREAD (DESKTOP) OR SINGLE-PAGE PARCHMENT SHEET (MOBILE)   */}
          {/* --------------------------------------------------------------- */}
          <div
            style={{
              perspective: isMobileBook ? undefined : "1800px",
            }}
            className={`relative z-10 my-auto flex w-full flex-1 min-h-0 items-center justify-center ${isMobileBook ? "overflow-hidden" : "overflow-visible"
              }`}
          >
            <div
              ref={book2dContainerRef}
              className={
                isMobileBook
                  ? "relative h-full w-full max-w-[480px] overflow-hidden rounded-2xl border-2 border-[#cda250]/65 bg-[#eed8b0] shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                  : "relative drop-shadow-[0_28px_55px_rgba(0,0,0,0.9)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              }
              style={
                isMobileBook
                  ? undefined
                  : {
                    width: "min(94vw, 1180px, calc((100dvh - 4.4rem) * 946 / 603))",
                    aspectRatio: "946 / 603",
                    transform: "rotateX(0deg) scale(1) translateY(0px)",
                    transformOrigin: "50% 70%",
                  }
              }
            >
              {isMobileBook ? (
                <>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-no-repeat"
                    style={{
                      backgroundImage: "url('/assets/studio/single-page.webp')",
                      backgroundSize: "415% 152%",
                      backgroundPosition:
                        mobilePageSide === "left" ? "28.8% 53.5%" : "70% 53.5%",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(92,61,30,0.22)]"
                  />
                </>
              ) : (
                <>
                  {/* Layer 1: Book Base Cover (Leather & Spine) */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-no-repeat"
                    style={{
                      backgroundImage: "url('/assets/studio/book-base.webp')",
                      backgroundSize: "145.45% 127.36%",
                      backgroundPosition: "50% 55.15%",
                    }}
                  />

                  {/* Layer 2: Open Parchment Spread */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-no-repeat"
                    style={{
                      backgroundImage: "url('/assets/studio/single-page.webp')",
                      backgroundSize: "145.45% 127.36%",
                      backgroundPosition: "50% 55.15%",
                    }}
                  />
                </>
              )}

              {/* Layer 3: Calibrated Homography Page Spread (NO transform/z-index wrapper so .parchment-ink multiplies directly into single-page.webp) */}
              <div className="pointer-events-none absolute inset-0">
                {/* ============================================================= */}
                {/* SPREAD 0: PENGANTAR KITAB AKSARALOKA (GULUNGAN PEMBUKA)       */}
                {/* ============================================================= */}
                {isShowingIntroSpread && (
                  <>
                    {/* LEFT PAGE: PENGANTAR KONSEP CERITA FANTASI */}
                    <div style={get2dPageStyle("left")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-2 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-1 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                            PEMBUKA PUSTAKA · MULAI DARI SINI
                          </span>
                          <button
                            type="button"
                            onClick={handleTogglePembukaAudio}
                            className="cursor-pointer font-serif text-[9.5px] font-bold text-[#14532d] underline decoration-[#14532d]/60 underline-offset-2 transition hover:text-emerald-950 sm:text-[10px]"
                          >
                            {activeNarrationTrack === "pembuka-pustaka"
                              ? "[Matikan Pengantar]"
                              : "[Dengarkan Pengantar]"}
                          </button>
                        </div>

                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          <h2 className="parchment-contour-warp text-sm leading-snug font-bold text-[#2b1a0c] sm:text-base">
                            Apa Rahasia Cerita Fantasi yang Seru?
                          </h2>
                          <p className="text-[11px] leading-relaxed text-[#3a2512] sm:text-xs">
                            Selamat datang di <strong>Pustaka Aksaraloka</strong>!
                            Sebelum mengarang ceritamu sendiri di{" "}
                            <strong>Studio Tulis</strong>, yuk kumpulkan{" "}
                            <strong>3 Segel Rahasia</strong> lewat tiga kisah seru:{" "}
                            <strong>&ldquo;Bola-Bola Waktu&rdquo;</strong>,{" "}
                            <strong>&ldquo;Sihir Unik Mao&rdquo;</strong>, dan{" "}
                            <strong>&ldquo;Keberanian Emas&rdquo;</strong>.
                          </p>

                          <div className="border-t border-b border-[#5c3d1e]/30 py-1.5">
                            <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase sm:text-[11px]">
                              Apa Itu Cerita Fantasi?
                            </p>
                            <p className="mt-1 text-[10.5px] leading-relaxed text-[#2b1a0c] sm:text-[11px]">
                              Cerita fantasi adalah cerita yang berisi khayalan
                              dan hal-hal ajaib, seperti benda yang memiliki
                              kekuatan, makhluk ajaib, atau perjalanan waktu.
                              Meskipun tidak terjadi di dunia nyata, cerita
                              fantasi memiliki{" "}
                              <strong>jalan cerita yang jelas</strong> dan dapat
                              mengandung{" "}
                              <strong>
                                pesan yang ingin disampaikan penulis
                              </strong>
                              .
                            </p>
                          </div>

                          <div className="space-y-1.5 pt-0.5">
                            <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase sm:text-[11px]">
                              3 Kunci Supaya Ceritamu Keren:
                            </p>
                            <p className="text-[10.5px] leading-snug text-[#3a2512] sm:text-[11px]">
                              <strong>1. Keajaiban Memiliki Aturan:</strong> Benda
                              atau kekuatan ajaib dalam cerita memiliki aturan,
                              syarat, atau batasan. Misalnya, bola waktu Ivan
                              hanya dapat digunakan dengan cara tertentu dan
                              memiliki akibat jika digunakan.
                            </p>
                            <p className="text-[10.5px] leading-snug text-[#3a2512] sm:text-[11px]">
                              <strong>2. Sifat Tokoh Terlihat dari Aksi:</strong>{" "}
                              Tunjukkan sifat baik atau sombong tokoh lewat
                              perbuatan dan ucapannya. Misalnya, tokoh yang rajin
                              berlatih menunjukkan sifat yang pantang menyerah.
                            </p>
                            <p className="text-[10.5px] leading-snug text-[#3a2512] sm:text-[11px]">
                              <strong>3. Pakai Pancaindra &amp; Perumpamaan:</strong>{" "}
                              Buatlah cerita lebih hidup dengan menggambarkan apa
                              yang dilihat, didengar, dicium, dirasakan, atau
                              disentuh tokoh. Untuk membandingkan sesuatu, kamu
                              bisa menggunakan perumpamaan.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <span>Pembuka Pustaka Aksaraloka</span>
                        <span className="font-semibold">Halaman Pengantar I</span>
                      </div>
                    </div>

                    {/* RIGHT PAGE: PETA 3 BABAK & TOMBOL BUKA SEGEL GULUNGAN */}
                    <div style={get2dPageStyle("right")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-2 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                            MISI 3 SEGEL RAHASIA CERITA
                          </span>
                          <span className="font-serif text-[10px] font-semibold text-[#6b4826]">
                            Segel Terkumpul: {totalSealsUnlocked}/3
                          </span>
                        </div>

                        <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                                Misi 1 — Jalan Cerita &amp; Pesan Kebaikan
                              </span>
                              <span className="text-[10px] font-bold text-[#14532d]">
                                {state.sealAlurUnlocked
                                  ? "[Segel 1 Selesai ✓]"
                                  : "[Segel 1]"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                              Ikuti perjalanan waktu Ivan di kisah{" "}
                              <em>Bola-Bola Waktu</em>, susun 5 kejadian Gunung
                              Alur, dan tebak pesan kebaikannya!
                            </p>
                          </div>

                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                                Misi 2 — Sifat Tokoh, Empat Kantong Emas &amp; Pancaindra
                              </span>
                              <span className="text-[10px] font-bold text-[#14532d]">
                                {state.sealWatakUnlocked
                                  ? "[Segel 2 Selesai ✓]"
                                  : "[Segel 2]"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                              Tebak bukti sifat Mao &amp; Yari (<em>Sihir Unik Mao</em>),
                              urutkan 4 kantong ajaib Emas (<em>Keberanian Emas</em>),
                              dan pilih kalimat pancaindra yang hidup!
                            </p>
                          </div>

                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                                Misi 3 — Kamus Kata, Perumpamaan &amp; Dialog
                              </span>
                              <span className="text-[10px] font-bold text-[#14532d]">
                                {state.sealBahasaUnlocked
                                  ? "[Segel 3 Selesai ✓]"
                                  : "[Segel 3]"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                              Intip kamus kata fantasi, pasangkan perumpamaan
                              (seperti/bagaikan), dan ubah dialog tokoh jadi
                              kalimat cerita yang rapi!
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleOpenGrimoireScroll}
                            className="cursor-pointer rounded-full border-2 border-[#14532d]/80 bg-[#14532d]/12 px-4 py-1.5 font-serif text-[11px] font-bold text-[#14532d] transition hover:bg-[#14532d]/22"
                          >
                            Ayo Mulai Misi 1 Sekarang! -&gt;
                          </button>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <span className="font-semibold">
                          Halaman Pengantar II
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenGrimoireScroll}
                          className="cursor-pointer font-bold text-[#2b1a0c] underline decoration-[#5c3d1e]/50 underline-offset-2 transition hover:text-black"
                        >
                          Mulai Misi 1 -&gt;
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ============================================================= */}
                {/* SPREAD 1: BABAK I (ALUR, LINTAS WAKTU & AMANAT)               */}
                {/* ============================================================= */}
                {!isShowingIntroSpread && activeChapter === "alur" && (
                  <>
                    {/* LEFT PAGE (HALAMAN 1): 3 BOLA WAKTU & INTI CERITA */}
                    <div style={get2dPageStyle("left")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                            HALAMAN 1 · {CHAPTER_ORDER[0]!.tpTag}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleBolaWaktuAudio}
                            className="cursor-pointer font-serif text-[10px] font-bold text-[#14532d] underline decoration-[#14532d]/60 underline-offset-2 transition hover:text-emerald-950"
                          >
                            {activeNarrationTrack === "bola-waktu"
                              ? "[Matikan Suara Cerita]"
                              : "[Dengarkan Suara Cerita]"}
                          </button>
                        </div>

                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          <div>
                            <h2 className="parchment-contour-warp text-xs leading-snug font-bold text-[#2b1a0c] sm:text-sm">
                              Kisah Contoh: &ldquo;Bola-Bola Waktu&rdquo;
                            </h2>
                            <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                              Petunjuk: Klik <strong>Tiga tombol waktu</strong> di
                              bawah secara berurutan untuk melihat bagaimana kisah
                              Ivan berjalan dari pagi hari sampai melompat ke
                              tahun 2022!
                            </p>
                          </div>

                          {/* 3 Time Orb Selector Links on Parchment */}
                          <div className="grid grid-cols-3 gap-1.5 border-t border-b border-[#5c3d1e]/35 py-1.5">
                            {TIME_ORB_DATA.map((orb) => {
                              const isSelected = selectedOrb.id === orb.id;
                              const isVisited = visitedOrbIds.includes(orb.id);
                              return (
                                <button
                                  key={orb.id}
                                  type="button"
                                  onClick={() => {
                                    playChime();
                                    setSelectedOrbId(orb.id);
                                    setVisitedOrbIds((prev) =>
                                      prev.includes(orb.id) ? prev : [...prev, orb.id]
                                    );
                                  }}
                                  className={`cursor-pointer border-b-2 px-1.5 py-1 text-left font-serif transition ${isSelected
                                    ? "border-[#2b1a0c] bg-[#5c3d1e]/15 font-bold text-[#1f1207]"
                                    : "border-transparent text-[#5c3d1e] hover:border-[#5c3d1e]/40 hover:text-[#2b1a0c]"
                                    }`}
                                >
                                  <span className="flex items-center justify-between gap-1 text-[9.5px] leading-tight font-bold sm:text-[10px]">
                                    <span>{orb.eraLabel}</span>
                                    {isVisited && (
                                      <span className="text-[#14532d]" aria-label="Sudah dibaca">
                                        ✓
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[8.5px] text-[#6b4826] sm:text-[9px]">
                                    {orb.location}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Active Time Orb Detail */}
                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-[#4a2f15] uppercase">
                              <span>{selectedOrb.eraLabel}</span>
                              <span className="italic">
                                {selectedOrb.location}
                              </span>
                            </div>
                            <p className="mt-1 text-[10.5px] leading-relaxed text-[#2b1a0c] sm:text-[11px]">
                              {selectedOrb.summary}
                            </p>
                            <p className="mt-1 text-[10px] leading-snug text-[#4a2f15] italic">
                              <strong>Bagian Alur:</strong>{" "}
                              {selectedOrb.evidenceFocus}
                            </p>
                          </div>

                          {/* Ringkasan Struktur Alur Cerita Fantasi */}
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              Urutan Jalan Cerita (Alur) yang Seru:
                            </p>
                            <p className="text-[10px] leading-relaxed text-[#3a2512] sm:text-[10.5px]">
                              Cerita yang bagus berjalan naik seperti mendaki
                              gunung:{" "}
                              <strong>1. Awal Cerita (Orientasi)</strong> -&gt;{" "}
                              <strong>2. Muncul Masalah</strong> -&gt;{" "}
                              <strong>3. Masalah Membesar (Komplikasi)</strong>{" "}
                              -&gt; <strong>4. Puncak Masalah (Klimaks)</strong>{" "}
                              -&gt; <strong>5. Akhir Cerita (Resolusi)</strong>.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <button
                          type="button"
                          onClick={handleOpenIntroSpread}
                          className="cursor-pointer font-bold text-[#3a2512] transition hover:text-black"
                        >
                          &lt;- Pembuka Pustaka
                        </button>
                        <span className="font-semibold">Halaman 1</span>
                      </div>
                    </div>

                    {/* RIGHT PAGE (HALAMAN 2): GUNUNG ALUR INTERAKTIF & AMANAT */}
                    <div style={get2dPageStyle("right")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#4a2f15] uppercase sm:text-[10.5px]">
                            HALAMAN 2 · TANTANGAN SEGEL 1
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-serif text-[9px] font-bold text-[#14532d] sm:text-[9.5px]">
                            {state.sealAlurUnlocked
                              ? "Segel 1 Selesai ✓"
                              : `Alur ${plotCorrectCount}/5 · Uji ${state.climaxSimulationTested ? "✓" : "○"} · Pesan ${isAmanatDone ? "✓" : "○"}`}
                          </span>
                        </div>

                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          {/* Live 1-Line Quest Prompt (Guided Next Action for 7th Graders) */}
                          {state.sealAlurUnlocked ? (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-[#14532d]/55 bg-[#14532d]/12 px-2 py-1.5 text-[10px] font-bold text-[#14532d]">
                              <span>Hebat! Segel 1 (Alur &amp; Pesan) Terbuka!</span>
                              <button
                                type="button"
                                onClick={() => switchToChapter("watak")}
                                className="cursor-pointer rounded-full bg-[#14532d] px-2.5 py-0.5 text-[9.5px] font-bold text-[#fdf6e7] hover:bg-emerald-950"
                              >
                                Lanjut Misi 2 -&gt;
                              </button>
                            </div>
                          ) : (
                            <div className="rounded border border-[#5c3d1e]/40 bg-[#5c3d1e]/10 px-2 py-1 text-[9.5px] leading-snug text-[#2b1a0c]">
                              <strong className="text-[#4a2f15]">Misi Sekarang:</strong>{" "}
                              {!isPlotComplete
                                ? `Klik kejadian ke-${plotCorrectCount + 1} pada Misi A di bawah (${plotCorrectCount}/5).`
                                : !state.climaxSimulationTested
                                  ? 'Klik tombol merah "Hapus Puncak!" di Gunung Alur untuk melihat efek cerita tanpa klimaks!'
                                  : "Pilih 1 Pesan Kebaikan (Amanat) yang paling tepat di Misi B bawah!"}
                            </div>
                          )}

                          {/* Interactive Hand-Drawn Sepia Plot Mountain SVG (Collision-Free Coordinates) */}
                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                                1. Gunung Alur ({plotCorrectCount}/5)
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSimulateClimaxResolution(
                                      "tanpa-klimaks"
                                    )
                                  }
                                  className={`cursor-pointer rounded px-2 py-0.5 text-[9px] leading-tight font-bold transition ${climaxSimMode === "tanpa-klimaks"
                                    ? "border border-[#7f1d1d] bg-[#7f1d1d] text-[#fdf6e7]"
                                    : "border border-[#7f1d1d]/60 bg-[#7f1d1d]/10 text-[#7f1d1d] hover:bg-[#7f1d1d]/20"
                                    }`}
                                >
                                  {state.climaxSimulationTested ? "✓ " : ""}
                                  Hapus Puncak!
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSimulateClimaxResolution("utuh")
                                  }
                                  className={`cursor-pointer rounded px-2 py-0.5 text-[9px] leading-tight font-bold transition ${climaxSimMode === "utuh"
                                    ? "border border-[#14532d] bg-[#14532d] text-[#fdf6e7]"
                                    : "border border-[#14532d]/60 bg-[#14532d]/10 text-[#14532d] hover:bg-[#14532d]/20"
                                    }`}
                                >
                                  Alur Utuh
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetPlotMountain}
                                  className="cursor-pointer px-1 text-[9px] font-semibold text-[#5c3d1e] underline hover:text-black"
                                >
                                  Ulangi
                                </button>
                              </div>
                            </div>

                            <p className="mt-1 text-[9.5px] leading-snug text-[#4a2f15]">
                              Grafik ini menunjukkan <strong>naik-turunnya ketegangan cerita</strong> dari 1 (Awal) mendaki ke puncak 4 (Klimaks) lalu turun ke 5 (Akhir). Klik <strong>&ldquo;Hapus Puncak!&rdquo;</strong> untuk melihat efek alur yang bolong!
                            </p>

                            {(() => {
                              const isBrokenSim = climaxSimMode === "tanpa-klimaks";
                              const isIntactSim = climaxSimMode === "utuh";
                              const fullPoints = PLOT_MOUNTAIN_COORDS.map(
                                (c) => `${c.x},${c.y}`
                              ).join(" ");
                              const brokenPoints = [
                                PLOT_MOUNTAIN_COORDS[0]!,
                                PLOT_MOUNTAIN_COORDS[1]!,
                                PLOT_MOUNTAIN_COORDS[2]!,
                                PLOT_MOUNTAIN_COORDS[4]!,
                              ]
                                .map((c) => `${c.x},${c.y}`)
                                .join(" ");
                              const solvedProgressPoints =
                                plotCorrectCount >= 2
                                  ? PLOT_MOUNTAIN_COORDS.slice(0, plotCorrectCount)
                                    .map((c) => `${c.x},${c.y}`)
                                    .join(" ")
                                  : null;

                              return (
                                <svg
                                  viewBox="0 0 360 116"
                                  className="parchment-contour-warp mt-1.5 h-[88px] sm:h-[96px] w-full overflow-visible"
                                  aria-label="Diagram Gunung Alur Cerita Fantasi"
                                >
                                  {/* Baseline dashed mountain contour (ghosted when peak removed) */}
                                  <polyline
                                    fill="none"
                                    stroke={
                                      isBrokenSim
                                        ? "#5c3d1e45"
                                        : isIntactSim
                                          ? "#14532d"
                                          : "#5c3d1e"
                                    }
                                    strokeWidth={isIntactSim ? "2.6" : "2"}
                                    strokeDasharray={isIntactSim ? undefined : "4 3"}
                                    points={fullPoints}
                                  />

                                  {/* Solved progression solid emerald path when placing beats */}
                                  {!isBrokenSim && !isIntactSim && solvedProgressPoints && (
                                    <polyline
                                      fill="none"
                                      stroke="#14532d"
                                      strokeWidth="2.8"
                                      points={solvedProgressPoints}
                                    />
                                  )}

                                  {/* Collapsed red flatline skipping Peak #4 during tanpa-klimaks simulation */}
                                  {isBrokenSim && (
                                    <>
                                      <polyline
                                        fill="none"
                                        stroke="#991b1b"
                                        strokeWidth="2.8"
                                        strokeDasharray="6 3"
                                        points={brokenPoints}
                                      />
                                      <g>
                                        <rect
                                          x="148"
                                          y="89"
                                          width="148"
                                          height="19"
                                          rx="9.5"
                                          fill="#991b1b"
                                          fillOpacity="0.14"
                                          stroke="#991b1b"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x="222"
                                          y="101.5"
                                          textAnchor="middle"
                                          fontSize="8.2"
                                          fontWeight="bold"
                                          fill="#7f1d1d"
                                        >
                                          ALUR BOLONG (DATAR!)
                                        </text>
                                      </g>
                                    </>
                                  )}

                                  {/* Intact peak highlight ring & collision-free badge in valley */}
                                  {isIntactSim && (
                                    <>
                                      <circle
                                        cx={PLOT_MOUNTAIN_COORDS[3]!.x}
                                        cy={PLOT_MOUNTAIN_COORDS[3]!.y}
                                        r="12"
                                        fill="#14532d"
                                        fillOpacity="0.15"
                                        stroke="#14532d"
                                        strokeWidth="1.5"
                                      />
                                      <g>
                                        <rect
                                          x="148"
                                          y="89"
                                          width="148"
                                          height="19"
                                          rx="9.5"
                                          fill="#14532d"
                                          fillOpacity="0.14"
                                          stroke="#14532d"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x="222"
                                          y="101.5"
                                          textAnchor="middle"
                                          fontSize="8.2"
                                          fontWeight="bold"
                                          fill="#14532d"
                                        >
                                          ALUR UTUH · PUNCAK KUAT ✓
                                        </text>
                                      </g>
                                    </>
                                  )}

                                  {PLOT_MOUNTAIN_COORDS.map((coord, idx) => {
                                    const beat = BOLA_WAKTU_PLOT_BEATS[idx];
                                    const isSolved =
                                      beat !== undefined &&
                                      state.plotPlacedIds[idx] === beat.id;
                                    const isNextTarget =
                                      state.plotPlacedIds.length === idx;
                                    const isRemovedPeak = isBrokenSim && coord.order === 4;

                                    return (
                                      <g key={coord.order}>
                                        <circle
                                          cx={coord.x}
                                          cy={coord.y}
                                          r={
                                            isRemovedPeak
                                              ? 8.5
                                              : isNextTarget
                                                ? 9
                                                : 7.5
                                          }
                                          fill={
                                            isRemovedPeak
                                              ? "#fee2e2"
                                              : isIntactSim && coord.order === 4
                                                ? "#14532d"
                                                : isSolved
                                                  ? "#14532d"
                                                  : isNextTarget
                                                    ? "#4a2f15"
                                                    : "#d9c39a"
                                          }
                                          stroke={
                                            isRemovedPeak ? "#991b1b" : "#2b1a0c"
                                          }
                                          strokeWidth={isRemovedPeak ? "1.8" : "1.5"}
                                          strokeDasharray={
                                            isRemovedPeak ? "2 2" : undefined
                                          }
                                        />
                                        <text
                                          x={coord.x}
                                          y={coord.y + 3}
                                          textAnchor="middle"
                                          fontSize="8.5"
                                          fontWeight="bold"
                                          fill={
                                            isRemovedPeak
                                              ? "#991b1b"
                                              : isSolved ||
                                                isNextTarget ||
                                                (isIntactSim && coord.order === 4)
                                                ? "#fdf6e7"
                                                : "#2b1a0c"
                                          }
                                        >
                                          {isRemovedPeak ? "X" : coord.order}
                                        </text>
                                        <text
                                          x={coord.x}
                                          y={
                                            coord.order === 4
                                              ? coord.y - 18
                                              : coord.y + 21
                                          }
                                          textAnchor="middle"
                                          fontSize="8.2"
                                          fontWeight="bold"
                                          fill={
                                            isRemovedPeak
                                              ? "#991b1b"
                                              : isSolved
                                                ? "#14532d"
                                                : "#3a2512"
                                          }
                                        >
                                          {isRemovedPeak
                                            ? "Puncak Hilang!"
                                            : coord.shortName}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              );
                            })()}

                            {climaxWarningMessage && (
                              <p
                                className={`mt-1.5 rounded-r border-l-2 px-2 py-1 text-[9.5px] leading-snug font-semibold ${climaxSimMode === "utuh"
                                  ? "border-[#14532d] bg-[#14532d]/10 text-[#14532d]"
                                  : "border-[#7f1d1d] bg-[#7f1d1d]/10 text-[#5a1818]"
                                  }`}
                              >
                                {climaxWarningMessage}
                              </p>
                            )}
                          </div>

                          {/* Interactive Plot Beat Ordering */}
                          <div className="border-b border-[#5c3d1e]/30 pb-2">
                            <p className="text-[10px] font-bold text-[#2b1a0c]">
                              {isPlotComplete
                                ? "Hebat! Semua 5 kejadian Gunung Alur sudah urut!"
                                : `Misi A: Klik kalimat kejadian untuk mengisi titik ke-${plotCorrectCount + 1} (${BOLA_WAKTU_PLOT_BEATS[plotCorrectCount]?.stageLabel ?? "Selesai"}):`}
                            </p>

                            <div className="mt-1 space-y-1">
                              {BOLA_WAKTU_DISPLAY_ORDER_IDS.map((beatId) => {
                                const beat = BOLA_WAKTU_PLOT_BEATS.find(
                                  (item) => item.id === beatId
                                );
                                if (!beat) return null;
                                const placedIndex = state.plotPlacedIds.indexOf(
                                  beat.id
                                );
                                const isPlaced = placedIndex !== -1;

                                return (
                                  <button
                                    key={beat.id}
                                    type="button"
                                    onClick={() =>
                                      handlePlaceNextPlotBeat(beat.id)
                                    }
                                    className={`block w-full cursor-pointer border-b border-[#5c3d1e]/25 px-1.5 py-1 text-left font-serif text-[10px] leading-snug transition ${isPlaced
                                      ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                      : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                      }`}
                                  >
                                    {isPlaced
                                      ? `[✓ Titik ${placedIndex + 1}] `
                                      : "○ "}
                                    {beat.summary}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Uji Amanat & Refleksi */}
                          <div className="space-y-1.5">
                            <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              2. Misi B: Pilih Pesan Kebaikan (Amanat) Kisah Ivan:
                            </span>
                            {BOLA_WAKTU_AMANAT_OPTIONS.map((opt) => {
                              const isChosen =
                                state.selectedAmanatId === opt.id;
                              return (
                                <div key={opt.id} className="border-b border-[#5c3d1e]/25 pb-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAmanat(opt.id)}
                                    className={`block w-full cursor-pointer px-1.5 py-1 text-left font-serif text-[10px] leading-snug transition ${isChosen
                                      ? opt.isCorrect
                                        ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                        : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                      : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                      }`}
                                  >
                                    {isChosen
                                      ? opt.isCorrect
                                        ? "[Tepat ✓] "
                                        : "[Coba Lagi] "
                                      : "○ "}
                                    {opt.text}
                                  </button>
                                  {isChosen && (
                                    <p
                                      className={`px-1.5 pb-1 text-[9px] leading-snug italic ${opt.isCorrect
                                        ? "text-[#14532d]"
                                        : "text-[#7f1d1d]"
                                        }`}
                                    >
                                      {opt.feedback}
                                    </p>
                                  )}
                                </div>
                              );
                            })}

                            <div className="pt-1.5">
                              <label
                                htmlFor="amanat-reflection-input"
                                className="block text-[9.5px] font-bold tracking-wider text-[#4a2f15] uppercase"
                              >
                                Tulis Pesan Kebaikan Versimu Sendiri (Opsional):
                              </label>
                              <input
                                id="amanat-reflection-input"
                                type="text"
                                value={state.customAmanatReflection}
                                onChange={(e) =>
                                  handleCustomAmanatChange(e.target.value)
                                }
                                placeholder="Contoh: Aku ingin selalu bersyukur dan membantu orang tua..."
                                className="parchment-pen-input mt-0.5 w-full px-1 py-1 font-serif text-[10.5px] italic placeholder:text-[#6b4826]/60"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <span className="font-semibold">Halaman 2</span>
                        <button
                          type="button"
                          onClick={() => switchToChapter("watak")}
                          className="cursor-pointer font-bold text-[#2b1a0c] underline decoration-[#5c3d1e]/50 underline-offset-2 transition hover:text-black"
                        >
                          Lanjut Misi 2: Tokoh &amp; Indra -&gt;
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ============================================================= */}
                {/* SPREAD 2: BABAK II (PENOKOHAN, 4 KANTONG EMAS & PANCAINDRA)   */}
                {/* ============================================================= */}
                {!isShowingIntroSpread && activeChapter === "watak" && (
                  <>
                    {/* LEFT PAGE (HALAMAN 3): TOKOH, 4 KANTONG EMAS & PANCAINDRA */}
                    <div style={get2dPageStyle("left")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-1 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#4a2f15] uppercase sm:text-[10.5px]">
                            HALAMAN 3 · {CHAPTER_ORDER[1]!.tpTag}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleMaoEmasAudio}
                            className="cursor-pointer font-serif text-[9.5px] font-bold text-[#14532d] underline decoration-[#14532d]/60 underline-offset-2 transition hover:text-emerald-950"
                          >
                            {activeNarrationTrack === "mao-emas"
                              ? "[Matikan Suara]"
                              : "[Dengarkan Kisah Mao & Emas]"}
                          </button>
                        </div>

                        {/* Sub-tab Links on Parchment */}
                        <div className="mb-2 grid grid-cols-3 gap-1 border-b border-[#5c3d1e]/35 pb-1">
                          <button
                            type="button"
                            onClick={() => setWatakLeftTab("mao")}
                            className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${watakLeftTab === "mao"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                              }`}
                          >
                            1. Sifat Tokoh
                          </button>
                          <button
                            type="button"
                            onClick={() => setWatakLeftTab("emas")}
                            className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${watakLeftTab === "emas"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                              }`}
                          >
                            2. Empat Kantong Emas ({state.pouchOrderIds.length}/4)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWatakLeftTab("indra")}
                            className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${watakLeftTab === "indra"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                              }`}
                          >
                            3. Pancaindra
                          </button>
                        </div>

                        {watakLeftTab === "mao" && (
                          <div className="space-y-2 font-serif text-[#2b1a0c]">
                            <p className="text-[10.5px] leading-relaxed text-[#3a2512]">
                              Dalam cerita yang seru, sifat tokoh{" "}
                              <strong>
                                ditunjukkan lewat perbuatan dan ucapannya
                              </strong>
                              , bukan hanya disebut &ldquo;ia anak baik&rdquo;.
                              Ayo kenali tiga tokoh komik{" "}
                              <strong>&ldquo;Sihir Unik Mao&rdquo;</strong>:
                            </p>
                            <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                              <p className="text-[10px] font-bold text-[#4a2f15]">
                                1. Mao (Tokoh Utama / Protagonis)
                              </p>
                              <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                                Sering lupa dan gagal merapal mantra sihir,
                                tetapi rajin berlatih sampai bisa menyihir
                                makanan manis yang mendamaikan teman-temannya.
                              </p>
                            </div>
                            <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                              <p className="text-[10px] font-bold text-[#4a2f15]">
                                2. Piru (Sahabat Baik)
                              </p>
                              <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                                Setia menemani Mao berlatih dan selalu menyemangati
                                Mao saat diejek di kelas.
                              </p>
                            </div>
                            <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                              <p className="text-[10px] font-bold text-[#4a2f15]">
                                3. Yari (Tokoh Lawan / Antagonis)
                              </p>
                              <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                                Pintar sihir dasar, tetapi sombong dan suka mengejek
                                Mao di depan peri lain.
                              </p>
                            </div>
                          </div>
                        )}

                        {watakLeftTab === "emas" && (
                          <div className="space-y-2 font-serif text-[#2b1a0c]">
                            <div className="flex items-center justify-between">
                              <p className="text-[10.5px] font-bold text-[#2b1a0c]">
                                Misi Kantong Ajaib ({state.pouchOrderIds.length}/4):
                              </p>
                              <button
                                type="button"
                                onClick={handleResetPouchOrder}
                                className="cursor-pointer text-[9.5px] font-bold text-[#5c3d1e] underline hover:text-black"
                              >
                                Ulangi
                              </button>
                            </div>
                            <p className="text-[10px] leading-relaxed text-[#3a2512]">
                              Petunjuk: Klik keempat kantong ajaib Emas
                              secara berurutan dari bahaya awal sampai Raksasa
                              kalah di puncak klimaks!
                            </p>
                            {/* Meteran Eskalasi Ketegangan Konflik (Visual Naik 0% -> 35% -> 60% -> 85% -> 100%) */}
                            {(() => {
                              const tensionLevels = [0, 35, 60, 85, 100];
                              const pct = tensionLevels[state.pouchOrderIds.length] ?? 0;
                              return (
                                <div className="space-y-1 rounded border border-[#5c3d1e]/25 bg-[#5c3d1e]/6 px-2 py-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] font-bold">
                                    <span className="text-[#4a2f15]">
                                      Tingkat Ketegangan:
                                    </span>
                                    <span
                                      className={
                                        pct === 100
                                          ? "text-[#14532d]"
                                          : pct >= 60
                                            ? "text-[#7f1d1d]"
                                            : "text-[#4a2f15]"
                                      }
                                    >
                                      {pct}% {pct === 100 ? "(Klimaks Tercapai ✓)" : ""}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full border border-[#5c3d1e]/40 bg-[#5c3d1e]/15">
                                    <div
                                      style={{ width: `${pct}%` }}
                                      className={`h-full transition-all duration-300 ${pct === 100
                                        ? "bg-[#14532d]"
                                        : pct >= 60
                                          ? "bg-[#991b1b]"
                                          : "bg-[#854d0e]"
                                        }`}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="space-y-1.5 pt-0.5">
                              {EMAS_POUCH_DISPLAY_ORDER_IDS.map((pouchId) => {
                                const step = EMAS_POUCH_STEPS.find(
                                  (item) => item.pouchId === pouchId
                                );
                                if (!step) return null;
                                const isUnlocked = state.pouchOrderIds.includes(
                                  step.pouchId
                                );
                                return (
                                  <button
                                    key={step.pouchId}
                                    type="button"
                                    onClick={() =>
                                      handleAppendPouchStep(step.pouchId)
                                    }
                                    className={`block w-full cursor-pointer border-b border-[#5c3d1e]/30 px-1.5 py-1.5 text-left font-serif transition ${isUnlocked
                                      ? "bg-[#14532d]/15 text-[#14532d]"
                                      : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                      }`}
                                  >
                                    <div className="flex items-center justify-between text-[10.5px] font-bold">
                                      <span>
                                        {isUnlocked ? "[✓ Urut] " : "○ "}
                                        {step.itemName}
                                      </span>
                                      <span className="text-[9.5px] italic">
                                        {isUnlocked
                                          ? `Urutan ${step.order}`
                                          : "Pilih urutan"}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[10px] leading-snug text-[#3a2512]">
                                      {step.transformation}
                                    </p>
                                    {isUnlocked && (
                                      <p className="mt-0.5 text-[9.5px] leading-snug font-semibold text-[#5a1818]">
                                        {step.tensionLevel}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {watakLeftTab === "indra" && (
                          <div className="space-y-1.5 font-serif text-[#2b1a0c]">
                            <p className="text-[10.5px] leading-relaxed text-[#3a2512]">
                              Bandingkan <strong>Kalimat Biasa</strong> dengan{" "}
                              <strong>
                                Kalimat Hidup (melibatkan pancaindra)
                              </strong>{" "}
                              yang membuat pembaca ikut merasakan suasananya:
                            </p>
                            {FIVE_SENSES_GUIDE.map((gem) => (
                              <div
                                key={gem.id}
                                className="border-b border-[#5c3d1e]/30 pb-1.5"
                              >
                                <div className="flex items-center justify-between text-[10px] font-bold text-[#4a2f15]">
                                  <span>{gem.sense}</span>
                                  <span className="italic">
                                    {gem.sceneContext}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[9.5px] text-[#6b4826]">
                                  Kalimat Biasa: &ldquo;{gem.weakExample}&rdquo;
                                </p>
                                <p className="mt-0.5 text-[10px] font-semibold text-[#14532d]">
                                  Kalimat Hidup: &ldquo;{gem.vividExample}
                                  &rdquo;
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <button
                          type="button"
                          onClick={() => switchToChapter("alur")}
                          className="cursor-pointer font-bold text-[#3a2512] transition hover:text-black"
                        >
                          &lt;- Misi 1: Alur Cerita
                        </button>
                        <span className="font-semibold">Halaman 3</span>
                      </div>
                    </div>

                    {/* RIGHT PAGE (HALAMAN 4): TANTANGAN BUKTI WATAK & CITRAAN INDRA */}
                    <div style={get2dPageStyle("right")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#4a2f15] uppercase sm:text-[10.5px]">
                            HALAMAN 4 · TANTANGAN SEGEL 2
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-serif text-[9px] font-bold text-[#14532d] sm:text-[9.5px]">
                            {state.sealWatakUnlocked
                              ? "Segel 2 Selesai ✓"
                              : `Tokoh ${charDone ? "✓" : "○"} · Kantong ${state.pouchOrderIds.length}/4 · Indra ${sensoryDone ? "✓" : "○"}`}
                          </span>
                        </div>

                        <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                          {/* Live 1-Line Quest Prompt for Segel 2 */}
                          {state.sealWatakUnlocked ? (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-[#14532d]/55 bg-[#14532d]/12 px-2 py-1.5 text-[10px] font-bold text-[#14532d]">
                              <span>Mantap! Segel 2 (Tokoh &amp; Indra) Terbuka!</span>
                              <button
                                type="button"
                                onClick={() => switchToChapter("bahasa")}
                                className="cursor-pointer rounded-full bg-[#14532d] px-2.5 py-0.5 text-[9.5px] font-bold text-[#fdf6e7] hover:bg-emerald-950"
                              >
                                Lanjut Misi 3 -&gt;
                              </button>
                            </div>
                          ) : (
                            <div className="rounded border border-[#5c3d1e]/40 bg-[#5c3d1e]/10 px-2 py-1 text-[9.5px] leading-snug text-[#2b1a0c]">
                              <strong className="text-[#4a2f15]">Misi Sekarang:</strong>{" "}
                              {!charDone
                                ? "Pilih bukti perbuatan yang cocok untuk sifat Mao & Yari di Bagian A."
                                : !sensoryDone
                                  ? "Pilih 3 kalimat pancaindra yang paling hidup di Bagian B."
                                  : `Tinggal 1 lagi! Urutkan 4 Kantong Emas (${state.pouchOrderIds.length}/4) di Halaman 3 (kiri)!`}
                            </div>
                          )}

                          {/* Bagian A: Bukti Watak Tokoh */}
                          <div className="space-y-1.5 border-b border-[#5c3d1e]/35 pb-2">
                            <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              A. Misi Sifat Tokoh (Pilih Bukti Perbuatan/Ucapan):
                            </span>
                            {CHARACTER_EVIDENCE_CHALLENGES.map((chal) => {
                              const selectedOptId =
                                state.characterEvidenceAnswers[chal.id];
                              return (
                                <div
                                  key={chal.id}
                                  className="border-b border-[#5c3d1e]/20 pb-1.5 last:border-b-0"
                                >
                                  <div className="flex items-center justify-between text-[10px] font-bold text-[#2b1a0c]">
                                    <span>
                                      {chal.characterName} ({chal.roleBadge})
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-[9.5px] leading-snug text-[#4a2f15] italic">
                                    Sifat: {chal.traitClaim}
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    {chal.options.map((opt) => {
                                      const isChosen = selectedOptId === opt.id;
                                      return (
                                        <div key={opt.id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSelectCharacterTrait(
                                                chal.id,
                                                opt.id
                                              )
                                            }
                                            className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${isChosen
                                              ? opt.isValidEvidence
                                                ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                                : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                              : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                              }`}
                                          >
                                            {isChosen
                                              ? opt.isValidEvidence
                                                ? "[Tepat ✓] "
                                                : "[Coba Lagi] "
                                              : "○ "}
                                            {opt.quote}
                                          </button>
                                          {isChosen && (
                                            <p
                                              className={`px-1.5 py-0.5 text-[9px] leading-snug italic ${opt.isValidEvidence
                                                ? "text-[#14532d]"
                                                : "text-[#7f1d1d]"
                                                }`}
                                            >
                                              {opt.explanation}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Bagian B: Transformasi Kalimat Datar ke Pancaindra */}
                          <div className="space-y-1.5">
                            <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              B. Misi Pancaindra (Pilih Kalimat yang Paling Hidup):
                            </span>
                            {SENSORY_UPGRADE_CHALLENGES.map((sens) => {
                              const selectedOptId =
                                state.sensoryUpgradeAnswers[sens.id];
                              return (
                                <div
                                  key={sens.id}
                                  className="border-b border-[#5c3d1e]/20 pb-1.5 last:border-b-0"
                                >
                                  <p className="text-[10px] font-bold text-[#2b1a0c]">
                                    {sens.senseBadge} —{" "}
                                    <span className="font-normal italic">
                                      {sens.flatSentence}
                                    </span>
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    {sens.options.map((opt) => {
                                      const isChosen = selectedOptId === opt.id;
                                      return (
                                        <div key={opt.id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSelectSensoryUpgrade(
                                                sens.id,
                                                opt.id
                                              )
                                            }
                                            className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${isChosen
                                              ? opt.isRichSensory
                                                ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                                : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                              : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                              }`}
                                          >
                                            {isChosen
                                              ? opt.isRichSensory
                                                ? "[Hidup ✓] "
                                                : "[Masih Biasa] "
                                              : "○ "}
                                            {opt.text}
                                          </button>
                                          {isChosen && (
                                            <p
                                              className={`px-1.5 py-0.5 text-[9px] leading-snug italic ${opt.isRichSensory
                                                ? "text-[#14532d]"
                                                : "text-[#7f1d1d]"
                                                }`}
                                            >
                                              {opt.feedback}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {!pouchDone && (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[#5c3d1e]/30 pt-1.5">
                              <p className="text-[9.5px] font-semibold text-[#5a1818]">
                                Syarat ke-3 Segel 2: Urutkan 4 Kantong Emas ({state.pouchOrderIds.length}/4)!
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  playChime();
                                  setWatakLeftTab("emas");
                                  if (isMobileBook) setMobilePageSide("left");
                                }}
                                className="cursor-pointer rounded border border-[#5c3d1e]/70 bg-[#5c3d1e]/12 px-2 py-0.5 text-[9.5px] font-bold text-[#2b1a0c] hover:bg-[#5c3d1e]/22"
                              >
                                Buka Misi 4 Kantong Emas -&gt;
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <span className="font-semibold">Halaman 4</span>
                        <button
                          type="button"
                          onClick={() => switchToChapter("bahasa")}
                          className="cursor-pointer font-bold text-[#2b1a0c] underline decoration-[#5c3d1e]/50 underline-offset-2 transition hover:text-black"
                        >
                          Lanjut Misi 3: Gaya Bahasa -&gt;
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ============================================================= */}
                {/* SPREAD 3: BABAK III (LEKSIKON MAGIS, MAJAS & DIALOG)          */}
                {/* ============================================================= */}
                {!isShowingIntroSpread && activeChapter === "bahasa" && (
                  <>
                    {/* LEFT PAGE (HALAMAN 5): KAIDAH MAJAS ASOSIASI, DIALOG & LEKSIKON */}
                    <div style={get2dPageStyle("left")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-1 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                            HALAMAN 5 · {CHAPTER_ORDER[2]!.tpTag}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleMisiBahasaAudio}
                            className="cursor-pointer font-serif text-[9.5px] font-bold text-[#14532d] underline decoration-[#14532d]/60 underline-offset-2 transition hover:text-emerald-950 sm:text-[10px]"
                          >
                            {activeNarrationTrack === "misi-bahasa"
                              ? "[Matikan Panduan]"
                              : "[Dengarkan Panduan Bahasa]"}
                          </button>
                        </div>

                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          {/* 1. Majas Asosiasi / Simile */}
                          <div className="pb-1.5">
                            <h3 className="parchment-contour-warp text-[11px] font-bold text-[#2b1a0c]">
                              1. Kalimat Perumpamaan (Majas Asosiasi/Simile)
                            </h3>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-[#3a2512]">
                              Membandingkan dua hal agar cerita lebih hidup
                              dengan menggunakan kata:{" "}
                              <strong>
                                seperti, bagaikan, bak, laksana, ibarat
                              </strong>
                              .
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#14532d] italic">
                              Contoh: &ldquo;Kami berdua sulit menyatu{" "}
                              <strong>bagaikan</strong> minyak dan air.&rdquo;
                            </p>
                            <hr className="parchment-ink-rule mt-1.5" />
                          </div>

                          {/* 2. Kalimat Langsung vs Tak Langsung */}
                          <div className="pb-1.5">
                            <h3 className="parchment-contour-warp text-[11px] font-bold text-[#2b1a0c]">
                              2. Kalimat Langsung &amp; Tak Langsung
                            </h3>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-[#3a2512]">
                              • <strong>Kalimat Langsung:</strong> Ucapan tokoh
                              ditulis di dalam{" "}
                              <strong>tanda petik dua (&ldquo;...&rdquo;)</strong>{" "}
                              dan menggunakan kata <em>aku / kau</em>.
                            </p>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-[#14532d]">
                              • <strong>Kalimat Tak Langsung:</strong>{" "}
                              Menceritakan ulang ucapan tokoh{" "}
                              <strong>tanpa tanda petik dua</strong>, menggunakan kata{" "}
                              <em>bahwa / agar</em>, dan kata gantinya berubah
                              menjadi <em>ia / -nya</em>.
                            </p>
                            <div className="mt-1 space-y-0.5 border-l-2 border-[#14532d]/45 pl-2 text-[10px] leading-snug text-[#14532d] italic">
                              <p>
                                • <strong className="not-italic">Contoh Kalimat Langsung:</strong>{" "}
                                Ibu berkata, &ldquo;Aku bangga padamu, Ivan.&rdquo;
                              </p>
                              <p>
                                • <strong className="not-italic">Contoh Kalimat Tak Langsung:</strong>{" "}
                                Ibu mengatakan bahwa ia bangga kepada Ivan.
                              </p>
                            </div>
                            <hr className="parchment-ink-rule mt-1.5" />
                          </div>

                          {/* 3. Bank Kata & Frasa Fantasi (6 Kategori · 48 Entri + Filter Makna) */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                                3. Kamus Kata Fantasi (48 Diksi):
                              </span>
                              <div className="flex flex-wrap items-center gap-1">
                                {(["Semua", "Denotatif", "Konotatif", "Kiasan / Majas"] as const).map(
                                  (tf) => (
                                    <button
                                      key={tf}
                                      type="button"
                                      onClick={() => {
                                        playChime();
                                        setLexiconTypeFilter(tf);
                                      }}
                                      className={`cursor-pointer rounded px-1.5 py-0.5 text-[8.5px] font-bold transition ${lexiconTypeFilter === tf
                                        ? "bg-[#14532d] text-[#fdf6e7]"
                                        : "border border-[#5c3d1e]/35 text-[#4a2f15] hover:bg-[#5c3d1e]/10"
                                        }`}
                                    >
                                      {tf === "Kiasan / Majas" ? "Kiasan" : tf}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {FANTASY_LEXICON_BANK.map((cat) => {
                                const isPicked =
                                  selectedLexiconCategory.id === cat.id;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      playChime();
                                      setSelectedLexiconCatId(cat.id);
                                    }}
                                    className={`cursor-pointer rounded border px-1.5 py-0.5 font-serif text-[9px] transition ${isPicked
                                      ? "border-[#2b1a0c] bg-[#5c3d1e]/18 font-bold text-[#1f1207]"
                                      : "border-[#5c3d1e]/25 text-[#5c3d1e] hover:border-[#5c3d1e]/55"
                                      }`}
                                  >
                                    {cat.category}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-1 space-y-1 border-t border-[#5c3d1e]/25 pt-1 text-[9.5px] leading-snug">
                              {selectedLexiconCategory.entries
                                .filter(
                                  (entry) =>
                                    lexiconTypeFilter === "Semua" ||
                                    entry.type === lexiconTypeFilter
                                )
                                .map((entry) => (
                                  <div
                                    key={entry.word}
                                    className="border-b border-[#5c3d1e]/15 pb-1 last:border-b-0"
                                  >
                                    <span className="font-bold text-[#2b1a0c]">
                                      {entry.word}
                                    </span>{" "}
                                    <span className="text-[#6b4826] italic">
                                      ({entry.type})
                                    </span>{" "}
                                    — {entry.meaning}{" "}
                                    <span className="text-[#14532d] italic">
                                      Contoh: &ldquo;{entry.example}&rdquo;
                                    </span>
                                  </div>
                                ))}
                              {selectedLexiconCategory.entries.filter(
                                (entry) =>
                                  lexiconTypeFilter === "Semua" ||
                                  entry.type === lexiconTypeFilter
                              ).length === 0 && (
                                  <p className="py-1 text-[9px] italic text-[#6b4826]">
                                    Tidak ada entri bertipe {lexiconTypeFilter} di kategori ini. Pilih &ldquo;Semua&rdquo; atau kategori lain.
                                  </p>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <button
                          type="button"
                          onClick={() => switchToChapter("watak")}
                          className="cursor-pointer font-bold text-[#3a2512] transition hover:text-black"
                        >
                          &lt;- Misi 2: Tokoh &amp; Indra
                        </button>
                        <span className="font-semibold">Halaman 5</span>
                      </div>
                    </div>

                    {/* RIGHT PAGE (HALAMAN 6): TANTANGAN MAJAS & KONVERSI DIALOG */}
                    <div style={get2dPageStyle("right")} className={page2dContainerClass}>
                      <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                        <div className="mb-1.5 flex min-h-[26px] shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-[#5c3d1e]/35 pb-1">
                          <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#4a2f15] uppercase sm:text-[10.5px]">
                            HALAMAN 6 · TANTANGAN SEGEL 3
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-serif text-[9px] font-bold text-[#14532d] sm:text-[9.5px]">
                            {state.sealBahasaUnlocked
                              ? "Segel 3 Selesai ✓"
                              : `Majas ${majasDone ? "✓" : "○"} · Dialog ${dialogueDone ? "✓" : "○"}`}
                          </span>
                        </div>

                        <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                          {/* Live 1-Line Quest Prompt for Segel 3 */}
                          {state.sealBahasaUnlocked ? (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-[#14532d]/55 bg-[#14532d]/12 px-2 py-1.5 text-[10px] font-bold text-[#14532d]">
                              <span>
                                {totalSealsUnlocked >= 3
                                  ? "Semua 3 Segel Rahasia Terkumpul!"
                                  : "Keren! Segel 3 (Gaya Bahasa) Terbuka!"}
                              </span>
                              <button
                                type="button"
                                onClick={onNavigateToStudioTulis}
                                className="cursor-pointer rounded-full bg-[#14532d] px-2.5 py-0.5 text-[9.5px] font-bold text-[#fdf6e7] hover:bg-emerald-950"
                              >
                                Ayo Mengarang di Studio Tulis -&gt;
                              </button>
                            </div>
                          ) : (
                            <div className="rounded border border-[#5c3d1e]/40 bg-[#5c3d1e]/10 px-2 py-1 text-[9.5px] leading-snug text-[#2b1a0c]">
                              <strong className="text-[#4a2f15]">Misi Sekarang:</strong>{" "}
                              {!majasDone
                                ? "Pasangkan Kata Pembanding & Perumpamaan di Bagian A sampai ketiga kalimatnya hijau!"
                                : "Pilih kalimat tak langsung yang benar pada 2 soal Dialog di Bagian B bawah!"}
                            </div>
                          )}

                          {/* Tantangan A: Kawah Peracik Majas Asosiasi */}
                          <div className="space-y-1.5 border-b border-[#5c3d1e]/35 pb-2">
                            <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              A. Misi Perumpamaan (Pilih Pasangan Kata yang Cocok):
                            </span>
                            {MAJAS_ASOSIASI_CHALLENGES.map((majas) => {
                              const pair = state.majasAnswers[majas.id] ?? {
                                connector: "",
                                comparison: "",
                              };
                              const isPairFilled =
                                pair.connector !== "" && pair.comparison !== "";
                              const isSolved =
                                pair.connector === majas.correctConnector &&
                                pair.comparison === majas.correctComparison;
                              const livePreviewSentence = majas.blankPrompt
                                .replace(
                                  "[Kata Pembanding]",
                                  pair.connector || "[Kata Pembanding]"
                                )
                                .replace(
                                  "[Perumpamaan]",
                                  pair.comparison || "[Perumpamaan]"
                                );

                              return (
                                <div
                                  key={majas.id}
                                  className="border-b border-[#5c3d1e]/20 pb-1.5 last:border-b-0"
                                >
                                  <p className="text-[9.5px] font-semibold text-[#3a2512]">
                                    {majas.contextSentence}
                                  </p>
                                  <p
                                    className={`mt-1 rounded-r border-l-2 px-2 py-0.5 text-[9.5px] leading-snug italic ${isSolved
                                      ? "border-[#14532d] bg-[#14532d]/10 font-bold text-[#14532d]"
                                      : isPairFilled
                                        ? "border-[#7f1d1d] bg-[#7f1d1d]/10 font-semibold text-[#7f1d1d]"
                                        : "border-[#5c3d1e]/50 bg-[#5c3d1e]/6 text-[#4a2f15]"
                                      }`}
                                  >
                                    &ldquo;{livePreviewSentence}&rdquo;
                                  </p>
                                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[8.5px] font-bold text-[#5c3d1e] uppercase">
                                        Kata Pembanding:
                                      </label>
                                      <ParchmentSelect
                                        ariaLabel={`Kata pembanding untuk ${majas.id}`}
                                        value={pair.connector}
                                        placeholder="-- Pilih Penanda --"
                                        size="sm"
                                        options={majas.connectorChoices.map((c) => ({
                                          value: c,
                                          label: c,
                                        }))}
                                        onChange={(nextVal) =>
                                          handleUpdateMajasPair(
                                            majas.id,
                                            "connector",
                                            nextVal
                                          )
                                        }
                                        triggerClassName="mt-0.5 font-serif font-bold italic"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8.5px] font-bold text-[#5c3d1e] uppercase">
                                        Citraan Perumpamaan:
                                      </label>
                                      <ParchmentSelect
                                        ariaLabel={`Perumpamaan untuk ${majas.id}`}
                                        value={pair.comparison}
                                        placeholder="-- Pilih Perumpamaan --"
                                        size="sm"
                                        options={majas.comparisonChoices.map((comp) => ({
                                          value: comp,
                                          label: comp,
                                        }))}
                                        onChange={(nextVal) =>
                                          handleUpdateMajasPair(
                                            majas.id,
                                            "comparison",
                                            nextVal
                                          )
                                        }
                                        triggerClassName="mt-0.5 font-serif font-bold italic"
                                      />
                                    </div>
                                  </div>
                                  {isSolved ? (
                                    <p className="mt-0.5 text-[9px] font-bold text-[#14532d]">
                                      [Tepat ✓] {majas.explanation}
                                    </p>
                                  ) : isPairFilled ? (
                                    <p className="mt-0.5 text-[9px] font-semibold text-[#7f1d1d]">
                                      [Belum Cocok] Cek lagi apakah &ldquo;{pair.connector}&rdquo; termasuk kata pembanding (seperti/bagaikan/laksana) dan apakah perumpamaannya cocok dengan kalimat konteks!
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          {/* Tantangan B: Transmutasi Kalimat Langsung -> Tak Langsung */}
                          <div className="space-y-1.5">
                            <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              B. Misi Dialog (Pilih Kalimat Tak Langsung yang Benar):
                            </span>
                            {DIALOGUE_TRANSMUTATION_CHALLENGES.map((dlg) => {
                              const selectedOptId =
                                state.dialogueAnswers[dlg.id];
                              return (
                                <div
                                  key={dlg.id}
                                  className="border-b border-[#5c3d1e]/20 pb-1.5 last:border-b-0"
                                >
                                  <p className="text-[10px] font-bold text-[#2b1a0c]">
                                    {dlg.speaker}:{" "}
                                    <span className="font-normal italic">
                                      {dlg.directSpeech}
                                    </span>
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    {dlg.options.map((opt) => {
                                      const isChosen = selectedOptId === opt.id;
                                      return (
                                        <div key={opt.id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSelectDialogueOption(
                                                dlg.id,
                                                opt.id
                                              )
                                            }
                                            className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${isChosen
                                              ? opt.isCorrect
                                                ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                                : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                              : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                              }`}
                                          >
                                            {isChosen
                                              ? opt.isCorrect
                                                ? "[Tepat ✓] "
                                                : "[Coba Lagi] "
                                              : "○ "}
                                            {opt.text}
                                          </button>
                                          {isChosen && (
                                            <p
                                              className={`px-1.5 py-0.5 text-[9px] leading-snug italic ${opt.isCorrect
                                                ? "text-[#14532d]"
                                                : "text-[#7f1d1d]"
                                                }`}
                                            >
                                              {opt.ruleExplanation}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                        <span className="font-semibold">Halaman 6</span>
                        <button
                          type="button"
                          onClick={onNavigateToStudioTulis}
                          className="cursor-pointer font-bold text-[#14532d] underline decoration-[#14532d]/60 underline-offset-2 transition hover:text-emerald-950"
                        >
                          Ayo Mengarang di Studio Tulis -&gt;
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Layer 4 & 5: Desktop Book Spine Shadow & 3D Hinge Flipper */}
              {!isMobileBook && <ParchmentSpineShadowOverlay />}

              {!isMobileBook && flipDirection !== null && (
                <div
                  style={{
                    left: flipDirection === "next" ? "49.05%" : "6.55%",
                    top: "2.16%",
                    width: flipDirection === "next" ? "44.40%" : "42.49%",
                    height: "95.02%",
                    backgroundImage: "url('/assets/studio/single-page.webp')",
                    backgroundSize:
                      flipDirection === "next"
                        ? "327.62% 134.03%"
                        : "342.29% 134.03%",
                    backgroundPosition:
                      flipDirection === "next"
                        ? "71.03% 53.33%"
                        : "28.44% 53.33%",
                    backgroundRepeat: "no-repeat",
                    transformOrigin:
                      flipDirection === "next" ? "left center" : "right center",
                    backfaceVisibility: "hidden",
                  }}
                  className={`pointer-events-none absolute z-30 drop-shadow-[0_0_35px_rgba(0,0,0,0.65)] ${flipDirection === "next"
                    ? "animate-studio-flip-next"
                    : "animate-studio-flip-prev"
                    }`}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Mobile Thumb-Zone Page Switcher (Materi <-> Tantangan) */}
          {isMobileBook && !isCalibrating && (
            <div className="relative z-30 grid w-full max-w-[480px] shrink-0 grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  playPageFlip();
                  setMobilePageSide("left");
                }}
                className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-bold shadow-[0_8px_22px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all cursor-pointer ${mobilePageSide === "left"
                  ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                  : "border-[#d6b26f]/55 bg-slate-950/92 text-amber-100"
                  }`}
              >
                {isShowingIntroSpread ? "1. Panduan Awal" : "1. Baca Materi"}
              </button>
              <button
                type="button"
                onClick={() => {
                  playPageFlip();
                  setMobilePageSide("right");
                }}
                className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-bold shadow-[0_8px_22px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all cursor-pointer ${mobilePageSide === "right"
                  ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                  : "border-emerald-400/60 bg-emerald-950/92 text-emerald-100"
                  }`}
              >
                {isShowingIntroSpread
                  ? "2. Daftar 3 Misi ->"
                  : "2. Main Tantangan ->"}
              </button>
            </div>
          )}

          {/* Guided 3-Step Interactive Walkthrough Card for Materi (Grade 7 Friendly) */}
          {materiTourStep !== null && !isCalibrating && (
            <div className="pointer-events-auto fixed inset-x-3 bottom-16 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px] z-50 rounded-2xl border-2 border-[#f4d993] bg-slate-950/96 p-3.5 text-stone-100 shadow-[0_18px_45px_rgba(0,0,0,0.95)] backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#cda250]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f4d993]">
                  Panduan Singkat Pustaka
                </span>
                <button
                  type="button"
                  onClick={handleDismissMateriTour}
                  className="text-[11px] font-semibold text-stone-400 hover:text-white cursor-pointer"
                >
                  Lewati [X]
                </button>
              </div>
              <h3 className="font-serif text-sm font-bold text-white">
                {MATERI_TOUR_STEPS[materiTourStep]?.title}
              </h3>
              <p className="text-xs text-stone-200 leading-relaxed">
                {MATERI_TOUR_STEPS[materiTourStep]?.body}
              </p>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  {MATERI_TOUR_STEPS.map((st, idx) => (
                    <span
                      key={st.title}
                      className={`h-1.5 rounded-full transition-all ${idx === materiTourStep
                        ? "w-5 bg-[#f4d993]"
                        : "w-1.5 bg-white/25"
                        }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleNextMateriTour}
                  className="rounded-full bg-[#f4d993] px-3.5 py-1 text-[11px] font-bold text-[#030712] hover:bg-white transition-colors cursor-pointer"
                >
                  {materiTourStep === MATERI_TOUR_STEPS.length - 1
                    ? "Siap Belajar!"
                    : "Lanjut ->"}
                </button>
              </div>
            </div>
          )}

          {isCalibrating && (
            <BookHomographyCalibrator
              stageWidth={book2dLayout.width}
              stageHeight={book2dLayout.height}
              stageOffsetX={book2dLayout.offsetX}
              stageOffsetY={book2dLayout.offsetY}
              stageScale={book2dScale}
              calibration={book2dCalibration}
              leftMatrixCss={book2dLeftMatrixCss}
              rightMatrixCss={book2dRightMatrixCss}
              onChangeCalibration={setBook2dCalibration}
              onResetCalibration={() =>
                setBook2dCalibration(READING_2D_DEFAULT_CALIBRATION)
              }
              onClose={() => setIsCalibrating(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default KitabMateriOverlay;
