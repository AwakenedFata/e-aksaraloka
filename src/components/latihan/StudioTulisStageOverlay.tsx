"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import {
  BookPageDisplacementDefs,
  ParchmentInkFilters,
  ParchmentSpineShadowOverlay,
} from "@/components/shared/ParchmentInkFilters";
import { BookHomographyCalibrator } from "@/components/shared/BookHomographyCalibrator";
import { ParchmentSelect } from "@/components/shared/ui/ParchmentSelect";
import {
  computeCoverStageMetrics,
  computeMobile3dCameraTransform,
  computeSpreadQuadProjection,
  READING_2D_DEFAULT_CALIBRATION,
  STAGE_SOURCE_HEIGHT,
  STAGE_SOURCE_WIDTH,
  STUDIO_BOOK_DEFAULT_CALIBRATION,
  type BookSpreadCalibration,
  type CoverStageMetrics,
} from "@/lib/ui/bookHomography";
import type { GrimoireChapterId } from "@/lib/learning/narrativeCurriculumData";
import {
  applyStudioSeedPreset,
  deleteSavedManuscriptFromPustaka,
  loadSavedManuscriptToEditor,
  saveCurrentManuscriptToPustaka,
  setActiveGrimoireChapter,
  toggleStudioRevisionCheck,
  updateStudioDraft,
  useAksaralokaLearning,
} from "@/lib/learning/learningStore";
import {
  INITIAL_STUDIO_DRAFT,
  PRESET_FANTASY_THEMES,
  SELF_REVISION_CHECKLIST,
  analyzeStudentManuscript,
  applyAutomaticEydFixes,
  buildKbbiReferenceUrl,
  type FantasyThemeCategory,
  type StudioExtraSpread,
} from "@/lib/learning/literaryDetector";
import {
  buildDynamicSentenceFrame,
  type FantasyIdeaRecipe,
  type SentenceFrameGroupId,
} from "@/lib/learning/creativeScaffolding";
import {
  StudioHybridToolkitDrawer,
  type TargetParagraphKey,
} from "@/components/latihan/StudioHybridToolkitDrawer";
import { StudioAiSocraticPanel } from "@/components/latihan/StudioAiSocraticPanel";
import { SubmitToTeacherModal } from "@/components/latihan/SubmitToTeacherModal";
import {
  playChime,
  playErrorTone,
  playPageFlip,
  playSealUnlock,
} from "@/lib/learning/audioEngine";

interface StudioTulisStageOverlayProps {
  readonly isVisible: boolean;
  readonly isBookFocused: boolean;
  readonly onSetBookFocused: (focused: boolean) => void;
  readonly mobile3dSide?: "left" | "right";
  readonly onChangeMobile3dSide?: (side: "left" | "right") => void;
  readonly onJumpToKitabChapter: (chapter: GrimoireChapterId) => void;
  readonly onOpenPetaModal: () => void;
}

type StudioViewTab = "dual_book" | "audit_revisi" | "galeri_piagam";

const CUSTOM_THEME_OPTION_VALUE = "__custom_original_theme__";
const STUDIO_TOUR_STORAGE_KEY = "aksaraloka:studio-tour-seen:v1";

const STUDIO_TOUR_STEPS: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
    {
      title: "Langkah 1/3 · Rancang Dunia Ceritamu (Lembar 1)",
      body: "Isi Tema, Aturan Ajaib, Tokoh, dan Tempat di Lembar 1. Bingung mulai? Klik tombol 'Alat Bantu & AI' (atau 'Ide & AI') di atas buat mengacak ide seru atau minta bantuan kata!",
    },
    {
      title: "Langkah 2/3 · Tulis 4 Bagian Cerita (Lembar 2 & 3)",
      body: "Tulis Awal, Masalah, Puncak, dan Akhir. Kamu boleh klik tombol '+ Kerangka' sebagai awalan, lalu ganti semua tanda [...] dengan kalimat versimu sendiri!",
    },
    {
      title: "Langkah 3/3 · Cek Skor, Revisi & Cetak Piagam!",
      body: "Klik 'Cek & AI' di atas layar untuk memeriksa 5 Misi dan merapikan ejaan, centang ceklis revisi, lalu buka Galeri untuk Simpan & Cetak Piagam Penulis Muda!",
    },
  ];

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SEAL_BADGES: readonly {
  readonly id: GrimoireChapterId;
  readonly label: string;
}[] = [
    { id: "alur", label: "Misi 1 · Alur" },
    { id: "watak", label: "Misi 2 · Tokoh & Indra" },
    { id: "bahasa", label: "Misi 3 · Perumpamaan & Dialog" },
  ];

const CORE_SPREAD_LABELS: readonly {
  readonly index: number;
  readonly shortLabel: string;
}[] = [
    {
      index: 0,
      shortLabel: "Langkah 1: Rencana Cerita",
    },
    {
      index: 1,
      shortLabel: "Langkah 2: Awal & Masalah",
    },
    {
      index: 2,
      shortLabel: "Langkah 3: Puncak & Akhir",
    },
  ];

