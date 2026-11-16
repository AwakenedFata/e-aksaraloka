"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ParchmentInkFilters,
  ParchmentSpineShadowOverlay,
} from "@/components/shared/ParchmentInkFilters";
import { BookHomographyCalibrator } from "@/components/shared/BookHomographyCalibrator";
import {
  buildPageDisplacementSpec,
  computeCoverStageMetrics,
  computeHomographyMatrix3d,
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
  BOLA_WAKTU_PLOT_BEATS,
  CHARACTER_EVIDENCE_CHALLENGES,
  DIALOGUE_TRANSMUTATION_CHALLENGES,
  EMAS_POUCH_STEPS,
  FANTASY_LEXICON_BANK,
  MAJAS_ASOSIASI_CHALLENGES,
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
  getAudioNarratingSnapshot,
  playChime,
  playErrorTone,
  playPageFlip,
  playSealUnlock,
  stopSpeechNarration,
  subscribeAudioState,
  toggleSpeechNarration,
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
    shortLabel: "Babak I: Alur & Waktu",
    label: "Babak I: Alur, Lintas Waktu & Amanat",
    subtitle: "Bola-Bola Waktu, Gunung Alur Interaktif & Refleksi Amanat",
    tpTag: "TP 1 & TP 2 — Unsur Intrinsik & Struktur Alur",
    leftPageNo: 1,
    rightPageNo: 2,
  },
  {
    id: "watak",
    shortLabel: "Babak II: Watak & Indera",
    label: "Babak II: Penokohan, Konflik & 5 Indera",
    subtitle: "Bukti Watak Mao & Yari, Eskalasi 4 Kantong Emas & Citraan",
    tpTag: "TP 1 & TP 3 — Penokohan & Deskripsi Latar",
    leftPageNo: 3,
    rightPageNo: 4,
  },
  {
    id: "bahasa",
    shortLabel: "Babak III: Bahasa & Dialog",
    label: "Babak III: Leksikon Magis, Majas & Dialog",
    subtitle: "Bank Kata Fantasi, Majas Asosiasi & Kalimat Langsung/Tak Langsung",
    tpTag: "TP 4 — Kaidah Kebahasaan Cerita Fantasi",
    leftPageNo: 5,
    rightPageNo: 6,
  },
] as const;

const TIME_ORB_DATA = [
  {
    id: "masa-kini-awal",
    eraLabel: "1. Masa Kini (04.00 Pagi)",
    location: "Rumah Ivan & Kantin Sekolah",
    summary:
      "Setiap pukul empat pagi Ivan membantu ibunya membuat kue basah untuk dititipkan di kantin sekolah. Namun, Ivan merasa malu karena Fiam sering mengejeknya sebagai 'tukang kue'.",
    evidenceFocus:
      "Orientasi & Pemantik Masalah: Memperkenalkan tokoh utama (Ivan), latar keseharian, dan konflik batin akibat rasa gengsi.",
  },
  {
    id: "lintas-tahun-2022",
    eraLabel: "2. Lompatan Waktu (Tahun 2022)",
    location: "Lorong Bola Waktu -> Tahun 2022",
    summary:
      "Pria berkerudung hitam memberikan bola-bola waktu bercahaya. Ivan memilih bola merah untuk melompat ke tahun 2022 demi menjadi atlet basket populer tanpa harus berjualan kue.",
    evidenceFocus:
      "Komplikasi & Klimaks: Anomali lintas waktu membawa konsekuensi berat — di tahun 2022, Ayah Ivan telah wafat karena kelelahan bekerja seorang diri.",
  },
  {
    id: "kembali-masa-kini",
    eraLabel: "3. Kembali ke Masa Kini",
    location: "Kamar Ivan & Pelukan Orang Tua",
    summary:
      "Ivan menangis menyesal di makam ayahnya hingga terbangun kembali di masa kini. Ia memeluk kedua orang tuanya dengan penuh syukur dan bangga membantu ibunya sambil berlatih basket.",
    evidenceFocus:
      "Resolusi & Amanat: Perubahan watak tokoh secara logis setelah melewati puncak konflik batin.",
  },
] as const;

const PLOT_MOUNTAIN_COORDS: readonly {
  readonly order: number;
  readonly xPercent: number;
  readonly yPercent: number;
}[] = [
  { order: 1, xPercent: 10, yPercent: 80 },
  { order: 2, xPercent: 32, yPercent: 54 },
  { order: 3, xPercent: 52, yPercent: 32 },
  { order: 4, xPercent: 72, yPercent: 14 },
  { order: 5, xPercent: 90, yPercent: 76 },
] as const;

const FIVE_SENSES_GUIDE = [
  {
    id: "sense-visual",
    sense: "1. Citraan Penglihatan (Visual)",
    sceneContext: "Bola-Bola Waktu (hlm. 52–58)",
    weakExample: "Ivan melihat bola waktu yang bagus di tangan pria itu.",
    vividExample:
      "Bola kristal merah delima itu berpendar menembus kabut keperakan di sela jari pria berjubah hitam.",
  },
  {
    id: "sense-auditori",
    sense: "2. Citraan Pendengaran (Auditori)",
    sceneContext: "Keberanian Emas (hlm. 64–67)",
    weakExample: "Suara langkah Raksasa terdengar sangat keras.",
    vividExample:
      "Dentuman langkah kaki Raksasa menggetarkan tanah hutan, disusul geraman berat yang merontokkan daun kering.",
  },
  {
    id: "sense-penciuman",
    sense: "3. Citraan Penciuman & Peraba (Olfaktori/Taktil)",
    sceneContext: "Sihir Unik Mao (hlm. 59–62)",
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
  onNavigateToStudioTulis,
  onOpenPetaModal,
}: KitabMateriOverlayProps) {
  const { state, metrics } = useAksaralokaLearning();
  const activeChapter = state.activeGrimoireChapter;

  const [isIntroViewOpen, setIsIntroViewOpen] = useState<boolean>(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(
    null
  );
  const flipTimerRef = useRef<number | null>(null);

  const [selectedOrbId, setSelectedOrbId] = useState<string>(
    TIME_ORB_DATA[0].id
  );
  const [climaxWarningMessage, setClimaxWarningMessage] = useState<
    string | null
  >(null);
  const [watakLeftTab, setWatakLeftTab] = useState<"mao" | "emas" | "indera">(
    "mao"
  );
  const [selectedLexiconCatId, setSelectedLexiconCatId] = useState<string>(
    FANTASY_LEXICON_BANK[0]?.id ?? "lex-cahaya"
  );
  const [isNarrating, setIsNarrating] = useState<boolean>(() =>
    getAudioNarratingSnapshot()
  );
  const [feedbackToast, setFeedbackToast] = useState<{
    tone: "emerald" | "amber" | "rose";
    text: string;
  } | null>(null);
  const [stageMetrics, setStageMetrics] = useState<CoverStageMetrics>({
    width: STAGE_SOURCE_WIDTH,
    height: STAGE_SOURCE_HEIGHT,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
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
      setStageMetrics(
        computeCoverStageMetrics(window.innerWidth, window.innerHeight)
      );
    };
    const rafId = window.requestAnimationFrame(syncCoverStage);
    window.addEventListener("resize", syncCoverStage);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncCoverStage);
    };
  }, []);

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
      setIsNarrating(getAudioNarratingSnapshot());
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
        trigger2DHingeFlip(direction, () => {
          setIsIntroViewOpen(false);
          setActiveGrimoireChapter(targetChapter);
        });
      } else {
        playPageFlip();
        onTriggerPageFlip(direction, () => {
          setIsIntroViewOpen(false);
          setActiveGrimoireChapter(targetChapter);
        });
      }
    },
    [
      activeChapter,
      activeChapterIndex,
      flipDirection,
      isBookFocused,
      isPageFlipping,
      isShowingIntroSpread,
      onTriggerPageFlip,
      trigger2DHingeFlip,
    ]
  );

  const handleOpenIntroSpread = useCallback(() => {
    if (isShowingIntroSpread || flipDirection !== null) return;
    stopSpeechNarration();
    if (isBookFocused) {
      trigger2DHingeFlip("prev", () => {
        setIsIntroViewOpen(true);
      });
    } else {
      setIsIntroViewOpen(true);
      onSetBookFocused(true);
      playPageFlip();
    }
  }, [
    flipDirection,
    isBookFocused,
    isShowingIntroSpread,
    onSetBookFocused,
    trigger2DHingeFlip,
  ]);

  const handleOpenGrimoireScroll = useCallback(() => {
    stopSpeechNarration();
    if (isBookFocused) {
      trigger2DHingeFlip("next", () => {
        markGrimoireIntroOpened();
        setIsIntroViewOpen(false);
        setActiveGrimoireChapter("alur");
        showToast(
          "emerald",
          "Gulungan Kitab Aksaraloka terbuka. Selesaikan tantangan di setiap babak untuk membuka 3 Segel Naratif."
        );
      });
    } else {
      markGrimoireIntroOpened();
      setIsIntroViewOpen(false);
      setActiveGrimoireChapter("alur");
      playPageFlip();
      showToast(
        "emerald",
        "Gulungan Kitab Aksaraloka terbuka. Selesaikan tantangan di setiap babak untuk membuka 3 Segel Naratif."
      );
    }
  }, [isBookFocused, showToast, trigger2DHingeFlip]);

  // =========================================================================
  // BABAK 1 HANDLERS: BOLA WAKTU, GUNUNG ALUR & AMANAT
  // =========================================================================
  const handleToggleBolaWaktuAudio = useCallback(() => {
    const started = toggleSpeechNarration(BOLA_WAKTU_AUDIO_SCRIPT);
    if (started) {
      showToast("amber", "Memutar sulih suara ringkasan cerita Bola-Bola Waktu...");
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
      const wasUnlocked = state.sealAlurUnlocked;
      const nextState = updateLearningState((prev) => ({
        ...prev,
        climaxSimulationTested: true,
      }));

      if (nextState.sealAlurUnlocked && !wasUnlocked) {
        window.setTimeout(() => playSealUnlock(), 120);
      }

      if (mode === "tanpa-klimaks") {
        playErrorTone();
        setClimaxWarningMessage(
          "SIMULASI TANPA KLIMAKS (CACAT LOGIKA ALUR): Jika Ivan melompat ke tahun 2022 lalu langsung bahagia tanpa pernah mengalami guncangan batin kehilangan Ayahnya, cerita terasa datar dan tidak memberi alasan logis mengapa Ivan berubah sikap!"
        );
      } else {
        playChime();
        setClimaxWarningMessage(
          "ALUR UTUH DENGAN KLIMAKS: Puncak konflik di tahun 2022 saat Ivan mendapati makam Ayahnya memicu penyesalan mendalam, sehingga perubahan watak Ivan di Resolusi terasa kuat dan masuk akal."
        );
      }
    },
    [state.sealAlurUnlocked]
  );

  const handleResetPlotMountain = useCallback(() => {
    updateLearningState((prev) => ({
      ...prev,
      plotPlacedIds: [],
    }));
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
  // BABAK 2 HANDLERS: WATAK, 4 KANTONG EMAS & 5 INDERA
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
        <div className="pointer-events-none fixed top-14 left-1/2 z-50 -translate-x-1/2 px-4">
          <div
            className={`rounded-full border px-4 py-1.5 text-[11px] font-bold shadow-[0_12px_28px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all ${
              feedbackToast.tone === "emerald"
                ? "border-emerald-300/60 bg-emerald-950/90 text-emerald-100"
                : feedbackToast.tone === "rose"
                  ? "border-rose-300/60 bg-rose-950/90 text-rose-100"
                  : "border-[#f3d89b]/60 bg-slate-950/90 text-[#ffe8b6]"
            }`}
          >
            {feedbackToast.text}
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

          {/* Cover-Matched Stage Container: Locked 1:1 with 1920x1080 Canvas Geometry */}
          <div
            className="pointer-events-none fixed overflow-hidden"
            style={{
              left: `${stageMetrics.offsetX}px`,
              top: `${stageMetrics.offsetY}px`,
              width: `${stageMetrics.width}px`,
              height: `${stageMetrics.height}px`,
            }}
          >
            {/* Left 3D Page: Calibrated 4-Point Homography + Smooth Page Arch Curve */}
            <div
              onClick={() => {
                if (isCalibrating) return;
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
              aria-label="Klik halaman kiri buku untuk membuka Mode Fokus Membaca Buku 2D"
              className={`parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus:outline-none ${
                isPageFlipping ? "opacity-0" : ""
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
                      ? "GULUNGAN PEMBUKA"
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
                      Kitab Aksaraloka: Rahasia Cerita Fantasi
                    </p>
                    <p
                      className="font-serif text-[#2f1a09]/92"
                      style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                    >
                      Cerita fantasi adalah kisah fiksi imajinatif yang
                      menghadirkan keajaiban, lintas waktu, atau dunia paralel
                      yang tidak mungkin terjadi di dunia nyata, namun tetap
                      memiliki hukum sebab-akibat dan amanat.
                    </p>
                    <p
                      className="font-serif font-bold text-[#3f230b]/92 italic"
                      style={{ fontSize: scalePx(14.8), paddingTop: scalePx(8), lineHeight: 1.48 }}
                    >
                      Teks Model: &ldquo;Bola-Bola Waktu&rdquo;, &ldquo;Sihir
                      Unik Mao&rdquo; &amp; &ldquo;Keberanian Emas&rdquo;
                    </p>
                  </div>
                ) : activeChapter === "alur" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                    <p
                      className="font-serif font-bold text-[#241306]/92"
                      style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                    >
                      Kisah &ldquo;Bola-Bola Waktu&rdquo; (Hlm. 52–58)
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
                      Era Aktif: {selectedOrb.eraLabel} ({selectedOrb.location})
                    </p>
                    <p
                      className="font-serif text-[#3f230b]/92 italic"
                      style={{ fontSize: scalePx(14.5), lineHeight: 1.45 }}
                    >
                      Status Segel I:{" "}
                      {state.sealAlurUnlocked
                        ? "Terbuka (Gunung Alur & Amanat Tuntas)"
                        : `Gunung Alur ${plotCorrectCount}/5 Tahap`}
                    </p>
                  </div>
                ) : activeChapter === "watak" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                    <p
                      className="font-serif font-bold text-[#241306]/92"
                      style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                    >
                      Watak Mao &amp; Yari, 4 Kantong Emas &amp; 5 Indera
                    </p>
                    <p
                      className="font-serif text-[#2f1a09]/92"
                      style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                    >
                      Mao pantang menyerah di Sekolah Peri Juara, sementara Emas
                      lolos dari kejaran Raksasa berkat eskalasi 4 kantong
                      keajaiban (Biji Timun, Jarum, Garam, Terasi).
                    </p>
                    <p
                      className="font-serif font-semibold text-[#4b2e13]/92"
                      style={{ fontSize: scalePx(14.5), paddingTop: scalePx(6), lineHeight: 1.45 }}
                    >
                      Eskalasi Kantong Emas: {state.pouchOrderIds.length}/4 Tahap
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: scalePx(10), paddingTop: scalePx(6) }}>
                    <p
                      className="font-serif font-bold text-[#241306]/92"
                      style={{ fontSize: scalePx(23.5), lineHeight: 1.24 }}
                    >
                      Kaidah Bahasa: Majas Asosiasi &amp; Dialog EYD V
                    </p>
                    <p
                      className="font-serif text-[#2f1a09]/92"
                      style={{ fontSize: scalePx(16.8), lineHeight: 1.56 }}
                    >
                      Majas Asosiasi membandingkan dua hal secara eksplisit
                      menggunakan kata pembanding (seperti, bagaikan, laksana),
                      sedangkan transmutasi dialog mengubah petikan langsung ke
                      tak langsung.
                    </p>
                    <p
                      className="font-serif font-semibold text-[#4b2e13]/92"
                      style={{ fontSize: scalePx(14.5), paddingTop: scalePx(6), lineHeight: 1.45 }}
                    >
                      Kategori Leksikon: {selectedLexiconCategory.category}
                    </p>
                  </div>
                )}
                </div>
              </div>

              <div
                className="book-ink-step-4 border-t border-[#5c3d1e]/30 font-semibold text-[#5a3918]/85"
                style={{ fontSize: scalePx(12.2), paddingTop: scalePx(5) }}
              >
                Kitab Aksaraloka · Bahasa Indonesia SMP Kelas VII
              </div>
              </div>
            </div>

            {/* Right 3D Page: Calibrated 4-Point Homography + Smooth Page Arch Curve */}
            <div
              onClick={() => {
                if (isCalibrating) return;
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
              aria-label="Klik halaman kanan buku untuk membuka Mode Fokus Membaca Buku 2D"
              className={`parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus:outline-none ${
                isPageFlipping ? "opacity-0" : ""
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
                  <span>LAB INTERAKTIF &amp; SEGEL</span>
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
                    Capaian Penguasaan Materi: {masteryPercentage}% (
                    {totalSealsUnlocked}/3 Segel)
                  </p>
                  <p className="text-[#2f1a09]/92">
                    • Segel I (Alur &amp; Amanat):{" "}
                    <span className="font-bold">
                      {state.sealAlurUnlocked
                        ? "TERBUKA"
                        : `${plotCorrectCount}/5 Alur · ${isAmanatDone ? "Amanat Tuntas" : "Amanat Belum"}`}
                    </span>
                  </p>
                  <p className="text-[#2f1a09]/92">
                    • Segel II (Watak &amp; Indera):{" "}
                    <span className="font-bold">
                      {state.sealWatakUnlocked
                        ? "TERBUKA"
                        : `Watak ${charDone ? "Tuntas" : "Belum"} · Kantong ${state.pouchOrderIds.length}/4`}
                    </span>
                  </p>
                  <p className="text-[#2f1a09]/92">
                    • Segel III (Majas &amp; Dialog):{" "}
                    <span className="font-bold">
                      {state.sealBahasaUnlocked
                        ? "TERBUKA"
                        : `Majas ${majasDone ? "Tuntas" : "Belum"} · Dialog ${dialogueDone ? "Tuntas" : "Belum"}`}
                    </span>
                  </p>
                </div>
              </div>

              <div
                className="book-ink-step-4 border-t border-[#5c3d1e]/30 text-right font-semibold text-[#5a3918]/85"
                style={{ fontSize: scalePx(12.2), paddingTop: scalePx(5) }}
              >
                Klik buku untuk membaca &amp; membedah materi
              </div>
              </div>
            </div>
          </div>

          {/* Non-obstructing Call-to-Action Pill at Lower Book Center */}
          {!isCalibrating && (
            <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center sm:bottom-18">
              <button
                type="button"
                onClick={() => {
                  playPageFlip();
                  onSetBookFocused(true);
                }}
                className="pointer-events-auto cursor-pointer rounded-full border border-[#f3d89b]/80 bg-slate-950/88 px-4 py-1.5 text-[11px] font-bold tracking-wider text-[#ffe8b6] shadow-[0_12px_30px_rgba(0,0,0,0.85)] backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:bg-slate-900 sm:px-5 sm:py-2 sm:text-xs"
              >
                Klik Buku untuk Membaca &amp; Bedah Materi -&gt;
              </button>
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

          {/* ================================================================= */}
          {/* BOTTOM 3D MODE FLOATING ACTION DOCK BAR                           */}
          {/* ================================================================= */}
          <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-4 sm:px-6">
            <div className="pointer-events-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#d6b26f]/35 bg-slate-950/80 px-3.5 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.85)] backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] font-medium text-amber-100/80">
                  Segel Kitab:{" "}
                  <strong className="font-bold text-[#ffe8b6]">
                    {totalSealsUnlocked}/3 Terbuka ({masteryPercentage}%)
                  </strong>
                </span>

                <div className="mx-1 hidden h-3.5 w-px bg-[#d6b26f]/30 sm:block" />

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
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all disabled:opacity-40 sm:text-[11px] ${
                        isCurrent
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

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={onOpenPetaModal}
                  className="cursor-pointer rounded-full border border-[#d6b26f]/45 bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-[#f5ddab] transition hover:border-[#f3d89b] hover:bg-slate-800"
                >
                  Peta Belajar &amp; LKS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playPageFlip();
                    onSetBookFocused(true);
                  }}
                  className="cursor-pointer rounded-full border border-[#f3d89b]/70 bg-amber-950/80 px-3.5 py-1 text-[11px] font-bold text-[#ffe8b6] transition hover:border-[#f3d89b] hover:bg-amber-900/90"
                >
                  Buka Buku 2D
                </button>
                <button
                  type="button"
                  onClick={onNavigateToStudioTulis}
                  className="cursor-pointer rounded-full border border-emerald-400/60 bg-emerald-900/85 px-3.5 py-1 text-[11px] font-bold text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition hover:border-emerald-300 hover:bg-emerald-800"
                >
                  Lanjut ke Studio Tulis -&gt;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* STATE B: MODE FOKUS BUKU 2D (PURE FLOATING BOOK ON THIN BLUR)       */}
      {/* =================================================================== */}
      {isBookFocused && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center gap-1.5 bg-black/10 px-2 py-1.5 backdrop-blur-[6px] transition-all duration-300 sm:gap-2 sm:px-4 sm:py-2">
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
          {/* TOP FLOATING CONTROLS (1 BARIS RINGKAS DI LUAR BUKU 2D)         */}
          {/* --------------------------------------------------------------- */}
          <div className="flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-1.5 px-1">
            {/* Left Group: Chapter & Intro Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenIntroSpread}
                className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide shadow-md backdrop-blur-md transition-all ${
                  isShowingIntroSpread
                    ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                    : "border-[#d6b26f]/45 bg-slate-950/75 text-amber-100/90 hover:border-[#f3d89b]/70 hover:text-white"
                }`}
              >
                Pengantar Kitab
              </button>

              {CHAPTER_ORDER.map((chap) => {
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
                    className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide shadow-md backdrop-blur-md transition-all ${
                      isActive
                        ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                        : isSealDone
                          ? "border-emerald-400/55 bg-emerald-950/75 text-emerald-200 hover:border-emerald-300"
                          : "border-[#d6b26f]/45 bg-slate-950/75 text-amber-100/90 hover:border-[#f3d89b]/70 hover:text-white"
                    }`}
                  >
                    {chap.shortLabel}{" "}
                    <span className="ml-0.5 text-[10px] opacity-85">
                      {isSealDone ? "[Segel Terbuka]" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Group: Mastery Badge, Peta & LKS, Studio Tulis, Exit to 3D */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="rounded-full border border-[#d6b26f]/45 bg-slate-950/75 px-3 py-1 text-[11px] font-bold text-[#ffe8b6] shadow-md backdrop-blur-md">
                Segel: {totalSealsUnlocked}/3{" "}
                <span className="mx-1 text-[#d6b26f]/50">|</span>
                <span className="text-emerald-300">{masteryPercentage}%</span>
              </div>
              <button
                type="button"
                onClick={onOpenPetaModal}
                className="cursor-pointer rounded-full border border-[#d6b26f]/45 bg-slate-950/75 px-3 py-1 text-[11px] font-semibold text-[#f5ddab] shadow-md backdrop-blur-md transition hover:border-[#f3d89b] hover:text-white"
              >
                Peta &amp; LKS
              </button>
              <button
                type="button"
                onClick={onNavigateToStudioTulis}
                className="cursor-pointer rounded-full border border-emerald-400/55 bg-emerald-950/80 px-3 py-1 text-[11px] font-bold text-emerald-200 shadow-md backdrop-blur-md transition hover:border-emerald-300 hover:bg-emerald-900/90"
              >
                Studio Tulis -&gt;
              </button>
              <button
                type="button"
                onClick={() => onSetBookFocused(false)}
                className="cursor-pointer rounded-full border border-rose-300/50 bg-slate-950/80 px-3 py-1 text-[11px] font-bold text-rose-200 shadow-md backdrop-blur-md transition hover:border-rose-300 hover:bg-rose-950/80"
              >
                [ X ] Kembali ke Buku 3D
              </button>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* FLOATING 2D BOOK WRAPPER — LOCKED TO ORIGINAL 946:603 RATIO     */}
          {/* --------------------------------------------------------------- */}
          <div
            style={{
              perspective: "1800px",
            }}
            className="relative my-auto flex w-full flex-1 items-center justify-center overflow-visible"
          >
            <div
              ref={book2dContainerRef}
              className="relative drop-shadow-[0_28px_55px_rgba(0,0,0,0.9)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: "min(94vw, 1180px, calc((100dvh - 4.4rem) * 946 / 603))",
                aspectRatio: "946 / 603",
                transform: "rotateX(0deg) scale(1) translateY(0px)",
                transformOrigin: "50% 70%",
              }}
            >
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

              {/* Layer 3: Calibrated Homography Page Spread (NO transform/z-index wrapper so .parchment-ink multiplies directly into single-page.webp) */}
              <div className="pointer-events-none absolute inset-0">
              {/* ============================================================= */}
              {/* SPREAD 0: PENGANTAR KITAB AKSARALOKA (GULUNGAN PEMBUKA)       */}
              {/* ============================================================= */}
              {isShowingIntroSpread && (
                <>
                  {/* LEFT PAGE: PENGANTAR KONSEP CERITA FANTASI */}
                  <div style={book2dLeftPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-2 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          GULUNGAN PEMBUKA · PENGANTAR KITAB
                        </span>
                        <span className="font-serif text-[10px] font-semibold text-[#6b4826] italic">
                          TP 1 s.d. TP 4
                        </span>
                      </div>

                      <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                        <h2 className="parchment-contour-warp text-sm leading-snug font-bold text-[#2b1a0c] sm:text-base">
                          Membedah Rahasia Teks Cerita Fantasi (Hlm. 52–70)
                        </h2>
                        <p className="text-[11px] leading-relaxed text-[#3a2512] sm:text-xs">
                          Selamat datang di <strong>Kitab Aksaraloka</strong>.
                          Sebelum kamu menulis naskah cerita fantasimu sendiri
                          di Meja Studio Tulis, pelajari dan bedah terlebih
                          dahulu unsur intrinsik, struktur alur, dan kaidah
                          kebahasaan melalui tiga teks model:
                          <strong> &ldquo;Bola-Bola Waktu&rdquo;</strong>,{" "}
                          <strong>&ldquo;Sihir Unik Mao&rdquo;</strong>, dan{" "}
                          <strong>&ldquo;Keberanian Emas&rdquo;</strong>.
                        </p>

                        <div className="border-t border-b border-[#5c3d1e]/30 py-2">
                          <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase sm:text-[11px]">
                            Apa Itu Teks Cerita Fantasi?
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#2b1a0c]">
                            Cerita fantasi adalah teks narasi fiksi yang
                            menampilkan peristiwa, tokoh, latar, atau kekuatan
                            ajaib yang melampaui kenyataan sehari-hari, namun
                            tetap dibangun di atas{" "}
                            <strong>
                              rangkaian alur sebab-akibat yang logis
                            </strong>{" "}
                            dan mengandung <strong>amanat kehidupan</strong>.
                          </p>
                        </div>

                        <div className="space-y-1.5 pt-0.5">
                          <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase sm:text-[11px]">
                            3 Ciri Utama Cerita Fantasi yang Kuat:
                          </p>
                          <p className="text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            <strong>1. Keajaiban Beraturan (Bukan Instan):</strong>{" "}
                            Setiap benda atau kekuatan magis memiliki syarat dan
                            konsekuensi (contoh: bola waktu Ivan membawa harga
                            mahal yang menyadarkan dirinya).
                          </p>
                          <p className="text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            <strong>2. Bukti Watak Lewat Tindakan:</strong>{" "}
                            Sifat tokoh dibuktikan lewat keputusan saat krisis,
                            bukan sekadar klaim sifat.
                          </p>
                          <p className="text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            <strong>3. Citraan 5 Indera, Majas &amp; Dialog:</strong>{" "}
                            Pembaca diajak melihat, mendengar, dan merasakan
                            suasana dunia ajaib secara hidup.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="book-ink-step-3 mt-1.5 flex shrink-0 items-center justify-between border-t border-[#5c3d1e]/25 pt-1 font-serif text-[10px] text-[#5c3d1e]">
                      <span>Pengantar Kitab Aksaraloka</span>
                      <span className="font-semibold">Halaman Pengantar I</span>
                    </div>
                  </div>

                  {/* RIGHT PAGE: PETA 3 BABAK & TOMBOL BUKA SEGEL GULUNGAN */}
                  <div style={book2dRightPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-2 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          PETA TIGA BABAK &amp; SEGEL NARATIF
                        </span>
                        <span className="font-serif text-[10px] font-semibold text-[#6b4826]">
                          Segel Terbuka: {totalSealsUnlocked}/3
                        </span>
                      </div>

                      <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                        <div className="border-b border-[#5c3d1e]/30 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                              Babak I — Alur, Lintas Waktu &amp; Amanat (TP 1 &amp; TP 2)
                            </span>
                            <span className="text-[10px] font-bold text-[#14532d]">
                              {state.sealAlurUnlocked
                                ? "[Segel I Terbuka]"
                                : "[Segel I]"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            Telusuri 3 Bola Waktu dalam kisah{" "}
                            <em>Bola-Bola Waktu</em>, susun 5 tahap Gunung Alur,
                            uji simulasi Tanpa Klimaks, dan simpulkan amanat.
                          </p>
                        </div>

                        <div className="border-b border-[#5c3d1e]/30 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                              Babak II — Penokohan, 4 Kantong Emas &amp; 5 Indera (TP 1 &amp; TP 3)
                            </span>
                            <span className="text-[10px] font-bold text-[#14532d]">
                              {state.sealWatakUnlocked
                                ? "[Segel II Terbuka]"
                                : "[Segel II]"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            Bedah bukti watak Mao dan Yari (<em>Sihir Unik Mao</em>),
                            urutkan eskalasi 4 Kantong Keajaiban Emas (<em>Keberanian Emas</em>),
                            dan latih kepekaan deskripsi pancaindra.
                          </p>
                        </div>

                        <div className="border-b border-[#5c3d1e]/30 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#2b1a0c] sm:text-xs">
                              Babak III — Leksikon Magis, Majas &amp; Dialog (TP 4)
                            </span>
                            <span className="text-[10px] font-bold text-[#14532d]">
                              {state.sealBahasaUnlocked
                                ? "[Segel III Terbuka]"
                                : "[Segel III]"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            Kuasai bank kata fantasi, racik Majas Asosiasi
                            (perumpamaan), serta ubah kalimat langsung menjadi
                            kalimat tak langsung sesuai EYD V.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleOpenGrimoireScroll}
                          className="cursor-pointer rounded-full border-2 border-[#14532d]/80 bg-[#14532d]/12 px-4 py-1.5 font-serif text-[11px] font-bold text-[#14532d] transition hover:bg-[#14532d]/22"
                        >
                          Buka Segel Gulungan &amp; Mulai Babak I -&gt;
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
                        Masuk ke Babak I -&gt;
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
                  <div style={book2dLeftPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
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
                          {isNarrating
                            ? "[Hentikan Sulih Suara]"
                            : "[Dengarkan Ringkasan]"}
                        </button>
                      </div>

                      <div className="space-y-2 font-serif text-[#2b1a0c]">
                        <div>
                          <h2 className="parchment-contour-warp text-xs leading-snug font-bold text-[#2b1a0c] sm:text-sm">
                            Teks Model: &ldquo;Bola-Bola Waktu&rdquo; (Hlm. 52–58)
                          </h2>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#3a2512] sm:text-[11px]">
                            Cerita fantasi lintas waktu membawa tokoh berpindah
                            antara <strong>Masa Kini</strong> dan{" "}
                            <strong>Masa Depan / Lampau</strong>. Pilih ketiga
                            Bola Waktu di bawah untuk menelusuri jejak perjalanan
                            Ivan:
                          </p>
                        </div>

                        {/* 3 Time Orb Selector Links on Parchment */}
                        <div className="grid grid-cols-3 gap-1.5 border-t border-b border-[#5c3d1e]/35 py-1.5">
                          {TIME_ORB_DATA.map((orb) => {
                            const isSelected = selectedOrb.id === orb.id;
                            return (
                              <button
                                key={orb.id}
                                type="button"
                                onClick={() => {
                                  playChime();
                                  setSelectedOrbId(orb.id);
                                }}
                                className={`cursor-pointer border-b-2 px-1.5 py-1 text-left font-serif transition ${
                                  isSelected
                                    ? "border-[#2b1a0c] bg-[#5c3d1e]/15 font-bold text-[#1f1207]"
                                    : "border-transparent text-[#5c3d1e] hover:border-[#5c3d1e]/40 hover:text-[#2b1a0c]"
                                }`}
                              >
                                <span className="block text-[9.5px] leading-tight font-bold sm:text-[10px]">
                                  {orb.eraLabel}
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
                            <strong>Fokus Unsur Intrinsik:</strong>{" "}
                            {selectedOrb.evidenceFocus}
                          </p>
                        </div>

                        {/* Ringkasan Struktur Alur Cerita Fantasi */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            Kaidah Struktur Alur Cerita Fantasi:
                          </p>
                          <p className="text-[10px] leading-relaxed text-[#3a2512] sm:text-[10.5px]">
                            Alur bergerak menanjak secara berurutan dari{" "}
                            <strong>1. Orientasi (Awal)</strong> -&gt;{" "}
                            <strong>2. Pemantik Masalah</strong> -&gt;{" "}
                            <strong>3. Komplikasi (Tengah)</strong> -&gt;{" "}
                            <strong>4. Klimaks (Puncak)</strong> -&gt;{" "}
                            <strong>5. Resolusi (Akhir)</strong>. Tanpa klimaks
                            yang menguji keputusan tokoh, resolusi cerita akan
                            terasa datar dan tidak logis.
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
                        &lt;- Pengantar Kitab
                      </button>
                      <span className="font-semibold">Halaman 1</span>
                    </div>
                  </div>

                  {/* RIGHT PAGE (HALAMAN 2): GUNUNG ALUR INTERAKTIF & AMANAT */}
                  <div style={book2dRightPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          HALAMAN 2 · GUNUNG ALUR &amp; UJI AMANAT
                        </span>
                        <span className="font-serif text-[10px] font-bold text-[#14532d]">
                          {state.sealAlurUnlocked
                            ? "Segel I Terbuka"
                            : `Alur: ${plotCorrectCount}/5`}
                        </span>
                      </div>

                      <div className="space-y-2 font-serif text-[#2b1a0c]">
                        {/* Compact Hand-Drawn Sepia Plot Mountain SVG */}
                        <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                              1. Peta Gunung Alur ({plotCorrectCount}/5 Tahap)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSimulateClimaxResolution(
                                    "tanpa-klimaks"
                                  )
                                }
                                className="cursor-pointer text-[9.5px] font-bold text-[#7f1d1d] underline decoration-[#7f1d1d]/50 underline-offset-2 hover:text-red-950"
                              >
                                Uji Tanpa Klimaks
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSimulateClimaxResolution("utuh")
                                }
                                className="cursor-pointer text-[9.5px] font-bold text-[#14532d] underline decoration-[#14532d]/50 underline-offset-2 hover:text-emerald-950"
                              >
                                Uji Alur Utuh
                              </button>
                              <button
                                type="button"
                                onClick={handleResetPlotMountain}
                                className="cursor-pointer text-[9.5px] font-semibold text-[#5c3d1e] underline hover:text-black"
                              >
                                Reset
                              </button>
                            </div>
                          </div>

                          <svg
                            viewBox="0 0 360 82"
                            className="parchment-contour-warp mt-1 h-16 w-full overflow-visible"
                            aria-label="Diagram Gunung Alur Cerita Fantasi"
                          >
                            <polyline
                              fill="none"
                              stroke="#5c3d1e"
                              strokeWidth="2"
                              strokeDasharray="3 2"
                              points="28,68 110,46 185,28 260,12 332,64"
                            />
                            {PLOT_MOUNTAIN_COORDS.map((coord, idx) => {
                              const cx = (coord.xPercent / 100) * 360;
                              const cy = (coord.yPercent / 100) * 82;
                              const beat = BOLA_WAKTU_PLOT_BEATS[idx];
                              const isSolved =
                                beat !== undefined &&
                                state.plotPlacedIds[idx] === beat.id;
                              const isNextTarget =
                                state.plotPlacedIds.length === idx;

                              return (
                                <g key={coord.order}>
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isNextTarget ? 9 : 7}
                                    fill={
                                      isSolved
                                        ? "#14532d"
                                        : isNextTarget
                                          ? "#4a2f15"
                                          : "#d9c39a"
                                    }
                                    stroke="#2b1a0c"
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={cx}
                                    y={cy + 3}
                                    textAnchor="middle"
                                    fontSize="8.5"
                                    fontWeight="bold"
                                    fill={
                                      isSolved || isNextTarget
                                        ? "#fdf6e7"
                                        : "#2b1a0c"
                                    }
                                  >
                                    {coord.order}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>

                          {climaxWarningMessage && (
                            <p className="mt-1 border-l-2 border-[#7f1d1d] pl-2 text-[9.5px] leading-snug font-semibold text-[#5a1818]">
                              {climaxWarningMessage}
                            </p>
                          )}
                        </div>

                        {/* Interactive Plot Beat Ordering */}
                        <div className="border-b border-[#5c3d1e]/30 pb-2">
                          <p className="text-[10px] font-bold text-[#2b1a0c]">
                            {isPlotComplete
                              ? "Seluruh 5 Tahap Gunung Alur telah tersusun runtut!"
                              : `Klik peristiwa untuk memasang Tahap ke-${plotCorrectCount + 1} (${BOLA_WAKTU_PLOT_BEATS[plotCorrectCount]?.stagePosition ?? "Selesai"}):`}
                          </p>

                          <div className="mt-1 space-y-1">
                            {BOLA_WAKTU_PLOT_BEATS.map((beat) => {
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
                                  className={`block w-full cursor-pointer border-b border-[#5c3d1e]/25 px-1.5 py-1 text-left font-serif text-[10px] leading-snug transition ${
                                    isPlaced
                                      ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                      : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                  }`}
                                >
                                  {isPlaced
                                    ? `[Tahap ${placedIndex + 1} · ${beat.stagePosition}] `
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
                            2. Simpulkan Amanat Utama &ldquo;Bola-Bola Waktu&rdquo;:
                          </span>
                          {BOLA_WAKTU_AMANAT_OPTIONS.map((opt) => {
                            const isChosen =
                              state.selectedAmanatId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelectAmanat(opt.id)}
                                className={`block w-full cursor-pointer border-b border-[#5c3d1e]/25 px-1.5 py-1 text-left font-serif text-[10px] leading-snug transition ${
                                  isChosen
                                    ? opt.isCorrect
                                      ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                      : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                    : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                }`}
                              >
                                {isChosen
                                  ? opt.isCorrect
                                    ? "[Tepat] "
                                    : "[Kurang Tepat] "
                                  : "○ "}
                                {opt.text}
                              </button>
                            );
                          })}

                          <div className="pt-1.5">
                            <label
                              htmlFor="amanat-reflection-input"
                              className="block text-[9.5px] font-bold tracking-wider text-[#4a2f15] uppercase"
                            >
                              Catatan Refleksi Amanatmu (Goresan Tinta Siswa):
                            </label>
                            <input
                              id="amanat-reflection-input"
                              type="text"
                              value={state.customAmanatReflection}
                              onChange={(e) =>
                                handleCustomAmanatChange(e.target.value)
                              }
                              placeholder="Goreskan kalimat amanat versimu di atas lembaran ini..."
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
                        Babak II: Watak &amp; Indera -&gt;
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================= */}
              {/* SPREAD 2: BABAK II (PENOKOHAN, 4 KANTONG EMAS & 5 INDERA)     */}
              {/* ============================================================= */}
              {!isShowingIntroSpread && activeChapter === "watak" && (
                <>
                  {/* LEFT PAGE (HALAMAN 3): TOKOH, 4 KANTONG EMAS & 5 INDERA */}
                  <div style={book2dLeftPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          HALAMAN 3 · {CHAPTER_ORDER[1]!.tpTag}
                        </span>
                        <span className="font-serif text-[10px] font-semibold text-[#6b4826] italic">
                          Bukti Naskah &amp; Citraan
                        </span>
                      </div>

                      {/* Sub-tab Links on Parchment */}
                      <div className="mb-2 grid grid-cols-3 gap-1 border-b border-[#5c3d1e]/35 pb-1">
                        <button
                          type="button"
                          onClick={() => setWatakLeftTab("mao")}
                          className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${
                            watakLeftTab === "mao"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                          }`}
                        >
                          1. Tokoh &amp; Bukti
                        </button>
                        <button
                          type="button"
                          onClick={() => setWatakLeftTab("emas")}
                          className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${
                            watakLeftTab === "emas"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                          }`}
                        >
                          2. 4 Kantong Emas ({state.pouchOrderIds.length}/4)
                        </button>
                        <button
                          type="button"
                          onClick={() => setWatakLeftTab("indera")}
                          className={`cursor-pointer border-b-2 py-1 font-serif text-[10px] font-bold transition ${
                            watakLeftTab === "indera"
                              ? "border-[#2b1a0c] text-[#1f1207]"
                              : "border-transparent text-[#6b4826] hover:text-[#2b1a0c]"
                          }`}
                        >
                          3. Peta 5 Indera
                        </button>
                      </div>

                      {watakLeftTab === "mao" && (
                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          <p className="text-[10.5px] leading-relaxed text-[#3a2512]">
                            Dalam cerita fantasi yang baik, watak tokoh{" "}
                            <strong>
                              ditunjukkan lewat tindakan dan dialog
                            </strong>{" "}
                            (<em>show, don&apos;t tell</em>). Perhatikan profil
                            tokoh dalam komik{" "}
                            <strong>&ldquo;Sihir Unik Mao&rdquo;</strong> (hlm.
                            59–62) dan{" "}
                            <strong>&ldquo;Keberanian Emas&rdquo;</strong> (hlm.
                            64–67):
                          </p>
                          <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                            <p className="text-[10px] font-bold text-[#4a2f15]">
                              1. Mao (Protagonis — Sihir Unik Mao)
                            </p>
                            <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                              Sering gagal merapal mantra terbang dasar, tetapi
                              tekun berlatih hingga mahir menyihir makanan manis
                              yang mendamaikan teman-temannya.
                            </p>
                          </div>
                          <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                            <p className="text-[10px] font-bold text-[#4a2f15]">
                              2. Piru (Sahabat Pendukung — Sihir Unik Mao)
                            </p>
                            <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                              Setia menemani Mao berlatih dan selalu membesarkan
                              hati Mao ketika diejek di kelas.
                            </p>
                          </div>
                          <div className="border-b border-[#5c3d1e]/30 pb-1.5">
                            <p className="text-[10px] font-bold text-[#4a2f15]">
                              3. Yari (Antagonis — Sihir Unik Mao)
                            </p>
                            <p className="mt-0.5 text-[10px] leading-snug text-[#2b1a0c]">
                              Cepat menguasai mantra dasar namun angkuh dan suka
                              meremehkan Mao di depan peri lain.
                            </p>
                          </div>
                        </div>
                      )}

                      {watakLeftTab === "emas" && (
                        <div className="space-y-2 font-serif text-[#2b1a0c]">
                          <div className="flex items-center justify-between">
                            <p className="text-[10.5px] font-bold text-[#2b1a0c]">
                              Urutkan Eskalasi 4 Kantong Emas (
                              {state.pouchOrderIds.length}/4):
                            </p>
                            <button
                              type="button"
                              onClick={handleResetPouchOrder}
                              className="cursor-pointer text-[9.5px] font-bold text-[#5c3d1e] underline hover:text-black"
                            >
                              Atur Ulang
                            </button>
                          </div>
                          <p className="text-[10px] leading-relaxed text-[#3a2512]">
                            Klik ke-4 kantong keajaiban Emas (hlm. 64–67) secara
                            berurutan dari rintangan awal hingga klimaks puncak:
                          </p>
                          <div className="space-y-1.5 pt-0.5">
                            {EMAS_POUCH_STEPS.map((step) => {
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
                                  className={`block w-full cursor-pointer border-b border-[#5c3d1e]/30 px-1.5 py-1.5 text-left font-serif transition ${
                                    isUnlocked
                                      ? "bg-[#14532d]/15 text-[#14532d]"
                                      : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10.5px] font-bold">
                                    <span>
                                      {isUnlocked ? "[Terurut] " : "○ "}
                                      {step.itemName}
                                    </span>
                                    <span className="text-[9.5px] italic">
                                       Kantong {step.order}
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

                      {watakLeftTab === "indera" && (
                        <div className="space-y-1.5 font-serif text-[#2b1a0c]">
                          <p className="text-[10.5px] leading-relaxed text-[#3a2512]">
                            Deskripsi latar yang memikat mengaktifkan{" "}
                            <strong>Pancaindra</strong> pembaca:
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
                                Kalimat Datar: &ldquo;{gem.weakExample}&rdquo;
                              </p>
                              <p className="mt-0.5 text-[10px] font-semibold text-[#14532d]">
                                Kalimat Imajinatif: &ldquo;{gem.vividExample}
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
                        &lt;- Babak I: Alur &amp; Waktu
                      </button>
                      <span className="font-semibold">Halaman 3</span>
                    </div>
                  </div>

                  {/* RIGHT PAGE (HALAMAN 4): TANTANGAN BUKTI WATAK & CITRAAN INDERA */}
                  <div style={book2dRightPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          HALAMAN 4 · UJI BUKTI WATAK &amp; CITRAAN
                        </span>
                        <span className="font-serif text-[10px] font-bold text-[#14532d]">
                          {state.sealWatakUnlocked
                            ? "Segel II Terbuka"
                            : `Watak ${charDone ? "Tuntas" : "Belum"} · Indera ${sensoryDone ? "Tuntas" : "Belum"}`}
                        </span>
                      </div>

                      <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                        {/* Bagian A: Bukti Watak Tokoh */}
                        <div className="space-y-1.5 border-b border-[#5c3d1e]/35 pb-2">
                          <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            A. Pilih Kutipan Bukti Watak yang Tepat:
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
                                  Watak: {chal.traitClaim}
                                </p>
                                <div className="mt-1 space-y-0.5">
                                  {chal.options.map((opt) => {
                                    const isChosen = selectedOptId === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() =>
                                          handleSelectCharacterTrait(
                                            chal.id,
                                            opt.id
                                          )
                                        }
                                        className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${
                                          isChosen
                                            ? opt.isValidEvidence
                                              ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                              : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                            : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                        }`}
                                      >
                                        {isChosen
                                          ? opt.isValidEvidence
                                            ? "[Bukti Valid] "
                                            : "[Kurang Tepat] "
                                          : "○ "}
                                        {opt.quote}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bagian B: Transformasi Kalimat Datar ke 5 Indera */}
                        <div className="space-y-1.5">
                          <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            B. Ubah Kalimat Datar Menjadi Citraan Indera:
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
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() =>
                                          handleSelectSensoryUpgrade(
                                            sens.id,
                                            opt.id
                                          )
                                        }
                                        className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${
                                          isChosen
                                            ? opt.isRichSensory
                                              ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                              : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                            : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                        }`}
                                      >
                                        {isChosen
                                          ? opt.isRichSensory
                                            ? "[Imajinatif] "
                                            : "[Masih Datar] "
                                          : "○ "}
                                        {opt.text}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!pouchDone && (
                          <p className="border-t border-[#5c3d1e]/25 pt-1 text-[9.5px] font-semibold text-[#5a1818] italic">
                            Catatan Segel II: Pastikan kamu juga telah
                            mengurutkan 4 Kantong Emas pada Halaman 3 (Tab 2)!
                          </p>
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
                        Babak III: Bahasa &amp; Dialog -&gt;
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
                  <div style={book2dLeftPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-left flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          HALAMAN 5 · {CHAPTER_ORDER[2]!.tpTag}
                        </span>
                        <span className="font-serif text-[10px] font-semibold text-[#6b4826] italic">
                          Majas &amp; Kalimat Langsung
                        </span>
                      </div>

                      <div className="space-y-2 font-serif text-[#2b1a0c]">
                        {/* 1. Majas Asosiasi */}
                        <div className="pb-1.5">
                          <h3 className="parchment-contour-warp text-[11px] font-bold text-[#2b1a0c]">
                            1. Majas Asosiasi (Perumpamaan — Hlm. 63)
                          </h3>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-[#3a2512]">
                            Membandingkan dua hal yang berbeda secara eksplisit
                            menggunakan kata penghubung pembanding:{" "}
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
                            2. Transmutasi Kalimat Langsung &amp; Tak Langsung (Hlm. 69–70)
                          </h3>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-[#3a2512]">
                            • <strong>Kalimat Langsung:</strong> Mengutip ucapan
                            tokoh persis dengan{" "}
                            <strong>tanda petik dua (&ldquo;...&rdquo;)</strong>{" "}
                            dan kata ganti orang pertama/kedua (<em>aku, kau</em>).
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-[#14532d]">
                            • <strong>Kalimat Tak Langsung:</strong>{" "}
                            Menghilangkan tanda petik dua, menggunakan kata
                            hubung (<em>bahwa, agar, untuk</em>), dan mengubah
                            kata ganti menjadi sudut pandang orang ketiga (
                            <em>ia, -nya</em>).
                          </p>
                          <hr className="parchment-ink-rule mt-1.5" />
                        </div>

                        {/* 3. Bank Kata & Frasa Fantasi */}
                        <div className="space-y-1">
                          <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            3. Bank Kata &amp; Frasa Fantasi:
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                                  className={`cursor-pointer border-b-2 px-2 py-0.5 font-serif text-[9.5px] transition ${
                                    isPicked
                                      ? "border-[#2b1a0c] bg-[#5c3d1e]/15 font-bold text-[#1f1207]"
                                      : "border-transparent text-[#5c3d1e] hover:border-[#5c3d1e]/40"
                                  }`}
                                >
                                  {cat.category}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-1 space-y-1 border-t border-[#5c3d1e]/25 pt-1 text-[9.5px] leading-snug">
                            {selectedLexiconCategory.entries.map((entry) => (
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
                        &lt;- Babak II: Watak &amp; Indera
                      </button>
                      <span className="font-semibold">Halaman 5</span>
                    </div>
                  </div>

                  {/* RIGHT PAGE (HALAMAN 6): TANTANGAN MAJAS & KONVERSI DIALOG */}
                  <div style={book2dRightPageStyle} className="parchment-ink parchment-ink-bleed pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5">
                    <div className="parchment-scroll book-ink-sweep-right flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
                      <div className="mb-1.5 flex min-h-[26px] shrink-0 items-center justify-between border-b border-[#5c3d1e]/35 pb-1">
                        <span className="font-serif text-[10px] font-bold tracking-[0.12em] text-[#4a2f15] uppercase sm:text-[11px]">
                          HALAMAN 6 · RACIK MAJAS &amp; TRANSMUTASI DIALOG
                        </span>
                        <span className="font-serif text-[10px] font-bold text-[#14532d]">
                          {state.sealBahasaUnlocked
                            ? "Segel III Terbuka"
                            : `Majas ${majasDone ? "Tuntas" : "Belum"} · Dialog ${dialogueDone ? "Tuntas" : "Belum"}`}
                        </span>
                      </div>

                      <div className="space-y-2.5 font-serif text-[#2b1a0c]">
                        {/* Tantangan A: Kawah Peracik Majas Asosiasi */}
                        <div className="space-y-1.5 border-b border-[#5c3d1e]/35 pb-2">
                          <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            A. Racik Penanda &amp; Perumpamaan Majas Asosiasi:
                          </span>
                          {MAJAS_ASOSIASI_CHALLENGES.map((majas) => {
                            const pair = state.majasAnswers[majas.id] ?? {
                              connector: "",
                              comparison: "",
                            };
                            const isSolved =
                              pair.connector === majas.correctConnector &&
                              pair.comparison === majas.correctComparison;

                            return (
                              <div
                                key={majas.id}
                                className="border-b border-[#5c3d1e]/20 pb-1.5 last:border-b-0"
                              >
                                <p className="text-[9.5px] font-semibold text-[#3a2512]">
                                  {majas.contextSentence}
                                </p>
                                <p className="mt-0.5 text-[9.5px] text-[#4a2f15] italic">
                                  {majas.blankPrompt}
                                </p>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[8.5px] font-bold text-[#5c3d1e] uppercase">
                                      Kata Pembanding:
                                    </label>
                                    <select
                                      aria-label={`Kata pembanding untuk ${majas.id}`}
                                      value={pair.connector}
                                      onChange={(e) =>
                                        handleUpdateMajasPair(
                                          majas.id,
                                          "connector",
                                          e.target.value
                                        )
                                      }
                                      className="parchment-pen-input mt-0.5 w-full cursor-pointer py-0.5 font-serif text-[10px] font-bold italic"
                                    >
                                      <option
                                        value=""
                                        className="bg-[#f3e5c8] text-[#2b1a0c]"
                                      >
                                        -- Pilih Penanda --
                                      </option>
                                      {majas.connectorChoices.map((c) => (
                                        <option
                                          key={c}
                                          value={c}
                                          className="bg-[#f3e5c8] text-[#2b1a0c]"
                                        >
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[8.5px] font-bold text-[#5c3d1e] uppercase">
                                      Citraan Perumpamaan:
                                    </label>
                                    <select
                                      aria-label={`Perumpamaan untuk ${majas.id}`}
                                      value={pair.comparison}
                                      onChange={(e) =>
                                        handleUpdateMajasPair(
                                          majas.id,
                                          "comparison",
                                          e.target.value
                                        )
                                      }
                                      className="parchment-pen-input mt-0.5 w-full cursor-pointer py-0.5 font-serif text-[10px] font-bold italic"
                                    >
                                      <option
                                        value=""
                                        className="bg-[#f3e5c8] text-[#2b1a0c]"
                                      >
                                        -- Pilih Perumpamaan --
                                      </option>
                                      {majas.comparisonChoices.map((comp) => (
                                        <option
                                          key={comp}
                                          value={comp}
                                          className="bg-[#f3e5c8] text-[#2b1a0c]"
                                        >
                                          {comp}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                {isSolved && (
                                  <p className="mt-0.5 text-[9px] font-bold text-[#14532d]">
                                    [Tepat] {majas.explanation}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Tantangan B: Transmutasi Kalimat Langsung -> Tak Langsung */}
                        <div className="space-y-1.5">
                          <span className="block text-[10px] font-bold tracking-wider text-[#4a2f15] uppercase">
                            B. Ubah ke Kalimat Tak Langsung (EYD V):
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
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() =>
                                          handleSelectDialogueOption(
                                            dlg.id,
                                            opt.id
                                          )
                                        }
                                        className={`block w-full cursor-pointer px-1.5 py-0.5 text-left font-serif text-[9.5px] leading-snug transition ${
                                          isChosen
                                            ? opt.isCorrect
                                              ? "bg-[#14532d]/15 font-bold text-[#14532d]"
                                              : "bg-[#7f1d1d]/15 font-bold text-[#7f1d1d]"
                                            : "text-[#2b1a0c] hover:bg-[#5c3d1e]/10"
                                        }`}
                                      >
                                        {isChosen
                                          ? opt.isCorrect
                                            ? "[Baku & Tepat] "
                                            : "[Salah Kaidah] "
                                          : "○ "}
                                        {opt.text}
                                      </button>
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
                        Lanjut Menulis di Studio Tulis -&gt;
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Layer 4: Spine Gutter Shadow & Outer Paper Edge Vignette Overlay */}
            <ParchmentSpineShadowOverlay />

            {/* Layer 5: 3D HINGE PAGE-FLIPPER OVERLAY (Terkunci 1:1 ke koordinat kertas 946:603) */}
            {flipDirection !== null && (
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
                className={`pointer-events-none absolute z-30 drop-shadow-[0_0_35px_rgba(0,0,0,0.65)] ${
                  flipDirection === "next"
                    ? "animate-studio-flip-next"
                    : "animate-studio-flip-prev"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

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