export function StudioTulisStageOverlay({
  isVisible,
  isBookFocused,
  onSetBookFocused,
  mobile3dSide = "left",
  onChangeMobile3dSide,
  onJumpToKitabChapter,
  onOpenPetaModal,
}: StudioTulisStageOverlayProps) {
  const { state, metrics } = useAksaralokaLearning();
  const draft = state.studioDraft;
  const extraSpreads = draft.extraSpreads ?? [];
  const totalSpreads = 3 + extraSpreads.length;
  const analysis = analyzeStudentManuscript(draft);

  const [activeViewTab, setActiveViewTab] = useState<StudioViewTab>("dual_book");
  const [currentSpread, setCurrentSpread] = useState<number>(0);
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
  const touchStartRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const didSwipeRef = useRef<boolean>(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [isGuideDrawerOpen, setIsGuideDrawerOpen] = useState<boolean>(false);
  const [studioTourStep, setStudioTourStep] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(STUDIO_TOUR_STORAGE_KEY) === "1"
        ? null
        : 0;
    } catch {
      return null;
    }
  });
  const [isConfirmingResetDraft, setIsConfirmingResetDraft] = useState<boolean>(false);
  const [confirmDeleteManuscriptId, setConfirmDeleteManuscriptId] = useState<
    string | null
  >(null);
  const [forceCustomThemeInput, setForceCustomThemeInput] = useState<boolean>(false);
  const [framePatternCursor, setFramePatternCursor] = useState<
    Record<SentenceFrameGroupId, number>
  >({
    komplikasi_waktu: 0,
    majas_asosiasi: 0,
    dialog_langsung: 0,
    tak_langsung_akhir: 0,
  });
  const [kbbiLookupQuery, setKbbiLookupQuery] = useState("");
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isSubmitTeacherModalOpen, setIsSubmitTeacherModalOpen] =
    useState<boolean>(false);

  const isPresetTheme = (PRESET_FANTASY_THEMES as readonly string[]).includes(
    draft.themeCategory
  );
  const showCustomThemeInput = forceCustomThemeInput || !isPresetTheme;

  useEffect(() => {
    if (!isConfirmingResetDraft) return;
    const timer = window.setTimeout(() => setIsConfirmingResetDraft(false), 4500);
    return () => window.clearTimeout(timer);
  }, [isConfirmingResetDraft]);

  useEffect(() => {
    if (!confirmDeleteManuscriptId) return;
    const timer = window.setTimeout(
      () => setConfirmDeleteManuscriptId(null),
      4500
    );
    return () => window.clearTimeout(timer);
  }, [confirmDeleteManuscriptId]);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    readonly width: number;
    readonly height: number;
  }>({
    width: STAGE_SOURCE_WIDTH,
    height: STAGE_SOURCE_HEIGHT,
  });
  const [studioBookCalibration, setStudioBookCalibration] =
    useState<BookSpreadCalibration>(STUDIO_BOOK_DEFAULT_CALIBRATION);
  const studio2dContainerRef = useRef<HTMLDivElement | null>(null);
  const [studio2dLayout, setStudio2dLayout] = useState({
    width: 946,
    height: 603,
    offsetX: 0,
    offsetY: 0,
  });
  const [studio2dCalibration, setStudio2dCalibration] =
    useState<BookSpreadCalibration>(READING_2D_DEFAULT_CALIBRATION);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("calibrate") === "1"
  );

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

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
          active3dSide === "left" ? "studio-left" : "studio-right"
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
    const el = studio2dContainerRef.current;
    if (!el) return;

    const syncStudio2dLayout = () => {
      const target = studio2dContainerRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const width = target.clientWidth || Math.round(rect.width);
      const height = target.clientHeight || Math.round(rect.height);
      if (width < 120 || height < 80) return;

      setStudio2dLayout((prev) => {
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

    const rafId = window.requestAnimationFrame(syncStudio2dLayout);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncStudio2dLayout())
        : null;
    resizeObserver?.observe(el);
    window.addEventListener("resize", syncStudio2dLayout);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncStudio2dLayout);
    };
  }, [isVisible, isBookFocused, isCalibrating]);

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        process.env.NODE_ENV === "development" &&
        e.altKey &&
        e.shiftKey &&
        e.code === "KeyK"
      ) {
        e.preventDefault();
        setIsCalibrating((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (isCalibrating) {
          setIsCalibrating(false);
        } else if (isBookFocused) {
          if (isGuideDrawerOpen) {
            setIsGuideDrawerOpen(false);
          } else {
            playPageFlip();
            onSetBookFocused(false);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isVisible,
    isBookFocused,
    isCalibrating,
    isGuideDrawerOpen,
    onSetBookFocused,
  ]);

  const studio3dBaseWidth = Math.max(120, Math.round(stageMetrics.width * 0.152));
  const studio3dBaseHeight = Math.max(
    130,
    Math.round(stageMetrics.height * 0.266)
  );

  const studio3dProj = useMemo(
    () =>
      computeSpreadQuadProjection({
        stageWidth: stageMetrics.width,
        stageHeight: stageMetrics.height,
        baseLeftWidth: studio3dBaseWidth,
        baseRightWidth: studio3dBaseWidth,
        baseHeight: studio3dBaseHeight,
        curveScale: stageMetrics.scale,
        calibration: studioBookCalibration,
      }),
    [
      stageMetrics.width,
      stageMetrics.height,
      stageMetrics.scale,
      studio3dBaseWidth,
      studio3dBaseHeight,
      studioBookCalibration,
    ]
  );

  const studio2dScale = studio2dLayout.width / 946;
  const studio2dLeftBaseWidth = Math.max(
    240,
    Math.round(studio2dLayout.width * 0.388)
  );
  const studio2dRightBaseWidth = Math.max(
    240,
    Math.round(studio2dLayout.width * 0.405)
  );
  const studio2dBaseHeight = Math.max(
    300,
    Math.round(studio2dLayout.height * 0.896)
  );

  const studio2dProj = useMemo(
    () =>
      computeSpreadQuadProjection({
        stageWidth: studio2dLayout.width,
        stageHeight: studio2dLayout.height,
        baseLeftWidth: studio2dLeftBaseWidth,
        baseRightWidth: studio2dRightBaseWidth,
        baseHeight: studio2dBaseHeight,
        curveScale: studio2dScale,
        calibration: studio2dCalibration,
      }),
    [
      studio2dLayout.width,
      studio2dLayout.height,
      studio2dLeftBaseWidth,
      studio2dRightBaseWidth,
      studio2dBaseHeight,
      studio2dScale,
      studio2dCalibration,
    ]
  );

  if (!isVisible) return null;

  const safeCurrentSpread = Math.min(currentSpread, Math.max(0, totalSpreads - 1));

  const isSealUnlockedForId = (id: GrimoireChapterId): boolean => {
    if (id === "alur") return state.sealAlurUnlocked;
    if (id === "watak") return state.sealWatakUnlocked;
    return state.sealBahasaUnlocked;
  };

  const showTempBanner = (msg: string) => {
    setStatusBanner(msg);
  };

  const triggerSpreadTransition = (targetSpread: number) => {
    const clamped = Math.max(0, Math.min(totalSpreads - 1, targetSpread));
    if (
      activeViewTab === "dual_book" &&
      clamped === safeCurrentSpread &&
      flipDirection === null
    ) {
      return;
    }

    playPageFlip();
    if (isMobileBook) {
      setActiveViewTab("dual_book");
      setCurrentSpread(clamped);
      setMobilePageSide("left");
      return;
    }

    const dir: "next" | "prev" = clamped >= safeCurrentSpread ? "next" : "prev";
    setFlipDirection(dir);

    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setActiveViewTab("dual_book");
      setCurrentSpread(clamped);
      setFlipDirection(null);
      flipTimerRef.current = null;
    }, 440);
  };

  const triggerTabFlip = (nextTab: StudioViewTab) => {
    if (nextTab === activeViewTab || flipDirection !== null) return;
    setIsGuideDrawerOpen(false);
    playPageFlip();

    if (isMobileBook) {
      setActiveViewTab(nextTab);
      setMobilePageSide("left");
      return;
    }

    const order: Record<StudioViewTab, number> = {
      dual_book: 0,
      audit_revisi: 1,
      galeri_piagam: 2,
    };
    const dir: "next" | "prev" =
      order[nextTab] >= order[activeViewTab] ? "next" : "prev";
    setFlipDirection(dir);

    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setActiveViewTab(nextTab);
      setFlipDirection(null);
      flipTimerRef.current = null;
    }, 440);
  };

  const handleEnterFocusBook = (targetSpread?: number) => {
    playPageFlip();
    if (typeof targetSpread === "number") {
      setCurrentSpread(targetSpread);
    }
    setActiveViewTab("dual_book");
    setMobilePageSide("left");
    onSetBookFocused(true);
  };

  const handleOpenBookAtTab = (targetTab: StudioViewTab) => {
    playPageFlip();
    setIsGuideDrawerOpen(false);
    setActiveViewTab(targetTab);
    setMobilePageSide("left");
    onSetBookFocused(true);
  };

  const handleExitFocusBookToDesk = () => {
    playPageFlip();
    setIsGuideDrawerOpen(false);
    onSetBookFocused(false);
  };

  const handleApplySeedOutline = (seedId: string, title: string) => {
    playChime();
    applyStudioSeedPreset(seedId, "outline_only");
    setIsGuideDrawerOpen(false);
    setCurrentSpread(0);
    setActiveViewTab("dual_book");
    showTempBanner(
      `Kerangka Ide "${title}" dimuat ke Lembar 1. Silakan modifikasi atau klik "Rakit Draf Awal & Buka Lembar 2" untuk mulai mengembangkan ceritamu!`
    );
  };

  const handleApplySeedFullModel = (seedId: string, title: string) => {
    playChime();
    applyStudioSeedPreset(seedId, "full_model_reference");
    setIsGuideDrawerOpen(false);
    setCurrentSpread(1);
    setActiveViewTab("dual_book");
    showTempBanner(
      `Teks Model Contoh "${title}" dimuat sebagai bahan pelajaran. Sunting dan tulis kalimat versimu sendiri agar dapat disimpan sebagai Karya Asli Siswa.`
    );
  };

  const handleResetDraft = () => {
    if (!isConfirmingResetDraft) {
      playErrorTone();
      setIsConfirmingResetDraft(true);
      showTempBanner(
        "Klik tombol 'Yakin Hapus Draf?' sekali lagi jika benar-benar ingin mengosongkan seluruh tulisan."
      );
      return;
    }
    playChime();
    setIsConfirmingResetDraft(false);
    setForceCustomThemeInput(false);
    setCurrentSpread(0);
    setIsGuideDrawerOpen(false);
    updateStudioDraft({
      ...INITIAL_STUDIO_DRAFT,
      authorName: draft.authorName,
      authorClass: draft.authorClass,
    });
    showTempBanner("Lembar draf dikosongkan. Siap menulis cerita fantasi orisinalmu!");
  };

  /**
   * Scaffold-to-Draft Helper (Pedagogis, Anti-Cheat):
   * Memindahkan kerangka asli siswa dari Lembar 1 ke Lembar 2 & 3 disertai rumpang
   * terbimbing ([...]) yang wajib dilengkapi sendiri oleh siswa agar Segel terbuka.
   */
  const handleGenerateDraftFromOutline = () => {
    const protag = draft.protagonistName.trim();
    const place = draft.settingPlace.trim();
    const rule = draft.worldRule.trim();

    if (!protag || !place || !rule) {
      playErrorTone();
      showTempBanner(
        "Isi dulu Nama Tokoh Utama, Tempat Kejadian, dan Aturan Keajaiban di Lembar 1 (atau buka 'Butuh Ide?') sebelum merakit kerangka cerita!"
      );
      return;
    }

    const antag = draft.antagonistName.trim() || "[tulis nama tokoh lawan/rintanganmu]";
    const sight =
      draft.sensorySight.trim() ||
      "[gambarkan warna atau cahaya yang terlihat di tempat ini]";
    const sound =
      draft.sensorySound.trim() ||
      "[gambarkan suara apa yang terdengar]";
    const smellTouch =
      draft.sensorySmellTouch.trim() ||
      "[gambarkan aroma atau suhu yang terasa]";

    const pOrientasi =
      draft.paragraphOrientasi.trim() ||
      `Di ${place}, ${protag} berada di tengah suasana saat ${sight} dan ${smellTouch}. ${draft.outlineOrientasi.trim() ||
      `[Ceritakan bagaimana ${protag} menemukan hal ajaib dan mengenal aturan bahwa ${rule}]`
      }`;

    const pKomplikasi =
      (draft.paragraphKomplikasi ?? "").trim() ||
      `Tiba-tiba ${sound} saat ${antag} muncul di ${place}. ${draft.outlineKomplikasiKlimaks.trim() ||
      `[Ceritakan masalah apa yang ditimbulkan ${antag} sehingga ${protag} mulai terdesak]`
      }`;

    const pKlimaks =
      draft.paragraphKlimaks.trim() ||
      `[Tulis ucapan langsung tokoh memakai tanda petik ("...!") di sini.] ${protag} [tulis aksi berani ${protag} memakai perumpamaan seperti/bagaikan/laksana ...] tanpa melanggar aturan bahwa ${rule}.`;

    const pResolusi =
      draft.paragraphResolusi.trim() ||
      `Akhirnya, ${draft.outlineResolusi.trim() ||
      `[ceritakan bagaimana ${protag} menuntaskan masalah secara logis]`
      } ${protag} menyadari bahwa [tulis kalimat tak langsung berisi pelajaran kebaikan yang dipetik].`;

    playChime();
    updateStudioDraft({
      paragraphOrientasi: pOrientasi,
      paragraphKomplikasi: pKomplikasi,
      paragraphKlimaks: pKlimaks,
      paragraphResolusi: pResolusi,
      isModelPresetReference: false,
    });
    showTempBanner(
      "Kerangka rencanamu sudah dipindahkan ke Lembar 2 & 3! Ganti semua tanda [...] dengan kalimat karyamu sendiri agar 5 Misi Tulisan terpenuhi."
    );
    triggerSpreadTransition(1);
  };

  const handleAddExtraSpread = () => {
    const nextNumber = extraSpreads.length + 1;
    const leftPageNum = 7 + extraSpreads.length * 2;
    const rightPageNum = leftPageNum + 1;
    const newSpread: StudioExtraSpread = {
      id: `spread-extra-${Date.now()}`,
      leftTitle: `Lembar Cerita ${nextNumber} · Kiri (${leftPageNum})`,
      rightTitle: `Lembar Cerita ${nextNumber} · Kanan (${rightPageNum})`,
      leftText: "",
      rightText: "",
    };
    const nextExtras = [...extraSpreads, newSpread];
    updateStudioDraft({ extraSpreads: nextExtras });

    const newSpreadIndex = 3 + nextExtras.length - 1;
    playPageFlip();
    if (isMobileBook) {
      setActiveViewTab("dual_book");
      setCurrentSpread(newSpreadIndex);
      setMobilePageSide("left");
    } else {
      setFlipDirection("next");
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      flipTimerRef.current = setTimeout(() => {
        setActiveViewTab("dual_book");
        setCurrentSpread(newSpreadIndex);
        setFlipDirection(null);
        flipTimerRef.current = null;
      }, 440);
    }

    showTempBanner(
      `Lembar kertas baru (Halaman ${leftPageNum}–${rightPageNum}) ditambahkan ke bukumu!`
    );
  };

  const handleUpdateExtraSpread = (
    spreadId: string,
    patch: Partial<Omit<StudioExtraSpread, "id">>
  ) => {
    const updated = extraSpreads.map((item) =>
      item.id === spreadId ? { ...item, ...patch } : item
    );
    updateStudioDraft({ extraSpreads: updated });
  };

  const handleRemoveExtraSpread = (spreadId: string) => {
    playChime();
    const updated = extraSpreads.filter((item) => item.id !== spreadId);
    updateStudioDraft({ extraSpreads: updated });
    setCurrentSpread((prev) => Math.min(prev, 2 + updated.length));
    showTempBanner("Lembar kertas tambahan sudah dihapus dari bukumu.");
  };

  const handleApplyIdeaRecipe = (recipe: FantasyIdeaRecipe) => {
    playChime();
    setForceCustomThemeInput(true);
    setIsGuideDrawerOpen(false);
    setCurrentSpread(0);
    setActiveViewTab("dual_book");
    updateStudioDraft({
      themeCategory: recipe.themeLabel,
      worldRule: recipe.worldRule,
      protagonistName: recipe.protagonistName,
      protagonistTraitAction: `${recipe.protagonistRole}. ${recipe.protagonistTraitAction}`,
      antagonistName: recipe.antagonistName,
      antagonistConflictTrigger: recipe.antagonistConflictTrigger,
      settingPlace: recipe.settingPlace,
      sensorySight: recipe.sensoryHint.sight,
      sensorySound: recipe.sensoryHint.sound,
      sensorySmellTouch: recipe.sensoryHint.smellTouch,
      outlineOrientasi: `${recipe.protagonistName} menemukan ${recipe.magicArtifact} di ${recipe.settingPlace}.`,
      outlineKomplikasiKlimaks: "",
      outlineResolusi: "",
      isModelPresetReference: false,
    });
    showTempBanner(
      `Ramuan ide "${recipe.themeLabel}" masuk ke Lembar 1! Silakan ubah sesukamu lalu kembangkan ceritamu sendiri.`
    );
  };

  const handleInsertLexiconWord = (
    word: string,
    target: TargetParagraphKey
  ) => {
    playChime();
    const cleanedWord = word.trim();
    if (!cleanedWord) return;

    const targetMeta: Record<
      TargetParagraphKey,
      {
        readonly label: string;
        readonly spread: number;
        readonly side: "left" | "right";
        readonly apply: () => void;
      }
    > = {
      orientasi: {
        label: "Paragraf 1 (Awal)",
        spread: 1,
        side: "left",
        apply: () =>
          updateStudioDraft({
            paragraphOrientasi: `${draft.paragraphOrientasi.trimEnd()} ${cleanedWord}`,
          }),
      },
      komplikasi: {
        label: "Paragraf 2 (Masalah)",
        spread: 1,
        side: "right",
        apply: () =>
          updateStudioDraft({
            paragraphKomplikasi: `${(draft.paragraphKomplikasi ?? "").trimEnd()} ${cleanedWord}`,
          }),
      },
      klimaks: {
        label: "Paragraf 3 (Puncak)",
        spread: 2,
        side: "left",
        apply: () =>
          updateStudioDraft({
            paragraphKlimaks: `${draft.paragraphKlimaks.trimEnd()} ${cleanedWord}`,
          }),
      },
      resolusi: {
        label: "Paragraf 4 (Akhir)",
        spread: 2,
        side: "right",
        apply: () =>
          updateStudioDraft({
            paragraphResolusi: `${draft.paragraphResolusi.trimEnd()} ${cleanedWord}`,
          }),
      },
    };

    const chosen = targetMeta[target];
    chosen.apply();
    setActiveViewTab("dual_book");
    setCurrentSpread(chosen.spread);
    if (isMobileBook) setMobilePageSide(chosen.side);
    showTempBanner(
      `Kata "${cleanedWord}" disisipkan ke ${chosen.label}! Rangkai menjadi kalimatmu sendiri.`
    );
  };

  const handleInsertAiMajasFrame = (frameText: string) => {
    playChime();
    updateStudioDraft({
      paragraphKlimaks: `${draft.paragraphKlimaks.trimEnd()} ${frameText.trim()}`,
    });
    setIsGuideDrawerOpen(false);
    setActiveViewTab("dual_book");
    setCurrentSpread(2);
    setMobilePageSide("left");
    showTempBanner(
      "Kerangka majas rumpang dari pemantik tema disisipkan ke Paragraf 3! Ganti bagian [...] dengan kalimatmu sendiri."
    );
  };

  const frameCtx = {
    protagonistName: draft.protagonistName,
    antagonistName: draft.antagonistName,
    settingPlace: draft.settingPlace,
    themeCategory: draft.themeCategory,
  };

  const handleInsertTimeConjunctionSnippet = () => {
    playChime();
    const idx = framePatternCursor.komplikasi_waktu;
    const frame = buildDynamicSentenceFrame("komplikasi_waktu", idx, frameCtx);
    setFramePatternCursor((prev) => ({ ...prev, komplikasi_waktu: idx + 1 }));
    updateStudioDraft({
      paragraphKomplikasi: `${(draft.paragraphKomplikasi ?? "").trimEnd()}${frame.text}`,
    });
    showTempBanner(
      `${frame.patternLabel} (${frame.patternIndex + 1}/${frame.totalPatterns}) disisipkan! Klik lagi untuk variasi pola lain, lalu ganti [...].`
    );
  };

  const handleInsertMajasSnippet = () => {
    playChime();
    const idx = framePatternCursor.majas_asosiasi;
    const frame = buildDynamicSentenceFrame("majas_asosiasi", idx, frameCtx);
    setFramePatternCursor((prev) => ({ ...prev, majas_asosiasi: idx + 1 }));
    updateStudioDraft({
      paragraphKlimaks: `${draft.paragraphKlimaks.trimEnd()}${frame.text}`,
    });
    showTempBanner(
      `${frame.patternLabel} (${frame.patternIndex + 1}/${frame.totalPatterns}) disisipkan! Lengkapi [...] sesuai temamu.`
    );
  };

  const handleInsertDialogSnippet = () => {
    playChime();
    const idx = framePatternCursor.dialog_langsung;
    const frame = buildDynamicSentenceFrame("dialog_langsung", idx, frameCtx);
    setFramePatternCursor((prev) => ({ ...prev, dialog_langsung: idx + 1 }));
    updateStudioDraft({
      paragraphKlimaks: `${draft.paragraphKlimaks.trimEnd()}${frame.text}`,
    });
    showTempBanner(
      `${frame.patternLabel} (${frame.patternIndex + 1}/${frame.totalPatterns}) disisipkan! Ganti [...] dengan ucapan tokohmu.`
    );
  };

  const handleInsertIndirectSnippet = () => {
    playChime();
    const idx = framePatternCursor.tak_langsung_akhir;
    const frame = buildDynamicSentenceFrame("tak_langsung_akhir", idx, frameCtx);
    setFramePatternCursor((prev) => ({ ...prev, tak_langsung_akhir: idx + 1 }));
    updateStudioDraft({
      paragraphResolusi: `${draft.paragraphResolusi.trimEnd()}${frame.text}`,
    });
    showTempBanner(
      `${frame.patternLabel} (${frame.patternIndex + 1}/${frame.totalPatterns}) disisipkan! Lengkapi [...] dengan pesan ceritamu.`
    );
  };

  const handleApplyAllEydFixes = () => {
    if (analysis.eydAndLexiconIssues.length === 0) {
      playChime();
      showTempBanner(
        "Hebat! Kata depan 'di', tanda petik, dan ejaanmu sudah rapi semua."
      );
      return;
    }
    playSealUnlock();
    const fixedExtras = extraSpreads.map((sp) => ({
      ...sp,
      leftText: applyAutomaticEydFixes(sp.leftText),
      rightText: applyAutomaticEydFixes(sp.rightText),
    }));
    updateStudioDraft({
      paragraphOrientasi: applyAutomaticEydFixes(draft.paragraphOrientasi),
      paragraphKomplikasi: applyAutomaticEydFixes(draft.paragraphKomplikasi ?? ""),
      paragraphKlimaks: applyAutomaticEydFixes(draft.paragraphKlimaks),
      paragraphResolusi: applyAutomaticEydFixes(draft.paragraphResolusi),
      extraSpreads: fixedExtras,
    });
    showTempBanner(
      "Seluruh kata depan 'di', tanda petik dialog, dan kata tidak baku sudah dirapikan otomatis!"
    );
  };

  const handleSaveManuscript = () => {
    if (analysis.isModelPresetReference) {
      playErrorTone();
      showTempBanner(
        "Isian ini masih berupa Contoh Cerita. Yuk ubah dulu dengan kalimat ceritamu sendiri sebelum disimpan!"
      );
      return;
    }
    if (analysis.totalWords < 15) {
      playErrorTone();
      showTempBanner(
        "Yuk tulis minimal 15 kata dulu di paragraf ceritamu sebelum disimpan ke Galeri Karya!"
      );
      return;
    }
    if (analysis.isReadyForSeal) {
      playSealUnlock();
    } else {
      playChime();
    }
    const saved = saveCurrentManuscriptToPustaka();
    showTempBanner(
      analysis.isReadyForSeal
        ? `Karya Siap Segel "${saved.storyTitle}" (${saved.wordCount} kata, Skor ${saved.studioScore}%) tersimpan & Segel Studio terbuka!`
        : `Draf "${saved.storyTitle}" (${saved.wordCount} kata) tersimpan sebagai Draf Sementara. Lengkapi min. 4/5 misi, 3 ceklis revisi, tanpa tanda [...], & ejaan rapi untuk membuka Segel Studio.`
    );
  };

  const handlePrintManuscriptAndCharter = () => {
    playChime();
    const win = window.open("", "_blank", "width=940,height=880");
    if (!win) return;

    const safeAuthor = escapeHtml(
      draft.authorName.trim() || "................................................"
    );
    const safeClass = escapeHtml(draft.authorClass.trim() || "VII-....");
    const safeTitle = escapeHtml(
      draft.storyTitle.trim() || "Cerita Fantasi Tanpa Judul"
    );
    const safeTheme = escapeHtml(draft.themeCategory.trim() || "Tema Fantasi Orisinal");
    const safeAmanat = escapeHtml(
      draft.amanat.trim() || "(Belum ditulis oleh penulis)"
    );
    const safeReflection = escapeHtml(
      (draft.authorReflection ?? "").trim() || "(Belum diisi oleh penulis)"
    );
    const safeRank = escapeHtml(metrics.masteryRankTitle);
    const safeWorldRule = escapeHtml(draft.worldRule.trim() || "(Belum ditulis)");
    const safeProtagName = escapeHtml(draft.protagonistName.trim() || "-");
    const safeProtagTrait = escapeHtml(draft.protagonistTraitAction.trim() || "-");
    const safeAntagName = escapeHtml(draft.antagonistName.trim() || "-");
    const safeAntagTrigger = escapeHtml(draft.antagonistConflictTrigger.trim() || "-");
    const safePlace = escapeHtml(draft.settingPlace.trim() || "-");
    const safeSight = escapeHtml(draft.sensorySight.trim() || "-");
    const safeSound = escapeHtml(draft.sensorySound.trim() || "-");
    const safeSmell = escapeHtml(draft.sensorySmellTouch.trim() || "-");

    const extraParagraphsHtml = extraSpreads
      .flatMap((sp) => [sp.leftText.trim(), sp.rightText.trim()])
      .filter(Boolean)
      .map((text) => `<p class="story-para">${escapeHtml(text)}</p>`)
      .join("");

    const komplikasiHtml = (draft.paragraphKomplikasi ?? "").trim()
      ? `<p class="story-para">${escapeHtml(draft.paragraphKomplikasi ?? "")}</p>`
      : "";
    const safeOrientasi = escapeHtml(
      draft.paragraphOrientasi || "(Paragraf Orientasi belum ditulis)"
    );
    const safeKlimaks = escapeHtml(
      draft.paragraphKlimaks || "(Paragraf Puncak Klimaks belum ditulis)"
    );
    const safeResolusi = escapeHtml(
      draft.paragraphResolusi || "(Paragraf Resolusi belum ditulis)"
    );

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Piagam &amp; Karya Cerita — ${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #18130d;
      margin: 0;
      padding: 28px 36px;
      line-height: 1.55;
      background: #fff;
    }
    .charter-box {
      border: 3px double #8c6826;
      padding: 22px 26px;
      border-radius: 10px;
      background: #fdfbf7;
    }
    .header {
      border-bottom: 2px solid #8c6826;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #7c5819;
      font-weight: bold;
    }
    h1 {
      font-size: 21px;
      margin: 4px 0 0 0;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5b4012;
      border-bottom: 1px solid #dec99a;
      padding-bottom: 4px;
      margin: 16px 0 8px 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
      background: #f8f3e6;
      border: 1px solid #d5bd8a;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 6px;
    }
    th, td {
      border: 1px solid #cbb27c;
      padding: 6px 9px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3ead6;
      font-weight: bold;
    }
    .story-container {
      margin-top: 10px;
      padding: 14px 18px;
      border: 1px solid #cbb27c;
      border-radius: 8px;
      background: #fff;
    }
    .story-title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 10px 0;
      color: #2b1d07;
    }
    .story-para {
      text-indent: 24px;
      margin: 0 0 10px 0;
      font-size: 13.5px;
      text-align: justify;
    }
    .amanat-box {
      margin-top: 12px;
      padding: 10px 14px;
      border-left: 4px solid #8c6826;
      background: #f8f3e6;
      font-size: 12.5px;
    }
    @media print {
      body { padding: 10px 14px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:14px; padding:10px 14px; background:#1e160d; color:#f4d993; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-family:sans-serif; font-size:13px;">
    <span><strong>Pratinjau Cetak Piagam &amp; Cerita Fantasimu</strong> — Siap dicetak atau disimpan sebagai PDF untuk dikumpulkan ke Guru.</span>
    <button onclick="window.print()" style="background:#f4d993; color:#111; border:none; padding:7px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">Cetak / Simpan PDF</button>
  </div>

  <div class="charter-box">
    <div class="header">
      <div>
        <div class="brand">PUSTAKA AGUNG E-AKSARALOKA · BAHASA INDONESIA KELAS VII SMP</div>
        <h1>PIAGAM PENULIS MUDA &amp; CERITA FANTASI</h1>
      </div>
      <div style="text-align:right; font-size:11.5px;">
        <div>Karya Cerita Fantasi · Kelas VII SMP</div>
        <div><strong>Skor Keseluruhan: ${metrics.holisticTotalPercentage}%</strong></div>
      </div>
    </div>

    <div class="meta-grid">
      <div><strong>Nama Penulis Muda:</strong> ${safeAuthor}</div>
      <div><strong>Kelas &amp; Gelar:</strong> ${safeClass} · ${safeRank}</div>
      <div><strong>Tema Fantasi:</strong> ${safeTheme}</div>
      <div><strong>Segel Materi Terbuka:</strong> ${metrics.unlockedSealsCount} / 3 Segel (${metrics.overallPercentage}%)</div>
      <div><strong>Skor Cerita (Studio Tulis):</strong> ${analysis.studioScore}% (${analysis.passedIndicatorsCount}/5 Misi Beres)</div>
      <div><strong>Jumlah Kata Cerita:</strong> ${analysis.totalWords} kata</div>
    </div>

    <h2>I. Peta Rencana Dunia Ceritamu</h2>
    <table>
      <tbody>
        <tr>
          <th style="width:28%;">Aturan Logika Dunia Fantasi</th>
          <td>${safeWorldRule}</td>
        </tr>
        <tr>
          <th>Tokoh Protagonis &amp; Bukti Watak</th>
          <td><strong>${safeProtagName}</strong> — ${safeProtagTrait}</td>
        </tr>
        <tr>
          <th>Tokoh Antagonis &amp; Pemicu Konflik</th>
          <td><strong>${safeAntagName}</strong> — ${safeAntagTrigger}</td>
        </tr>
        <tr>
          <th>Latar Tempat &amp; Peta Pancaindra</th>
          <td>
            <strong>Latar:</strong> ${safePlace}<br/>
            <strong>Penglihatan:</strong> ${safeSight} |
            <strong>Pendengaran:</strong> ${safeSound} |
            <strong>Penciuman/Peraba:</strong> ${safeSmell}
          </td>
        </tr>
      </tbody>
    </table>

    <h2>II. Cerita Fantasi Karya Siswa</h2>
    <div class="story-container">
      <div class="story-title">${safeTitle}</div>
      <p class="story-para">${safeOrientasi}</p>
      ${komplikasiHtml}
      <p class="story-para">${safeKlimaks}</p>
      <p class="story-para">${safeResolusi}</p>
      ${extraParagraphsHtml}
      <div class="amanat-box">
        <strong>Amanat / Pesan Moral Cerita:</strong><br/>
        ${safeAmanat}
      </div>
      <div class="amanat-box" style="margin-top:8px; border-left-color:#14532d; background:#f2f8f4;">
        <strong>Refleksi Proses Menulis Siswa (PjBL):</strong><br/>
        ${safeReflection}
      </div>
    </div>

    <h2>III. Penilaian 5 Unsur Cerita &amp; Kerapian Ejaan</h2>
    <table>
      <thead>
        <tr>
          <th>Unsur Penilaian Cerita</th>
          <th>Status</th>
          <th>Skor</th>
          <th>Bukti Kalimat di Dalam Ceritamu</th>
        </tr>
      </thead>
      <tbody>
        ${analysis.indicators
        .map(
          (ind) => `<tr>
          <td><strong>${escapeHtml(ind.title)}</strong></td>
          <td>${ind.passed ? "Beres" : "Perlu Dilengkapi"}</td>
          <td>${ind.earnedScore} / ${ind.scoreWeight}</td>
          <td>${escapeHtml(ind.detectedSnippets.length > 0 ? ind.detectedSnippets.join("; ") : ind.summary)}</td>
        </tr>`
        )
        .join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Ringkasan teks untuk pratinjau 3D di atas buku meja POV (frame-188.webp)
  const deskLeftPreviewTitle =
    draft.storyTitle.trim() || "Buku Cerita Fantasimu";
  const deskLeftPreviewBody =
    draft.paragraphOrientasi.trim() ||
    draft.outlineOrientasi.trim() ||
    (draft.protagonistName.trim()
      ? `Tokoh Utama: ${draft.protagonistName} di ${draft.settingPlace || "Dunia Imajinasi"}. Aturan Keajaiban: ${draft.worldRule || "Belum ditulis"}`
      : "Buku tulis di meja sudah terbuka. Klik bukunya untuk langsung mulai merangkai cerita fantasimu!");

  const deskRightPreviewBody =
    (draft.paragraphKomplikasi ?? "").trim() ||
    draft.paragraphKlimaks.trim() ||
    draft.paragraphResolusi.trim() ||
    "Susun kerangka dunia fantasimu di Lembar 1, lalu kembangkan Orientasi, Komplikasi, Klimaks, dan Resolusi secara bertahap di Lembar 2 dan Lembar 3.";

  const activeExtraSpread: StudioExtraSpread | undefined =
    safeCurrentSpread >= 3 ? extraSpreads[safeCurrentSpread - 3] : undefined;

  // Gaya input/textarea goresan pena transparan murni agar teks menyatu langsung di atas perkamen
  const inkInputClass =
    "parchment-pen-input w-full px-1 py-0.5 text-base md:text-[11.5px] leading-tight font-semibold italic placeholder:text-[#4a2f15]/80";
  const inkTextareaClass =
    "parchment-scroll-hidden parchment-pen-input w-full resize-none px-1 py-0.5 text-base md:text-[11px] leading-[1.35] font-semibold italic placeholder:text-[#4a2f15]/80";
  const inkStoryTextareaClass =
    "parchment-scroll parchment-pen-textarea w-full flex-1 min-h-[200px] md:min-h-0 resize-none border-0 bg-transparent px-1 py-0.5 font-serif text-base md:text-xs lg:text-[13px] font-semibold placeholder:text-[#4a2f15]/80";

  const scalePx = (n: number) => `${(n * stageMetrics.scale).toFixed(2)}px`;

  const studio2dLeftPageStyle: CSSProperties = isMobileBook
    ? {
      display: mobilePageSide === "left" ? "flex" : "none",
      width: "100%",
      height: "100%",
    }
    : {
      width: `${studio2dLeftBaseWidth}px`,
      height: `${studio2dBaseHeight}px`,
      transformOrigin: "0 0",
      transform: studio2dProj.leftMatrixCss,
      filter: studio2dProj.hasLeftCurve ? "url(#studio-2d-curve-left)" : undefined,
    };

  const studio2dRightPageStyle: CSSProperties = isMobileBook
    ? {
      display: mobilePageSide === "right" ? "flex" : "none",
      width: "100%",
      height: "100%",
    }
    : {
      width: `${studio2dRightBaseWidth}px`,
      height: `${studio2dBaseHeight}px`,
      transformOrigin: "0 0",
      transform: studio2dProj.rightMatrixCss,
      filter: studio2dProj.hasRightCurve ? "url(#studio-2d-curve-right)" : undefined,
    };

  const studio2dPageClass = isMobileBook
    ? "parchment-ink parchment-ink-bleed parchment-2d-readable mobile-parchment-sheet pointer-events-auto relative h-full w-full min-h-0 flex-col justify-between overflow-hidden px-4 py-3.5"
    : "parchment-ink parchment-ink-bleed parchment-2d-readable pointer-events-auto absolute top-0 left-0 flex min-h-0 flex-col justify-between overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5";

  const mobileSideLabels: readonly [string, string] =
    activeViewTab === "audit_revisi"
      ? ["1. Skor 5 Misi", "2. Ejaan & Ceklis ->"]
      : activeViewTab === "galeri_piagam"
        ? ["1. Galeri Cerita", "2. Cetak Piagam ->"]
        : safeCurrentSpread === 0
          ? ["1. Tokoh & Aturan", "2. Suasana & Alur ->"]
          : safeCurrentSpread === 1
            ? ["1. Awal Cerita", "2. Muncul Masalah ->"]
            : safeCurrentSpread === 2
              ? ["1. Puncak Masalah", "2. Akhir & Pesan ->"]
              : ["1. Halaman Kiri", "2. Halaman Kanan ->"];

  return (
    <div
      className="pointer-events-none select-none"
      aria-label="Antarmuka Hibrida Meja Studio Tulis dan Buku Menulis Cerita"
    >
      <ParchmentInkFilters />
      {/* ===================================================================== */}
      {/* STATE A: MODE 3D MEJA PUSTAKA (Homografi 4-Titik + Kurva + Action Dock) */}
      {/* Tanpa stacking-context terisolasi agar .parchment-ink menyatu langsung */}
      {/* di atas serat kertas frame-188.webp pada ScrollCanvasSequence.        */}
      {/* ===================================================================== */}
      {!isBookFocused && (
        <>
          <BookPageDisplacementDefs
            prefix="studio-3d"
            leftWidth={studio3dBaseWidth}
            rightWidth={studio3dBaseWidth}
            pageHeight={studio3dBaseHeight}
            leftDisp={studio3dProj.leftDisp}
            rightDisp={studio3dProj.rightDisp}
            inkAbsorption={!isMobileBook}
          />

          {/* Cover-Matched Stage Container: GPU-locked 1:1 with Canvas transform on Narrow Portrait, non-isolated on Desktop/Tablet */}
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
            {/* Left 3D Desk Page: Calibrated 4-Point Homography + Page Arch Curve */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isCalibrating) return;
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                handleEnterFocusBook();
              }}
              onKeyDown={(e) => {
                if (isCalibrating) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleEnterFocusBook();
                }
              }}
              aria-label="Klik halaman kiri buku di atas meja untuk membuka Buku Menulis Cerita"
              className="parchment-ink parchment-desk-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus-visible:outline-2 focus-visible:outline-[#f4d993]"
              style={{
                width: `${studio3dBaseWidth}px`,
                height: `${studio3dBaseHeight}px`,
                padding: `${scalePx(22)} ${scalePx(16)} ${scalePx(18)} ${scalePx(20)}`,
                transformOrigin: "0 0",
                transform: studio3dProj.leftMatrixCss,
                filter: "url(#studio-3d-curve-left)",
                maskImage:
                  "radial-gradient(ellipse 90% 90% at 62% 39%, black 63%, rgba(0,0,0,0.5) 84%, transparent 98%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 90% 90% at 62% 39%, black 63%, rgba(0,0,0,0.5) 84%, transparent 98%)",
              }}
            >
              <div className="book-ink-sweep-left flex flex-1 min-h-0 flex-col justify-between">
                <div style={{ display: "flex", flexDirection: "column", gap: scalePx(7) }}>
                  <div
                    className="book-ink-step-1 flex items-center justify-between border-b border-[#5c3d1e]/26 font-brand font-bold uppercase tracking-[0.14em] text-[#523115]/82"
                    style={{ fontSize: scalePx(9.5), paddingBottom: scalePx(4) }}
                  >
                    <span className="truncate">{draft.themeCategory}</span>
                    <span className="shrink-0">Hal. 1</span>
                  </div>
                  <h3
                    className="book-ink-step-2 font-serif font-bold text-[#351c0a]/88 line-clamp-2"
                    style={{ fontSize: scalePx(15.5), lineHeight: 1.24 }}
                  >
                    {deskLeftPreviewTitle}
                  </h3>
                  <p
                    className="book-ink-step-3 font-serif text-[#42260f]/86 line-clamp-5"
                    style={{ fontSize: scalePx(12.2), lineHeight: 1.48 }}
                  >
                    {deskLeftPreviewBody}
                  </p>
                </div>
                <div
                  className="book-ink-step-4 border-t border-[#5c3d1e]/24 text-right font-serif italic text-[#523115]/80"
                  style={{ fontSize: scalePx(9.8), paddingTop: scalePx(4) }}
                >
                  Klik buku untuk menulis -&gt;
                </div>
              </div>
            </div>

            {/* Right 3D Desk Page: Calibrated 4-Point Homography + Page Arch Curve */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isCalibrating) return;
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                handleEnterFocusBook();
              }}
              onKeyDown={(e) => {
                if (isCalibrating) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleEnterFocusBook();
                }
              }}
              aria-label="Klik halaman kanan buku di atas meja untuk membuka Buku Menulis Cerita"
              className="parchment-ink parchment-desk-ink-bleed pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col justify-between overflow-hidden select-none focus-visible:outline-2 focus-visible:outline-[#f4d993]"
              style={{
                width: `${studio3dBaseWidth}px`,
                height: `${studio3dBaseHeight}px`,
                padding: `${scalePx(22)} ${scalePx(22)} ${scalePx(18)} ${scalePx(15)}`,
                transformOrigin: "0 0",
                transform: studio3dProj.rightMatrixCss,
                filter: "url(#studio-3d-curve-right)",
                maskImage:
                  "radial-gradient(ellipse 90% 90% at 38% 39%, black 63%, rgba(0,0,0,0.5) 84%, transparent 98%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 90% 90% at 38% 39%, black 63%, rgba(0,0,0,0.5) 84%, transparent 98%)",
              }}
            >
              <div className="book-ink-sweep-right flex flex-1 min-h-0 flex-col justify-between">
                <div style={{ display: "flex", flexDirection: "column", gap: scalePx(7) }}>
                  <div
                    className="book-ink-step-2 flex items-center justify-between border-b border-[#5c3d1e]/26 font-brand font-bold uppercase tracking-[0.14em] text-[#523115]/82"
                    style={{ fontSize: scalePx(9.5), paddingBottom: scalePx(4) }}
                  >
                    <span>Pratinjau Tulisan di Meja</span>
                    <span className="shrink-0">Hal. 2</span>
                  </div>
                  <p
                    className="book-ink-step-3 font-serif text-[#42260f]/86 line-clamp-6"
                    style={{ fontSize: scalePx(12.2), lineHeight: 1.48 }}
                  >
                    {deskRightPreviewBody}
                  </p>
                </div>
                <div
                  className="book-ink-step-4 flex items-center justify-start border-t border-[#5c3d1e]/24 font-serif font-semibold text-[#523115]/80"
                  style={{ fontSize: scalePx(9.8), paddingTop: scalePx(4), gap: scalePx(8) }}
                >
                  <span>Kata: {analysis.totalWords}</span>
                  <span>·</span>
                  <span>Misi: {analysis.passedIndicatorsCount}/5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Bottom 3D Thumb Stack (Page Switcher + CTA + Action Dock Bar — Zero Overlap on Mobile) */}
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
                    &lt;- Hal. 1
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
                    Hal. 2 -&gt;
                  </button>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                {analysis.totalWords === 0 && (
                  <span className="hidden sm:inline-block rounded-full border border-[#f4d993]/75 bg-[#040915]/92 px-3 py-0.5 text-[10px] font-bold text-[#f4d993] shadow-lg animate-float-gentle text-center">
                    Petunjuk: Klik buku di meja buat mulai mengarang ceritamu!
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleEnterFocusBook()}
                  className="pointer-events-auto cursor-pointer min-h-[44px] sm:min-h-0 rounded-full border border-[#f4d993]/85 bg-[#040917]/95 md:bg-[#040917]/92 px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#f4d993] shadow-[0_10px_28px_rgba(0,0,0,0.85)] md:backdrop-blur-md transition-transform duration-300 hover:scale-105"
                >
                  Buka Buku &amp; Mulai Mengarang Ceritamu! -&gt;
                </button>
              </div>

              {statusBanner && (
                <div className="pointer-events-auto flex w-full max-w-[1180px] items-center justify-between gap-2 rounded-xl border border-emerald-400/55 bg-emerald-950/95 px-3.5 py-1.5 text-[11px] text-emerald-100 shadow-2xl">
                  <span>{statusBanner}</span>
                  <button
                    type="button"
                    onClick={() => setStatusBanner(null)}
                    className="text-[10px] font-bold uppercase text-emerald-300 hover:text-white cursor-pointer shrink-0"
                  >
                    Tutup
                  </button>
                </div>
              )}

              <div className="parchment-scroll-hidden pointer-events-auto flex w-full max-w-[1180px] items-center gap-2 overflow-x-auto touch-pan-x md:flex-wrap md:justify-between md:overflow-visible rounded-2xl border border-[#d6b26f]/35 bg-slate-950/94 md:bg-slate-950/85 px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.85)] md:backdrop-blur-md">
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <span className="hidden md:inline-block rounded-full bg-[#090d16]/75 border border-white/10 px-3 py-1 text-[11px] font-medium text-stone-200 shadow-md">
                    Status:{" "}
                    <strong
                      className={
                        state.sealStudioUnlocked
                          ? "text-emerald-300"
                          : "text-[#f4d993]"
                      }
                    >
                      {state.sealStudioUnlocked
                        ? "Segel Studio Terbuka ✓"
                        : analysis.isModelPresetReference
                          ? "Contoh Cerita (Ganti Kalimatmu!)"
                          : analysis.totalWords === 0
                            ? "Belum Mulai Menulis"
                            : analysis.unfilledPlaceholderCount > 0
                              ? `Masih Ada ${analysis.unfilledPlaceholderCount} Bagian [...]`
                              : analysis.totalWords < 15
                                ? `Draf Awal (${analysis.totalWords}/15 kata)`
                                : `Draf Berjalan (${analysis.passedIndicatorsCount}/5 Misi)`}
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={onOpenPetaModal}
                    className="whitespace-nowrap rounded-full border border-[#cda250]/55 bg-[#090d16]/90 hover:bg-[#090d16] px-3 py-1.5 md:py-1 text-[11px] font-bold text-[#f4d993] transition-colors cursor-pointer shadow-lg"
                  >
                    Peta &amp; LKS
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenBookAtTab("galeri_piagam")}
                    className="whitespace-nowrap rounded-full border border-[#cda250]/55 bg-[#090d16]/90 hover:bg-[#090d16] px-3 py-1.5 md:py-1 text-[11px] font-bold text-[#f4d993] transition-colors cursor-pointer shadow-lg"
                  >
                    Galeri ({state.savedManuscripts.length})
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenBookAtTab("audit_revisi")}
                    className="whitespace-nowrap rounded-full border border-[#cda250]/60 bg-[#090d16]/90 hover:bg-[#090d16] px-3.5 py-1.5 md:py-1 text-xs font-bold text-[#f4d993] transition-colors cursor-pointer shadow-lg"
                  >
                    Cek Ejaan &amp; Skor ({analysis.passedIndicatorsCount}/5)
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveManuscript}
                    className="whitespace-nowrap rounded-full border border-emerald-400/55 bg-emerald-950/90 hover:bg-emerald-900/95 px-3.5 py-1.5 md:py-1 text-xs font-bold text-emerald-200 transition-colors cursor-pointer shadow-lg"
                  >
                    Simpan Cerita
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      setIsSubmitTeacherModalOpen(true);
                    }}
                    className="whitespace-nowrap rounded-full border border-sky-300/60 bg-sky-950/90 hover:bg-sky-900/95 px-3.5 py-1.5 md:py-1 text-xs font-bold text-sky-100 transition-colors cursor-pointer shadow-lg"
                  >
                    {state.lastSubmissionMeta
                      ? `Kirim Revisi (v${state.lastSubmissionMeta.version})`
                      : "Kumpulkan ke Guru"}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintManuscriptAndCharter}
                    className="whitespace-nowrap rounded-full bg-[#f4d993] hover:bg-[#fbe6af] px-3.5 py-1.5 md:py-1 text-xs font-bold text-slate-950 transition-colors cursor-pointer shadow-lg"
                  >
                    Cetak Piagam
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
              calibration={studioBookCalibration}
              leftMatrixCss={studio3dProj.leftMatrixCss}
              rightMatrixCss={studio3dProj.rightMatrixCss}
              onChangeCalibration={setStudioBookCalibration}
              onResetCalibration={() =>
                setStudioBookCalibration(STUDIO_BOOK_DEFAULT_CALIBRATION)
              }
              onClose={() => setIsCalibrating(false)}
            />
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* STATE B: ZEN WRITING MODE 2D BOOK OVER BACKDROP BLUR (isBookFocused)  */}
      {/* Bebas bar bawah & Navbar Global tersembunyi; kanvas buku terkunci     */}
      {/* ketat ke aspek rasio asli gambar 946:603 agar 100% bebas distorsi.    */}
      {/* ===================================================================== */}
      {isBookFocused && (
        <div
          data-lenis-prevent
          className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 overscroll-none bg-black/10 px-3 pt-2.5 pb-2.5 backdrop-blur-[6px] transition-all duration-300 sm:px-6 sm:pt-3 sm:pb-3 lg:px-10"
        >
          <BookPageDisplacementDefs
            prefix="studio-2d"
            leftWidth={studio2dLeftBaseWidth}
            rightWidth={studio2dRightBaseWidth}
            pageHeight={studio2dBaseHeight}
            leftDisp={studio2dProj.leftDisp}
            rightDisp={studio2dProj.rightDisp}
          />
          {/* ================================================================= */}
          {/* 1. FLOATING HEADER TIPIS DI ATAS BUKU                             */}
          {/* ================================================================= */}
          <div className="relative z-40 flex w-full min-w-0 max-w-[1180px] flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:justify-between shrink-0">
            {/* Mobile Row 1: Swipeable Utility Strip + Pinned Close Button | Desktop Right Group */}
            <div className="flex w-full min-w-0 items-center gap-1.5 md:order-2 md:w-auto">
              <div className="parchment-scroll-hidden flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto touch-pan-x pr-1 pb-0.5 md:flex-none md:overflow-visible md:pr-0 md:pb-0">
                <div className="shrink-0 flex items-center gap-1.5 rounded-full md:rounded-lg border border-[#cda250]/45 bg-[#090d16]/88 px-3 py-1.5 md:py-1 text-[11px] text-stone-200 shadow-md whitespace-nowrap">
                  <span className="font-brand uppercase tracking-wider text-[#f4d993]">
                    Skor:
                  </span>
                  <span className="font-bold text-white">{analysis.studioScore}%</span>
                  <span className="text-stone-500">|</span>
                  <span className="text-emerald-300 font-semibold">
                    {analysis.totalWords} Kata
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    setIsGuideDrawerOpen(false);
                    setStudioTourStep(0);
                  }}
                  aria-label="Buka panduan cara menulis di Studio Tulis"
                  title="Cara Pakai Studio Tulis"
                  className="shrink-0 min-h-[36px] md:min-h-0 rounded-full md:rounded-lg border border-[#f4d993]/55 bg-[#0d0a07]/90 hover:bg-[#0d0a07] px-2.5 py-1 text-[11px] font-bold text-[#f4d993] transition-colors cursor-pointer shadow-md whitespace-nowrap"
                >
                  ?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    setIsGuideDrawerOpen((prev) => !prev);
                  }}
                  aria-expanded={isGuideDrawerOpen}
                  className={`shrink-0 min-h-[36px] md:min-h-0 rounded-full md:rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer shadow-md whitespace-nowrap ${isGuideDrawerOpen
                    ? "border-[#f4d993] bg-[#cda250]/35 text-[#f4d993]"
                    : "border-[#cda250]/55 bg-[#0d0a07]/90 hover:bg-[#0d0a07] text-[#f4d993]"
                    }`}
                >
                  <span className="md:hidden">
                    {isGuideDrawerOpen ? "Tutup" : "Ide & AI"}
                  </span>
                  <span className="hidden md:inline">
                    {isGuideDrawerOpen ? "Tutup Alat Bantu" : "Alat Bantu & AI"}
                  </span>
                </button>

                {activeViewTab === "dual_book" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => triggerTabFlip("audit_revisi")}
                      className="shrink-0 min-h-[36px] md:min-h-0 rounded-full md:rounded-lg border border-emerald-400/55 bg-emerald-950/90 hover:bg-emerald-900/90 px-2.5 py-1 text-[11px] font-bold text-emerald-200 cursor-pointer shadow-md whitespace-nowrap transition-colors"
                    >
                      Cek &amp; AI ({analysis.passedIndicatorsCount}/5)
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className={`hidden shrink-0 md:inline-block rounded-lg border px-2.5 py-1 text-[11px] transition-colors cursor-pointer shadow-md whitespace-nowrap ${isConfirmingResetDraft
                        ? "border-rose-400/80 bg-rose-950/95 font-bold text-rose-100"
                        : "border-white/20 bg-[#0d0a07]/85 hover:bg-[#0d0a07] text-stone-200"
                        }`}
                    >
                      {isConfirmingResetDraft ? "Yakin Hapus?" : "Hapus Isian"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerTabFlip("dual_book")}
                    className="shrink-0 min-h-[36px] md:min-h-0 rounded-full md:rounded-lg border border-[#cda250]/55 bg-[#090d16]/85 hover:bg-[#090d16] px-2.5 py-1 text-[11px] font-bold text-[#f4d993] transition-colors cursor-pointer shadow-md whitespace-nowrap"
                  >
                    &lt;- Menulis
                  </button>
                )}
              </div>

              <div className="flex shrink-0 items-center border-l border-[#cda250]/25 pl-1.5 md:border-l-0 md:pl-0">
                <button
                  type="button"
                  onClick={handleExitFocusBookToDesk}
                  aria-label="Tutup tampilan tulis penuh"
                  className="shrink-0 min-h-[36px] min-w-[40px] md:min-h-0 md:min-w-0 inline-flex items-center justify-center rounded-full md:rounded-lg border border-rose-400/55 bg-[#090d16]/90 hover:bg-rose-950/75 px-2.5 py-1 text-[11px] font-bold text-rose-100 hover:text-rose-200 transition-colors cursor-pointer shadow-md whitespace-nowrap"
                >
                  <span className="lg:hidden">[ X ]</span>
                  <span className="hidden lg:inline">[ X ] Meja</span>
                </button>
              </div>
            </div>

            {/* Kiri: Tab Struktur Lembar Buku (Scrollable di Mobile, Compact 1-Baris di Desktop) */}
            <div className="parchment-scroll-hidden flex w-full min-w-0 items-center gap-1.5 overflow-x-auto touch-pan-x pb-0.5 md:order-1 md:w-auto md:flex-wrap md:overflow-visible md:pb-0">
              {CORE_SPREAD_LABELS.map((sp) => {
                const isSpreadActive =
                  activeViewTab === "dual_book" && safeCurrentSpread === sp.index;
                const compactLabel =
                  sp.index === 0
                    ? "1. Rencana"
                    : sp.index === 1
                      ? "2. Awal & Masalah"
                      : "3. Puncak & Akhir";
                return (
                  <button
                    key={sp.index}
                    type="button"
                    onClick={() => triggerSpreadTransition(sp.index)}
                    className={`shrink-0 min-h-[34px] md:min-h-0 rounded-full md:rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-md whitespace-nowrap ${isSpreadActive
                      ? "bg-[#f4d993] text-slate-950"
                      : "border border-[#cda250]/45 bg-[#0d0a07]/85 text-[#f4d993] hover:bg-[#0d0a07]"
                      }`}
                  >
                    {compactLabel}
                  </button>
                );
              })}

              {extraSpreads.map((ex, idx) => {
                const spIdx = 3 + idx;
                const isSpreadActive =
                  activeViewTab === "dual_book" && safeCurrentSpread === spIdx;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => triggerSpreadTransition(spIdx)}
                    className={`shrink-0 min-h-[34px] md:min-h-0 rounded-full md:rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-md whitespace-nowrap ${isSpreadActive
                      ? "bg-[#f4d993] text-slate-950"
                      : "border border-emerald-400/45 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900/90"
                      }`}
                  >
                    Lembar {4 + idx}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddExtraSpread}
                className="shrink-0 min-h-[34px] md:min-h-0 rounded-full md:rounded-lg border border-emerald-400/55 bg-emerald-950/85 hover:bg-emerald-900/90 px-2.5 py-1 text-[11px] font-bold text-emerald-200 transition-colors cursor-pointer shadow-md whitespace-nowrap"
              >
                + Lembar
              </button>
              <button
                type="button"
                onClick={() => triggerTabFlip("galeri_piagam")}
                className={`shrink-0 min-h-[34px] md:min-h-0 rounded-full md:rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer shadow-md whitespace-nowrap transition-colors ${activeViewTab === "galeri_piagam"
                  ? "border-[#f4d993] bg-[#f4d993] text-slate-950"
                  : "border-[#cda250]/45 bg-[#0d0a07]/85 text-[#f4d993] hover:bg-[#0d0a07]"
                  }`}
              >
                Galeri ({state.savedManuscripts.length})
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                className={`md:hidden shrink-0 min-h-[34px] rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-pointer shadow-md whitespace-nowrap ${isConfirmingResetDraft
                  ? "border-rose-400/80 bg-rose-950/95 font-bold text-rose-100"
                  : "border-white/20 bg-[#0d0a07]/85 text-stone-200"
                  }`}
              >
                {isConfirmingResetDraft ? "Yakin Hapus?" : "Hapus Isian"}
              </button>
            </div>

            {/* Popover Mengambang: Toolkit Hybrid (Ramuan Ide + Kamus 48 Kata + Pemantik AI + 3 Segel) */}
            {isGuideDrawerOpen && (
              <StudioHybridToolkitDrawer
                draft={draft}
                defaultInsertTarget={
                  safeCurrentSpread === 2
                    ? isMobileBook && mobilePageSide === "right"
                      ? "resolusi"
                      : "klimaks"
                    : safeCurrentSpread === 1 && isMobileBook && mobilePageSide === "right"
                      ? "komplikasi"
                      : "orientasi"
                }
                sealBadges={SEAL_BADGES}
                isSealUnlockedForId={isSealUnlockedForId}
                onClose={() => setIsGuideDrawerOpen(false)}
                onJumpToKitabChapter={(chapter) => {
                  setActiveGrimoireChapter(chapter);
                  onJumpToKitabChapter(chapter);
                }}
                onApplySeedOutline={handleApplySeedOutline}
                onApplySeedFullModel={handleApplySeedFullModel}
                onApplyIdeaRecipe={handleApplyIdeaRecipe}
                onInsertWord={handleInsertLexiconWord}
                onInsertMajasFrame={handleInsertAiMajasFrame}
                onUpdateThemeCategory={(nextTheme) => {
                  setForceCustomThemeInput(true);
                  updateStudioDraft({ themeCategory: nextTheme });
                }}
              />
            )}

            {/* Floating Notification Toast (Absolute Overlay — 0px Vertical Layout Shift) */}
            {statusBanner && !isGuideDrawerOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/55 bg-emerald-950/95 px-3.5 py-1.5 text-[11px] text-emerald-100 shadow-2xl">
                <span>{statusBanner}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-[10px] font-bold uppercase text-emerald-300 hover:text-white cursor-pointer shrink-0"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* 2. KANVAS BUKU 2D (DESKTOP) / KERTAS TUNGGAL PROPORSIONAL (MOBILE) */}
          {/* ================================================================= */}
          <div
            style={{
              perspective: isMobileBook ? undefined : "1800px",
            }}
            className={`relative z-10 my-auto flex w-full flex-1 min-h-0 items-center justify-center ${isMobileBook ? "overflow-hidden" : "overflow-visible"
              }`}
          >
            <div
              ref={studio2dContainerRef}
              style={
                isMobileBook
                  ? undefined
                  : {
                    width: "min(94vw, 1180px, calc((100dvh - 4.4rem) * 946 / 603))",
                    aspectRatio: "946 / 603",
                  }
              }
              className={
                isMobileBook
                  ? "relative h-full w-full max-w-[480px] overflow-hidden rounded-2xl border-2 border-[#cda250]/65 bg-[#eed8b0] shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                  : "relative drop-shadow-[0_28px_55px_rgba(0,0,0,0.9)]"
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
                  {/* ASSET 1: book-base.webp (Terkunci rasio asli 1376x768 -> crop 946x603) */}
                  <div
                    style={{
                      backgroundImage: "url('/assets/studio/book-base.webp')",
                      backgroundSize: "145.45% 127.36%",
                      backgroundPosition: "50% 55.15%",
                      backgroundRepeat: "no-repeat",
                    }}
                    className="pointer-events-none absolute inset-0"
                    aria-hidden="true"
                  />

                  {/* ASSET 2: single-page.webp (Terkunci 1:1 tepat di atas book-base.webp) */}
                  <div
                    style={{
                      backgroundImage: "url('/assets/studio/single-page.webp')",
                      backgroundSize: "145.45% 127.36%",
                      backgroundPosition: "50% 55.15%",
                      backgroundRepeat: "no-repeat",
                    }}
                    className="pointer-events-none absolute inset-0"
                    aria-hidden="true"
                  />
                </>
              )}

              {/* ============================================================= */}
              {/* LAYER 3: CALIBRATED HOMOGRAPHY PAGE SPREAD (2D ORTHOGRAPHIC)  */}
              {/* Tanpa wrapper ber-transform/z-index agar .parchment-ink       */}
              {/* menyatu langsung di atas serat kertas single-page.webp        */}
              {/* ============================================================= */}
              <div className="pointer-events-none absolute inset-0">
                {/* =========================================================== */}
                {/* HALAMAN KIRI BUKU                                           */}
                {/* =========================================================== */}
                <div
                  style={studio2dLeftPageStyle}
                  className={studio2dPageClass}
                >
                  <div
                    key={`s2d-left-${activeViewTab}-${safeCurrentSpread}`}
                    className="book-ink-sweep-left flex flex-1 min-h-0 flex-col justify-between"
                  >
                    <div className="parchment-scroll flex flex-1 min-h-0 flex-col overflow-y-auto pr-1.5">
                      {/* TAB 1, SPREAD 0 — HALAMAN 1: IDENTITAS, LANGKAH 1 & 2 */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 0 && (
                        <div className="space-y-2">
                          <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Halaman 1 · Langkah 1
                            </span>
                            <span className="text-[10px] font-bold text-[#5c3d1e] whitespace-nowrap shrink-0">
                              Isi Rencana Ceritamu
                            </span>
                          </div>

                          {/* Baris 1: Identitas Penulis & Tema (Tanpa Kotak Background) */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-4">
                              <label
                                htmlFor="studio-author-name"
                                className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                              >
                                Nama Lengkapmu:
                              </label>
                              <input
                                id="studio-author-name"
                                type="text"
                                value={draft.authorName}
                                onChange={(e) =>
                                  updateStudioDraft({ authorName: e.target.value })
                                }
                                placeholder="Tulis namamu..."
                                className={inkInputClass}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                htmlFor="studio-author-class"
                                className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                              >
                                Kelas:
                              </label>
                              <input
                                id="studio-author-class"
                                type="text"
                                value={draft.authorClass}
                                onChange={(e) =>
                                  updateStudioDraft({ authorClass: e.target.value })
                                }
                                placeholder="VII-A"
                                className={inkInputClass}
                              />
                            </div>
                            <div className="sm:col-span-6 space-y-1">
                              <label
                                htmlFor="studio-theme-select"
                                className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                              >
                                Pilih atau Tulis Tema Ceritamu:
                              </label>
                              <ParchmentSelect
                                id="studio-theme-select"
                                ariaLabel="Pilih Tema Cerita"
                                value={
                                  showCustomThemeInput
                                    ? CUSTOM_THEME_OPTION_VALUE
                                    : draft.themeCategory
                                }
                                options={[
                                  ...PRESET_FANTASY_THEMES.map((theme) => ({
                                    value: theme,
                                    label: theme,
                                  })),
                                  {
                                    value: CUSTOM_THEME_OPTION_VALUE,
                                    label: "+ Tulis Tema Orisinalku Sendiri...",
                                  },
                                ]}
                                onChange={(nextValue) => {
                                  if (nextValue === CUSTOM_THEME_OPTION_VALUE) {
                                    setForceCustomThemeInput(true);
                                    if (isPresetTheme) {
                                      updateStudioDraft({ themeCategory: "" });
                                    }
                                  } else {
                                    setForceCustomThemeInput(false);
                                    updateStudioDraft({
                                      themeCategory: nextValue as FantasyThemeCategory,
                                    });
                                  }
                                }}
                              />
                              {showCustomThemeInput && (
                                <input
                                  id="studio-custom-theme-input"
                                  type="text"
                                  value={draft.themeCategory}
                                  onChange={(e) =>
                                    updateStudioDraft({
                                      themeCategory: e.target.value,
                                    })
                                  }
                                  placeholder="Misal: Kerajaan Kucing Mekanik / Kota Bawah Laut..."
                                  className={inkInputClass}
                                />
                              )}
                            </div>
                          </div>

                          {/* Baris 2: Aturan Dunia Fantasi (Tinta Langsung di Kertas) */}
                          <div>
                            <label
                              htmlFor="studio-world-rule"
                              className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                            >
                              Aturan Benda / Kekuatan Ajaib di Ceritamu:
                            </label>
                            <textarea
                              id="studio-world-rule"
                              rows={3}
                              value={draft.worldRule}
                              onChange={(e) =>
                                updateStudioDraft({ worldRule: e.target.value })
                              }
                              placeholder="Apa syarat atau risiko keajaibannya? Contoh: Setiap jam diputar mundur 15 menit, satu benda kesayangan berubah jadi batu."
                              className={inkTextareaClass}
                            />
                          </div>

                          {/* Baris 3: Langkah 2 Tokoh Protagonis & Antagonis (Tanpa Kotak Background) */}
                          <div className="space-y-1.5 pt-0.5">
                            <p className="font-brand text-[10px] font-bold uppercase tracking-[0.08em] text-[#3d250b] border-b border-[#5c3d1e]/35 pb-0.5 truncate">
                              SIAPA TOKOH DI CERITAMU?
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                              <div className="order-1 sm:order-1 min-w-0">
                                <label
                                  htmlFor="studio-protag-name"
                                  className="block truncate text-[10px] font-bold text-[#14532d]"
                                >
                                  Tokoh Utama (Jagoanmu):
                                </label>
                                <input
                                  id="studio-protag-name"
                                  type="text"
                                  value={draft.protagonistName}
                                  onChange={(e) =>
                                    updateStudioDraft({ protagonistName: e.target.value })
                                  }
                                  placeholder="Contoh: Damar"
                                  className={inkInputClass}
                                />
                              </div>

                              <div className="order-3 sm:order-2 min-w-0">
                                <label
                                  htmlFor="studio-antag-name"
                                  className="block truncate text-[10px] font-bold text-[#7f1d1d]"
                                >
                                  Tokoh Lawan / Pengganggu:
                                </label>
                                <input
                                  id="studio-antag-name"
                                  type="text"
                                  value={draft.antagonistName}
                                  onChange={(e) =>
                                    updateStudioDraft({ antagonistName: e.target.value })
                                  }
                                  placeholder="Contoh: Bayang Waktu"
                                  className={inkInputClass}
                                />
                              </div>

                              <div className="order-2 sm:order-3 min-w-0">
                                <label
                                  htmlFor="studio-protag-trait"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  Sifat Baik &amp; Perbuatannya:
                                </label>
                                <textarea
                                  id="studio-protag-trait"
                                  rows={4}
                                  value={draft.protagonistTraitAction}
                                  onChange={(e) =>
                                    updateStudioDraft({
                                      protagonistTraitAction: e.target.value,
                                    })
                                  }
                                  placeholder="Contoh: Jujur & berani mengakui kesalahan daripada terus berbohong."
                                  className={inkTextareaClass}
                                />
                              </div>

                              <div className="order-4 sm:order-4 min-w-0">
                                <label
                                  htmlFor="studio-antag-conflict"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  Masalah Apa yang Dia Buat?
                                </label>
                                <textarea
                                  id="studio-antag-conflict"
                                  rows={4}
                                  value={draft.antagonistConflictTrigger}
                                  onChange={(e) =>
                                    updateStudioDraft({
                                      antagonistConflictTrigger: e.target.value,
                                    })
                                  }
                                  placeholder="Contoh: Membujuk tokoh utama terus memutar jam sampai kena masalah."
                                  className={inkTextareaClass}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 1 — HALAMAN 3: JUDUL & PARAGRAF I ORIENTASI */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 1 && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                            <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                              <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                                Halaman 3 · Bagian 1: Awal Cerita
                              </span>
                              <span
                                className={`text-[10.5px] font-bold whitespace-nowrap shrink-0 ${analysis.orientasiWords >= 12
                                  ? "text-[#14532d]"
                                  : "text-[#7c2d12]"
                                  }`}
                              >
                                {analysis.orientasiWords} / min. 12 kata
                              </span>
                            </div>

                            <div>
                              <label
                                htmlFor="studio-story-title"
                                className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                              >
                                Judul Cerita Fantasimu:
                              </label>
                              <input
                                id="studio-story-title"
                                type="text"
                                value={draft.storyTitle}
                                onChange={(e) =>
                                  updateStudioDraft({ storyTitle: e.target.value })
                                }
                                placeholder="Tulis judul cerita yang membuat penasaran..."
                                className="parchment-contour-warp parchment-pen-input w-full px-1 py-0.5 font-serif text-[15px] sm:text-base font-bold text-[#241407]/95 placeholder:text-[#5c3d1e]/75"
                              />
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col pt-0.5">
                              <label
                                htmlFor="para-orientasi"
                                className="block truncate text-[11px] font-bold text-[#3d250b] border-b border-[#5c3d1e]/30 pb-1"
                              >
                                Paragraf 1 · Awal Cerita (Kenalkan Tokoh, Tempat &amp; Keajaiban)
                              </label>
                              <textarea
                                id="para-orientasi"
                                rows={9}
                                value={draft.paragraphOrientasi}
                                onChange={(e) =>
                                  updateStudioDraft({
                                    paragraphOrientasi: e.target.value,
                                  })
                                }
                                placeholder="Ceritakan awal kisahnya: siapa tokohmu, sedang berada di mana (sebutkan cahaya, suara, atau udaranya), dan bagaimana ia menemukan hal ajaib..."
                                className={inkStoryTextareaClass}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 2 — HALAMAN 5: PARAGRAF III PUNCAK KLIMAKS */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 2 && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                            <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                              <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                                Halaman 5 · Bagian 3: Puncak Masalah
                              </span>
                              <span
                                className={`text-[10.5px] font-bold whitespace-nowrap shrink-0 ${analysis.klimaksWords >= 10
                                  ? "text-[#14532d]"
                                  : "text-[#7c2d12]"
                                  }`}
                              >
                                {analysis.klimaksWords} / min. 10 kata
                              </span>
                            </div>

                            {/* Pengingat Aturan Dunia Fantasi (Peluang Peran Media #2 — Lembar Analisis Kel. 6) */}
                            <div className="rounded border border-[#5c3d1e]/35 bg-[#5c3d1e]/8 px-2 py-1 text-[9.5px] leading-snug text-[#2f1d0c]">
                              <strong className="text-[#4a2f15]">Pengingat Aturan Ajaibmu:</strong>{" "}
                              {draft.worldRule.trim() ? (
                                <span className="italic">&ldquo;{draft.worldRule.trim()}&rdquo;</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => triggerSpreadTransition(0)}
                                  className="cursor-pointer font-bold text-[#7c2d12] underline"
                                >
                                  Belum diisi — klik untuk isi di Lembar 1 -&gt;
                                </button>
                              )}
                            </div>

                            <div className="flex min-h-[26px] flex-wrap items-center justify-between gap-1.5 border-b border-[#5c3d1e]/30 pb-1">
                              <span className="text-[10px] font-bold text-[#3d250b] whitespace-nowrap">
                                Bantuan Cepat:
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleInsertMajasSnippet}
                                  className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#3d250b] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  + Kerangka Perumpamaan
                                </button>
                                <button
                                  type="button"
                                  onClick={handleInsertDialogSnippet}
                                  className="rounded-full border border-[#1e3a8a]/75 bg-[#1e3a8a]/12 hover:bg-[#1e3a8a]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#1e3a8a] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  + Kerangka Dialog (&ldquo;...&rdquo;)
                                </button>
                              </div>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">
                              <label
                                htmlFor="para-klimaks"
                                className="block truncate text-[11px] font-bold text-[#3d250b] border-b border-[#5c3d1e]/30 pb-1"
                              >
                                Paragraf 3 · Puncak Masalah (Bagian Paling Menegangkan!)
                              </label>
                              <textarea
                                id="para-klimaks"
                                rows={9}
                                value={draft.paragraphKlimaks}
                                onChange={(e) =>
                                  updateStudioDraft({
                                    paragraphKlimaks: e.target.value,
                                  })
                                }
                                placeholder='Ceritakan saat masalah mencapai puncaknya! Yuk tambahkan kalimat dialog ("...") dan perumpamaan (seperti/bagaikan)...'
                                className={inkStoryTextareaClass}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 3+ — EXTRA SPREAD LEFT PAGE */}
                      {activeViewTab === "dual_book" && activeExtraSpread && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              {activeExtraSpread.leftTitle}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtraSpread(activeExtraSpread.id)}
                              className="rounded-full border border-[#7f1d1d]/75 bg-[#7f1d1d]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#7f1d1d] hover:bg-[#7f1d1d]/22 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              Hapus Lembar Ini
                            </button>
                          </div>
                          <textarea
                            aria-label={activeExtraSpread.leftTitle}
                            rows={11}
                            value={activeExtraSpread.leftText}
                            onChange={(e) =>
                              handleUpdateExtraSpread(activeExtraSpread.id, {
                                leftText: e.target.value,
                              })
                            }
                            placeholder="Lanjutkan kisah petualangan tokohmu langsung di atas halaman perkamen ini..."
                            className={inkStoryTextareaClass}
                          />
                        </div>
                      )}

                      {/* TAB 2 — HALAMAN KIRI: PEMINDAIAN 5 INDIKATOR MENULIS NARATIF */}
                      {activeViewTab === "audit_revisi" && (
                        <div className="space-y-2">
                          <div className="flex min-h-[26px] items-center border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Pemeriksa Cerita · 5 Misi Tulisanmu
                            </span>
                          </div>

                          {analysis.unfilledPlaceholderCount > 0 && (
                            <div className="rounded border border-[#7f1d1d]/55 bg-[#7f1d1d]/10 px-2 py-1.5 text-[10.5px] font-semibold text-[#7f1d1d]">
                              Masih ada {analysis.unfilledPlaceholderCount} bagian panduan bertanda [...] yang belum kamu ganti dengan kalimatmu sendiri. Lengkapi dulu agar Segel Studio bisa terbuka!
                            </div>
                          )}

                          <div className="space-y-2 divide-y divide-[#5c3d1e]/25">
                            {analysis.indicators.map((ind) => (
                              <div key={ind.id} className="pt-1.5 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#1e1106]">
                                    {ind.title}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold shrink-0 ${ind.passed ? "text-[#14532d]" : "text-[#7c2d12]"
                                      }`}
                                  >
                                    {ind.passed ? "Beres ✓" : `${ind.earnedScore}/${ind.scoreWeight}`}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-[#2f1d0c]">
                                  {ind.summary}
                                </p>
                                {!ind.passed && (
                                  <p className="mt-0.5 text-[10px] font-semibold text-[#7c2d12]">
                                    Tips: {ind.improvementHint}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>

                          <StudioAiSocraticPanel
                            draft={draft}
                            totalWords={analysis.totalWords}
                          />
                        </div>
                      )}

                      {/* TAB 3 — HALAMAN KIRI: DAFTAR KARYA TERSIMPAN */}
                      {activeViewTab === "galeri_piagam" && (
                        <div className="space-y-2">
                          <div className="flex min-h-[26px] items-center border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Galeri Ceritamu ({state.savedManuscripts.length} Karya)
                            </span>
                          </div>

                          {state.savedManuscripts.length === 0 ? (
                            <div className="py-8 space-y-2">
                              <p className="font-serif text-sm font-bold text-[#1e1106]">
                                Belum Ada Cerita yang Disimpan
                              </p>
                              <p className="text-xs text-[#3d250b] leading-relaxed">
                                Yuk tulis cerita fantasimu dulu, lalu klik tombol <strong>+ Simpan Ceritaku Sekarang</strong> di halaman kanan atau di bawah meja!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5 divide-y divide-[#5c3d1e]/30">
                              {state.savedManuscripts.map((ms) => (
                                <div key={ms.id} className="pt-2 first:pt-0 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase text-[#5c3d1e]">
                                      {ms.themeCategory}
                                    </span>
                                    <span className="text-[10px] font-bold text-[#14532d]">
                                      Skor {ms.studioScore}% · {ms.wordCount} kata
                                    </span>
                                  </div>
                                  <h3 className="parchment-contour-warp font-serif text-sm font-bold text-[#1e1106]">
                                    {ms.storyTitle}
                                  </h3>
                                  <p className="text-[10px] text-[#4e3210]">
                                    Oleh: {ms.authorName} ({ms.authorClass})
                                  </p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playChime();
                                        loadSavedManuscriptToEditor(ms.id);
                                        triggerTabFlip("dual_book");
                                        setCurrentSpread(1);
                                        showTempBanner(
                                          `Cerita "${ms.storyTitle}" dibuka kembali di bukumu!`
                                        );
                                      }}
                                      className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-3 py-0.5 text-[10px] font-bold text-[#3d250b] transition-colors cursor-pointer"
                                    >
                                      Buka di Buku Cerita
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirmDeleteManuscriptId !== ms.id) {
                                          playErrorTone();
                                          setConfirmDeleteManuscriptId(ms.id);
                                          return;
                                        }
                                        playErrorTone();
                                        setConfirmDeleteManuscriptId(null);
                                        deleteSavedManuscriptFromPustaka(ms.id);
                                        showTempBanner(
                                          `Karya "${ms.storyTitle}" dihapus dari Galeri.`
                                        );
                                      }}
                                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${confirmDeleteManuscriptId === ms.id
                                        ? "border-[#7f1d1d] bg-[#7f1d1d] text-[#fdf6e7]"
                                        : "border-[#7f1d1d]/75 bg-[#7f1d1d]/12 hover:bg-[#7f1d1d]/22 text-[#7f1d1d]"
                                        }`}
                                    >
                                      {confirmDeleteManuscriptId === ms.id
                                        ? "Yakin Hapus?"
                                        : "Hapus"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Navigasi Sudut Kiri Bawah & Nomor Halaman Kiri di Dalam Margin Kertas */}
                    <div className="mt-1 flex shrink-0 items-center justify-between gap-2 border-t border-[#5c3d1e]/30 pt-1 text-[10px] font-bold text-[#4e3210]">
                      {activeViewTab === "dual_book" ? (
                        <button
                          type="button"
                          disabled={safeCurrentSpread === 0 || flipDirection !== null}
                          onClick={() => triggerSpreadTransition(safeCurrentSpread - 1)}
                          className="rounded border border-[#5c3d1e]/50 px-2 py-0.5 text-[10px] font-bold text-[#2b1706] hover:bg-[#5c3d1e]/15 disabled:opacity-35 cursor-pointer disabled:pointer-events-none transition-colors"
                        >
                          &lt;- Lembar Sebelumnya
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={flipDirection !== null}
                          onClick={() => triggerTabFlip("dual_book")}
                          className="rounded border border-[#5c3d1e]/50 px-2 py-0.5 text-[10px] font-bold text-[#2b1706] hover:bg-[#5c3d1e]/15 cursor-pointer transition-colors"
                        >
                          &lt;- Kembali ke Lembar Cerita
                        </button>
                      )}

                      <span>
                        {activeViewTab === "dual_book"
                          ? `Halaman ${safeCurrentSpread * 2 + 1}`
                          : activeViewTab === "audit_revisi"
                            ? "Lembar Pemeriksa · Kiri"
                            : "Lembar Galeri · Kiri"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* =========================================================== */}
                {/* HALAMAN KANAN BUKU                                          */}
                {/* =========================================================== */}
                <div
                  style={studio2dRightPageStyle}
                  className={studio2dPageClass}
                >
                  <div
                    key={`s2d-right-${activeViewTab}-${safeCurrentSpread}`}
                    className="book-ink-sweep-right flex flex-1 min-h-0 flex-col justify-between"
                  >
                    <div className="parchment-scroll flex flex-1 min-h-0 flex-col overflow-y-auto pr-1.5">
                      {/* TAB 1, SPREAD 0 — HALAMAN 2: LANGKAH 3 (PANCAINDRA) & LANGKAH 4 (KERANGKA ALUR) */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 0 && (
                        <div className="space-y-1.5">
                          <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Halaman 2 · Tempat &amp; Jalan Cerita
                            </span>
                            <button
                              type="button"
                              onClick={handleGenerateDraftFromOutline}
                              className="rounded-full border border-[#14532d]/75 bg-[#14532d]/12 hover:bg-[#14532d]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#14532d] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              Rakit Kerangka ke Halaman -&gt;
                            </button>
                          </div>

                          {/* Langkah 3: Latar Tempat & Peta Pancaindra (Tanpa Kotak Background) */}
                          <div className="space-y-1">
                            <p className="font-brand text-[10px] font-bold uppercase tracking-[0.08em] text-[#3d250b] truncate">
                              DI MANA CERITAMU TERJADI? (PANCAINDRA)
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                              <div className="min-w-0">
                                <label
                                  htmlFor="studio-setting-place"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  Nama Tempat Kejadian:
                                </label>
                                <textarea
                                  id="studio-setting-place"
                                  rows={3}
                                  value={draft.settingPlace}
                                  onChange={(e) =>
                                    updateStudioDraft({ settingPlace: e.target.value })
                                  }
                                  placeholder="Contoh: Loteng Perpustakaan Tua di sekolah"
                                  className={inkTextareaClass}
                                />
                              </div>
                              <div className="min-w-0">
                                <label
                                  htmlFor="studio-sensory-sight"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  1. Apa yang Terlihat? (Cahaya/Warna):
                                </label>
                                <textarea
                                  id="studio-sensory-sight"
                                  rows={3}
                                  value={draft.sensorySight}
                                  onChange={(e) =>
                                    updateStudioDraft({ sensorySight: e.target.value })
                                  }
                                  placeholder="Contoh: Cahaya keemasan berpendar dari jam tua di sela debu."
                                  className={inkTextareaClass}
                                />
                              </div>
                              <div className="min-w-0">
                                <label
                                  htmlFor="studio-sensory-sound"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  2. Apa yang Terdengar? (Suara):
                                </label>
                                <textarea
                                  id="studio-sensory-sound"
                                  rows={3}
                                  value={draft.sensorySound}
                                  onChange={(e) =>
                                    updateStudioDraft({ sensorySound: e.target.value })
                                  }
                                  placeholder="Contoh: Detak jarum jam menggema disusul derit papan kayu."
                                  className={inkTextareaClass}
                                />
                              </div>
                              <div className="min-w-0">
                                <label
                                  htmlFor="studio-sensory-smell"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  3. Apa yang Terasa? (Aroma/Suhu):
                                </label>
                                <textarea
                                  id="studio-sensory-smell"
                                  rows={3}
                                  value={draft.sensorySmellTouch}
                                  onChange={(e) =>
                                    updateStudioDraft({
                                      sensorySmellTouch: e.target.value,
                                    })
                                  }
                                  placeholder="Contoh: Bau kertas tua yang lembap dan udara dingin."
                                  className={inkTextareaClass}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Langkah 4: Kerangka Alur 3 Babak (Tanpa Kotak Background) */}
                          <div className="space-y-1 pt-0.5">
                            <p className="font-brand text-[10px] font-bold uppercase tracking-[0.08em] text-[#3d250b] border-b border-[#5c3d1e]/35 pb-0.5 truncate">
                              RENCANA JALAN CERITAMU (AWAL -&gt; MASALAH -&gt; AKHIR)
                            </p>
                            <div className="space-y-1">
                              <div>
                                <label
                                  htmlFor="outline-orientasi"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  1. Rencana Awal Cerita:
                                </label>
                                <textarea
                                  id="outline-orientasi"
                                  rows={2}
                                  value={draft.outlineOrientasi}
                                  onChange={(e) =>
                                    updateStudioDraft({ outlineOrientasi: e.target.value })
                                  }
                                  placeholder="Bagaimana tokohmu pertama kali menemukan benda/kejadian ajaib?"
                                  className={inkTextareaClass}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="outline-klimaks"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  2. Rencana Masalah &amp; Puncaknya:
                                </label>
                                <textarea
                                  id="outline-klimaks"
                                  rows={2}
                                  value={draft.outlineKomplikasiKlimaks}
                                  onChange={(e) =>
                                    updateStudioDraft({
                                      outlineKomplikasiKlimaks: e.target.value,
                                    })
                                  }
                                  placeholder="Masalah seru apa yang muncul sampai membuat tokohmu terdesak?"
                                  className={inkTextareaClass}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="outline-resolusi"
                                  className="block truncate text-[10px] font-bold text-[#3d250b]"
                                >
                                  3. Rencana Akhir Cerita:
                                </label>
                                <textarea
                                  id="outline-resolusi"
                                  rows={2}
                                  value={draft.outlineResolusi}
                                  onChange={(e) =>
                                    updateStudioDraft({ outlineResolusi: e.target.value })
                                  }
                                  placeholder="Bagaimana tokohmu menyelesaikan masalah dan mendapat pelajaran baik?"
                                  className={inkTextareaClass}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 1 — HALAMAN 4: PARAGRAF II KOMPLIKASI */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 1 && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                            <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                              <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                                Halaman 4 · Bagian 2: Muncul Masalah
                              </span>
                              <span
                                className={`text-[10.5px] font-bold whitespace-nowrap shrink-0 ${analysis.komplikasiWords >= 8
                                  ? "text-[#14532d]"
                                  : "text-[#7c2d12]"
                                  }`}
                              >
                                {analysis.komplikasiWords} / min. 8 kata
                              </span>
                            </div>

                            {/* Pengingat Aturan Dunia Fantasi (Peluang Peran Media #2 — Lembar Analisis Kel. 6) */}
                            <div className="rounded border border-[#5c3d1e]/35 bg-[#5c3d1e]/8 px-2 py-1 text-[9.5px] leading-snug text-[#2f1d0c]">
                              <strong className="text-[#4a2f15]">Pengingat Aturan Ajaibmu:</strong>{" "}
                              {draft.worldRule.trim() ? (
                                <span className="italic">&ldquo;{draft.worldRule.trim()}&rdquo;</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => triggerSpreadTransition(0)}
                                  className="cursor-pointer font-bold text-[#7c2d12] underline"
                                >
                                  Belum diisi — klik untuk isi di Lembar 1 -&gt;
                                </button>
                              )}
                            </div>

                            {/* Quick-Insert Time Conjunction + KBBI Reference Linker */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-[#5c3d1e]/30 pb-1.5">
                              <button
                                type="button"
                                onClick={handleInsertTimeConjunctionSnippet}
                                className="self-start rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#3d250b] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                              >
                                + Kerangka &ldquo;Tiba-tiba...&rdquo;
                              </button>

                              <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
                                <input
                                  aria-label="Kata untuk dicek di Kamus Bahasa Indonesia"
                                  type="text"
                                  value={kbbiLookupQuery}
                                  onChange={(e) => setKbbiLookupQuery(e.target.value)}
                                  placeholder="Cari arti kata..."
                                  className="parchment-pen-input flex-1 sm:flex-none sm:w-28 min-w-0 px-1 py-0.5 text-xs sm:text-[10.5px] font-semibold text-[#241407]/95 placeholder:text-[#5c3d1e]/75"
                                />
                                <a
                                  href={buildKbbiReferenceUrl(kbbiLookupQuery || "imajinasi")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#3d250b] no-underline transition-colors shrink-0 whitespace-nowrap"
                                >
                                  Cek Kamus -&gt;
                                </a>
                              </div>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col pt-0.5">
                              <label
                                htmlFor="para-komplikasi"
                                className="block truncate text-[11px] font-bold text-[#3d250b] border-b border-[#5c3d1e]/30 pb-1"
                              >
                                Paragraf 2 · Munculnya Masalah (Tokoh Lawan / Rintangan)
                              </label>
                              <textarea
                                id="para-komplikasi"
                                rows={9}
                                value={draft.paragraphKomplikasi ?? ""}
                                onChange={(e) =>
                                  updateStudioDraft({
                                    paragraphKomplikasi: e.target.value,
                                  })
                                }
                                placeholder="Ceritakan saat masalah mulai muncul: misalnya tokoh lawan datang mengganggu atau keajaibannya mulai menimbulkan bahaya..."
                                className={inkStoryTextareaClass}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 2 — HALAMAN 6: PARAGRAF IV RESOLUSI & AMANAT */}
                      {activeViewTab === "dual_book" && safeCurrentSpread === 2 && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                            <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                              <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                                Halaman 6 · Bagian 4: Akhir &amp; Pesan
                              </span>
                              <span
                                className={`text-[10.5px] font-bold whitespace-nowrap shrink-0 ${analysis.resolusiWords >= 12
                                  ? "text-[#14532d]"
                                  : "text-[#7c2d12]"
                                  }`}
                              >
                                {analysis.resolusiWords} / min. 12 kata
                              </span>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">
                              <div className="flex min-h-[26px] flex-wrap items-center justify-between gap-2 border-b border-[#5c3d1e]/30 pb-1">
                                <label
                                  htmlFor="para-resolusi"
                                  className="block truncate text-[11px] font-bold text-[#3d250b]"
                                >
                                  Paragraf 4 · Akhir Cerita (Masalah Selesai)
                                </label>
                                <button
                                  type="button"
                                  onClick={handleInsertIndirectSnippet}
                                  className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#3d250b] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                                >
                                  + Kerangka Kalimat Akhir
                                </button>
                              </div>
                              <textarea
                                id="para-resolusi"
                                rows={5}
                                value={draft.paragraphResolusi}
                                onChange={(e) =>
                                  updateStudioDraft({
                                    paragraphResolusi: e.target.value,
                                  })
                                }
                                placeholder="Ceritakan bagaimana tokohmu berhasil menyelesaikan masalah dengan cerdik dan sesuai aturan keajaibannya..."
                                className={inkStoryTextareaClass}
                              />
                            </div>

                            <div className="border-t border-[#5c3d1e]/35 pt-1.5 shrink-0">
                              <label
                                htmlFor="studio-amanat"
                                className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                              >
                                Pesan Kebaikan (Amanat) Ceritamu:
                              </label>
                              <textarea
                                id="studio-amanat"
                                rows={2}
                                value={draft.amanat}
                                onChange={(e) =>
                                  updateStudioDraft({ amanat: e.target.value })
                                }
                                placeholder="Pelajaran baik apa yang bisa diambil teman-teman dari ceritamu?"
                                className={inkTextareaClass}
                              />
                            </div>

                            {/* Ringkasan Status 5 Indikator di Atas Kertas */}
                            <div className="border-t border-[#5c3d1e]/35 pt-1.5 shrink-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-brand text-[10px] font-bold uppercase tracking-wider text-[#3d250b] truncate">
                                  Misi Tulisanmu: {analysis.passedIndicatorsCount}/5 Beres
                                </span>
                                {analysis.eydAndLexiconIssues.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={handleApplyAllEydFixes}
                                    className="rounded-full border border-[#7f1d1d]/75 bg-[#7f1d1d]/12 hover:bg-[#7f1d1d]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#7f1d1d] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                                  >
                                    Rapikan {analysis.eydAndLexiconIssues.length} Ejaan Otomatis
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => triggerTabFlip("audit_revisi")}
                                    className="text-[10px] font-bold text-[#14532d] underline cursor-pointer shrink-0 whitespace-nowrap"
                                  >
                                    Cek Skor &amp; Ejaan Ceritaku -&gt;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 1, SPREAD 3+ — EXTRA SPREAD RIGHT PAGE */}
                      {activeViewTab === "dual_book" && activeExtraSpread && (
                        <div className="flex flex-1 min-h-0 flex-col justify-between space-y-2">
                          <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              {activeExtraSpread.rightTitle}
                            </span>
                            <span className="text-[10px] font-bold text-[#5c3d1e] shrink-0 whitespace-nowrap">
                              Total: {analysis.totalWords} Kata
                            </span>
                          </div>
                          <textarea
                            aria-label={activeExtraSpread.rightTitle}
                            rows={11}
                            value={activeExtraSpread.rightText}
                            onChange={(e) =>
                              handleUpdateExtraSpread(activeExtraSpread.id, {
                                rightText: e.target.value,
                              })
                            }
                            placeholder="Tuliskan lanjutan adegan, dialog tambahan, atau epilog ceritamu di halaman kanan ini..."
                            className={inkStoryTextareaClass}
                          />
                        </div>
                      )}

                      {/* TAB 2 — HALAMAN KANAN: AUDIT EYD V & DAFTAR PERIKSA REVISI MANDIRI */}
                      {activeViewTab === "audit_revisi" && (
                        <div className="space-y-2.5">
                          <div className="flex min-h-[26px] items-center justify-between gap-2 border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Cek Ejaan &amp; 5 Ceklis Sebelum Kumpul
                            </span>
                            {analysis.eydAndLexiconIssues.length > 0 && (
                              <button
                                type="button"
                                onClick={handleApplyAllEydFixes}
                                className="rounded-full border border-[#7f1d1d]/75 bg-[#7f1d1d]/12 hover:bg-[#7f1d1d]/22 px-2.5 py-0.5 text-[10px] font-bold text-[#7f1d1d] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                              >
                                Rapikan Semua Ejaan
                              </button>
                            )}
                          </div>

                          {analysis.eydAndLexiconIssues.length === 0 ? (
                            <p className="text-[11px] font-semibold text-[#14532d]">
                              Mantap! Penulisan kata depan tempat (&ldquo;di&rdquo;), tanda petik dialog, dan kata baku di ceritamu sudah rapi semua!
                            </p>
                          ) : (
                            <div className="space-y-1.5 border-b border-[#5c3d1e]/30 pb-2">
                              {analysis.eydAndLexiconIssues.map((issue) => (
                                <div key={issue.id} className="text-[11px]">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="font-bold text-[#7f1d1d]">
                                      Tertulis: &ldquo;{issue.foundText}&rdquo; -&gt; Seharusnya:{" "}
                                      <span className="text-[#14532d]">
                                        &ldquo;{issue.suggestion}&rdquo;
                                      </span>
                                    </span>
                                    <a
                                      href={issue.referenceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-bold text-[#3d250b] underline"
                                    >
                                      {issue.ruleReference}
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Daftar Periksa Revisi Mandiri (Tinta di Atas Kertas + Checkbox SVG Asli) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-brand text-[10px] font-bold uppercase tracking-wider text-[#3d250b]">
                                Centang 5 Ceklis Ini Kalau Sudah Sesuai ({analysis.revisionCheckedCount}/{analysis.totalRevisionChecklistCount})
                              </span>
                            </div>

                            <div className="space-y-1.5 divide-y divide-[#5c3d1e]/25">
                              {SELF_REVISION_CHECKLIST.map((item) => {
                                const checked = draft.selfRevisionChecks[item.id] === true;
                                return (
                                  <label
                                    key={item.id}
                                    className="flex w-full items-start gap-2.5 pt-1.5 first:pt-0 text-left text-[11px] cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (!checked && analysis.totalWords === 0) {
                                          playErrorTone();
                                          showTempBanner(
                                            "Tulis dulu ceritamu di Lembar 2 & 3 sebelum mencentang daftar periksa revisi!"
                                          );
                                          return;
                                        }
                                        if (
                                          !checked &&
                                          item.id === "rev-eyd" &&
                                          analysis.eydAndLexiconIssues.length > 0
                                        ) {
                                          playErrorTone();
                                          showTempBanner(
                                            `Masih ada ${analysis.eydAndLexiconIssues.length} catatan ejaan di atas. Rapikan dulu sebelum mencentang poin EYD ini!`
                                          );
                                          return;
                                        }
                                        playChime();
                                        toggleStudioRevisionCheck(item.id);
                                      }}
                                      className="sr-only"
                                    />
                                    <span
                                      aria-hidden="true"
                                      className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${checked
                                        ? "border-[#14532d] bg-[#14532d]/18 text-[#14532d] font-bold"
                                        : "border-[#5c3d1e] bg-transparent text-transparent"
                                        }`}
                                    >
                                      <svg
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="h-3 w-3"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#5c3d1e]">
                                        {item.category}
                                      </span>
                                      <p className="leading-snug text-[#1e1106] font-medium">
                                        {item.label}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 3 — HALAMAN KANAN: RINGKASAN PIAGAM PENJAGA AKSARA */}
                      {activeViewTab === "galeri_piagam" && (
                        <div className="space-y-3">
                          <div className="flex min-h-[26px] items-center border-b border-[#5c3d1e]/45 pb-1">
                            <span className="font-brand text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d250b] truncate">
                              Piagam Penulis Muda &amp; Rapor Ceritamu
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-[#1e1106]">
                            <p>
                              <strong>Gelar Penulis:</strong>{" "}
                              <span className="font-bold text-[#14532d]">
                                {metrics.masteryRankTitle}
                              </span>
                            </p>
                            <p>
                              <strong>Judul Ceritamu:</strong>{" "}
                              {draft.storyTitle.trim() || "(Belum diberi judul)"}
                            </p>
                            <p>
                              <strong>Penulis Muda:</strong>{" "}
                              {draft.authorName.trim() || "(Belum diisi)"} ({draft.authorClass})
                            </p>
                            <p>
                              <strong>Tema Fantasi:</strong> {draft.themeCategory || "(Belum diisi)"}
                            </p>
                            <p>
                              <strong>Panjang &amp; Skor Cerita:</strong> {analysis.totalWords} kata · {analysis.studioScore}% ({analysis.passedIndicatorsCount}/5 Misi Beres)
                            </p>
                            <p>
                              <strong>Total Skor Petualanganmu:</strong> {metrics.holisticTotalPercentage}% ({metrics.kelayakanCategory})
                            </p>
                          </div>

                          {/* Status Syarat Segel Studio (Jelas & Ramah Anak) */}
                          <div
                            className={`rounded border px-2 py-1.5 text-[10px] leading-snug font-semibold ${analysis.isReadyForSeal
                              ? "border-[#14532d]/50 bg-[#14532d]/10 text-[#14532d]"
                              : "border-[#5c3d1e]/40 bg-[#5c3d1e]/8 text-[#4a2f15]"
                              }`}
                          >
                            {analysis.isReadyForSeal
                              ? "Karyamu memenuhi semua syarat Segel Studio! Yuk klik Simpan & Cetak Piagam!"
                              : `Syarat Segel Studio: min. 4/5 Misi (${analysis.passedIndicatorsCount}/5), min. 3 ceklis revisi (${analysis.revisionCheckedCount}/5), tanpa tanda [...] (${analysis.unfilledPlaceholderCount} tersisa), dan 0 ejaan keliru (${analysis.eydAndLexiconIssues.length}).`}
                          </div>

                          {/* Kolom Refleksi Singkat Penulis Muda (Penilaian Autentik PjBL: Proses + Produk + Refleksi) */}
                          <div className="border-t border-[#5c3d1e]/35 pt-2 space-y-1">
                            <label
                              htmlFor="studio-author-reflection"
                              className="block text-[10px] font-bold uppercase tracking-wider text-[#3d250b]"
                            >
                              Refleksi Singkatmu (Ikut Tercetak di Piagam):
                            </label>
                            <textarea
                              id="studio-author-reflection"
                              rows={2}
                              value={draft.authorReflection ?? ""}
                              onChange={(e) =>
                                updateStudioDraft({ authorReflection: e.target.value })
                              }
                              placeholder="Bagian mana dari ceritamu yang paling seru ditulis atau paling menantang saat direvisi?"
                              className={inkTextareaClass}
                            />
                          </div>

                          <div className="border-t border-[#5c3d1e]/35 pt-2.5 space-y-2">
                            <p className="text-[11px] leading-relaxed text-[#2f1d0c]">
                              Simpan ceritamu ke Galeri, kumpulkan langsung ke <strong>Guru &amp; Spreadsheet</strong>, atau cetak <strong>Piagam Penulis Muda</strong>!
                            </p>
                            {state.lastSubmissionMeta && (
                              <div className="rounded border border-[#14532d]/45 bg-[#14532d]/10 px-2 py-1 text-[10px] font-semibold text-[#14532d]">
                                Terkirim ke Guru · ID {state.lastSubmissionMeta.submissionId} (v{state.lastSubmissionMeta.version}) ·{" "}
                                {state.lastSubmissionMeta.sheetSyncStatus === "synced"
                                  ? "Tersinkron ke Spreadsheet"
                                  : "Tersimpan di Server Guru"}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveManuscript}
                                className="rounded-full border border-[#14532d]/75 bg-[#14532d]/12 hover:bg-[#14532d]/22 px-3 py-1 text-xs font-bold text-[#14532d] transition-colors cursor-pointer"
                              >
                                + Simpan Galeri
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  playChime();
                                  setIsSubmitTeacherModalOpen(true);
                                }}
                                className="rounded-full border border-[#14532d] bg-[#14532d] hover:bg-[#0f3f22] px-3.5 py-1 text-xs font-bold text-[#fdf6e7] transition-colors cursor-pointer"
                              >
                                {state.lastSubmissionMeta
                                  ? "Kirim Revisi ke Guru ->"
                                  : "Kumpulkan ke Guru ->"}
                              </button>
                              <button
                                type="button"
                                onClick={handlePrintManuscriptAndCharter}
                                className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 px-3 py-1 text-xs font-bold text-[#3d250b] transition-colors cursor-pointer"
                              >
                                Cetak Piagam -&gt;
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Nomor Halaman Kanan & Navigasi Sudut Kanan Bawah di Dalam Margin Kertas */}
                    <div className="mt-1 flex shrink-0 items-center justify-between gap-2 border-t border-[#5c3d1e]/30 pt-1 text-[10px] font-bold text-[#4e3210]">
                      <span>
                        {activeViewTab === "dual_book"
                          ? `Halaman ${safeCurrentSpread * 2 + 2}`
                          : activeViewTab === "audit_revisi"
                            ? "Lembar Pemeriksa · Kanan"
                            : "Lembar Galeri · Kanan"}
                      </span>

                      {activeViewTab === "dual_book" ? (
                        safeCurrentSpread < totalSpreads - 1 ? (
                          <button
                            type="button"
                            disabled={flipDirection !== null}
                            onClick={() => triggerSpreadTransition(safeCurrentSpread + 1)}
                            className="rounded border border-[#5c3d1e]/50 px-2 py-0.5 text-[10px] font-bold text-[#2b1706] hover:bg-[#5c3d1e]/15 disabled:opacity-35 cursor-pointer disabled:pointer-events-none transition-colors"
                          >
                            Lembar Berikutnya -&gt;
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAddExtraSpread}
                            className="rounded border border-[#14532d]/55 px-2 py-0.5 text-[10px] font-bold text-[#14532d] hover:bg-[#14532d]/15 cursor-pointer transition-colors"
                          >
                            + Tambah Lembar -&gt;
                          </button>
                        )
                      ) : activeViewTab === "audit_revisi" ? (
                        <button
                          type="button"
                          disabled={flipDirection !== null}
                          onClick={() => triggerTabFlip("galeri_piagam")}
                          className="rounded border border-[#5c3d1e]/50 px-2 py-0.5 text-[10px] font-bold text-[#2b1706] hover:bg-[#5c3d1e]/15 cursor-pointer transition-colors"
                        >
                          Buka Galeri &amp; Piagam -&gt;
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={flipDirection !== null}
                          onClick={() => triggerTabFlip("audit_revisi")}
                          className="rounded border border-[#5c3d1e]/50 px-2 py-0.5 text-[10px] font-bold text-[#2b1706] hover:bg-[#5c3d1e]/15 cursor-pointer transition-colors"
                        >
                          Buka Pemeriksa Ejaan -&gt;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 4 & 5: Desktop Book Spine Shadow & 3D Hinge Page-Flipper */}
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
                      flipDirection === "next" ? "71.03% 53.33%" : "28.44% 53.33%",
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

          {/* Mobile Thumb-Zone Page Switcher Bar (Halaman Kiri <-> Halaman Kanan) */}
          {isMobileBook && !isCalibrating && (
            <div className="relative z-30 grid w-full max-w-[480px] shrink-0 grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  playPageFlip();
                  setMobilePageSide("left");
                }}
                className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-bold shadow-[0_8px_22px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all cursor-pointer truncate ${mobilePageSide === "left"
                  ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                  : "border-[#d6b26f]/55 bg-slate-950/92 text-amber-100"
                  }`}
              >
                {mobileSideLabels[0]}
              </button>
              <button
                type="button"
                onClick={() => {
                  playPageFlip();
                  setMobilePageSide("right");
                }}
                className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-bold shadow-[0_8px_22px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all cursor-pointer truncate ${mobilePageSide === "right"
                  ? "border-[#f3d89b] bg-[#f3d89b] text-slate-950"
                  : "border-emerald-400/60 bg-emerald-950/92 text-emerald-100"
                  }`}
              >
                {mobileSideLabels[1]}
              </button>
            </div>
          )}

          {/* Guided 3-Step Interactive Walkthrough Card for Studio Tulis (Grade 7 Friendly) */}
          {studioTourStep !== null && !isCalibrating && !isGuideDrawerOpen && (
            <div className="pointer-events-auto fixed inset-x-3 bottom-16 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px] z-50 rounded-2xl border-2 border-[#f4d993] bg-slate-950/96 p-3.5 text-stone-100 shadow-[0_18px_45px_rgba(0,0,0,0.95)] backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#cda250]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f4d993]">
                  Panduan Studio Tulis
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    setStudioTourStep(null);
                    try {
                      window.localStorage.setItem(STUDIO_TOUR_STORAGE_KEY, "1");
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[11px] font-semibold text-stone-400 hover:text-white cursor-pointer"
                >
                  Lewati [X]
                </button>
              </div>
              <h3 className="font-serif text-sm font-bold text-white">
                {STUDIO_TOUR_STEPS[studioTourStep]?.title}
              </h3>
              <p className="text-xs text-stone-200 leading-relaxed">
                {STUDIO_TOUR_STEPS[studioTourStep]?.body}
              </p>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  {STUDIO_TOUR_STEPS.map((st, idx) => (
                    <span
                      key={st.title}
                      className={`h-1.5 rounded-full transition-all ${idx === studioTourStep
                        ? "w-5 bg-[#f4d993]"
                        : "w-1.5 bg-white/25"
                        }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    if (studioTourStep >= STUDIO_TOUR_STEPS.length - 1) {
                      setStudioTourStep(null);
                      try {
                        window.localStorage.setItem(STUDIO_TOUR_STORAGE_KEY, "1");
                      } catch {
                        // ignore
                      }
                    } else {
                      setStudioTourStep(studioTourStep + 1);
                    }
                  }}
                  className="rounded-full bg-[#f4d993] px-3.5 py-1 text-[11px] font-bold text-[#030712] hover:bg-white transition-colors cursor-pointer"
                >
                  {studioTourStep === STUDIO_TOUR_STEPS.length - 1
                    ? "Siap Mengarang!"
                    : "Lanjut ->"}
                </button>
              </div>
            </div>
          )}

          {isCalibrating && (
            <BookHomographyCalibrator
              stageWidth={studio2dLayout.width}
              stageHeight={studio2dLayout.height}
              stageOffsetX={studio2dLayout.offsetX}
              stageOffsetY={studio2dLayout.offsetY}
              stageScale={studio2dScale}
              calibration={studio2dCalibration}
              leftMatrixCss={studio2dProj.leftMatrixCss}
              rightMatrixCss={studio2dProj.rightMatrixCss}
              onChangeCalibration={setStudio2dCalibration}
              onResetCalibration={() =>
                setStudio2dCalibration(READING_2D_DEFAULT_CALIBRATION)
              }
              onClose={() => setIsCalibrating(false)}
            />
          )}
        </div>
      )}

      <SubmitToTeacherModal
        isOpen={isSubmitTeacherModalOpen}
        onClose={() => setIsSubmitTeacherModalOpen(false)}
        state={state}
        metrics={metrics}
        analysis={analysis}
        onSubmitted={(msg) => showTempBanner(msg)}
      />
    </div>
  );
}
