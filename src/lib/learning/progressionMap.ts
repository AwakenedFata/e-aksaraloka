import type { GrimoireChapterId } from "./narrativeCurriculumData";
import {
  ASTROLABE_SIDE_QUESTS,
  BOLA_WAKTU_PLOT_BEATS,
  EMAS_POUCH_STEPS,
} from "./narrativeCurriculumData";
import {
  type AksaralokaLearningState,
  type CompetencyMetrics,
  isAmanatCorrect,
  isCharacterEvidenceComplete,
  isDialogueComplete,
  isMajasComplete,
  isPlotOrderCorrect,
  isPouchOrderComplete,
  isSensoryComplete,
} from "./learningStore";
import { INITIAL_STUDIO_DRAFT, analyzeStudentManuscript } from "./literaryDetector";

export type ProgressionNodeId =
  | "babak-1"
  | "babak-2"
  | "babak-3"
  | "babak-4"
  | "quest-hub";

export type ProgressionNodeStatus = "completed" | "in_progress" | "ready";

export type ProgressionNodeDestination =
  | { readonly kind: "chapter"; readonly chapter: GrimoireChapterId }
  | { readonly kind: "studio" }
  | { readonly kind: "quest" };

export interface ProgressionSubTask {
  readonly label: string;
  readonly done: boolean;
}

export interface ProgressionMapNode {
  readonly id: ProgressionNodeId;
  readonly orderLabel: string;
  readonly title: string;
  readonly landmarkLabel: string;
  readonly shortBadge: string;
  readonly xPct: number;
  readonly yPct: number;
  readonly score: number;
  readonly status: ProgressionNodeStatus;
  readonly isRecommendedNext: boolean;
  readonly coachMarkText: string;
  readonly questPrompt: string;
  readonly tpCodes: readonly string[];
  readonly summary: string;
  readonly ctaLabel: string;
  readonly destination: ProgressionNodeDestination;
  readonly subTasks: readonly ProgressionSubTask[];
}

export interface ProgressionRouteSegment {
  readonly id: string;
  readonly fromId: ProgressionNodeId;
  readonly toId: ProgressionNodeId;
  readonly pathD: string;
  readonly isPrimaryArc: boolean;
  readonly isCompleted: boolean;
  readonly isActiveNext: boolean;
}

export const MAP_CANVAS_WIDTH = 1376;
export const MAP_CANVAS_HEIGHT = 768;

/**
 * Builds the 7th-grade-friendly Overworld Progression Map model with Coach Marks,
 * Quest Prompts, and Gamified CTAs. All nodes remain unlocked at all times.
 */
export function buildProgressionMapModel(
  state: AksaralokaLearningState,
  metrics: CompetencyMetrics
): {
  readonly nodes: readonly ProgressionMapNode[];
  readonly segments: readonly ProgressionRouteSegment[];
  readonly recommendedNodeId: ProgressionNodeId;
} {
  const studioDraft = state.studioDraft ?? INITIAL_STUDIO_DRAFT;
  const studioAnalysis = analyzeStudentManuscript(studioDraft);

  const solvedQuestsCount = ASTROLABE_SIDE_QUESTS.filter((quest) => {
    const picked = state.questAnswers[quest.id];
    return Boolean(quest.options.find((opt) => opt.id === picked)?.isCorrect);
  }).length;

  const recommendedNodeId: ProgressionNodeId = !state.sealAlurUnlocked
    ? "babak-1"
    : !state.sealWatakUnlocked
      ? "babak-2"
      : !state.sealBahasaUnlocked
        ? "babak-3"
        : !state.sealStudioUnlocked
          ? "babak-4"
          : solvedQuestsCount < ASTROLABE_SIDE_QUESTS.length
            ? "quest-hub"
            : "babak-4";

  const statusFor = (
    sealUnlocked: boolean,
    score: number
  ): ProgressionNodeStatus => {
    if (sealUnlocked) return "completed";
    if (score > 0) return "in_progress";
    return "ready";
  };

  const plotDone = isPlotOrderCorrect(state.plotPlacedIds);
  const amanatDone = isAmanatCorrect(state.selectedAmanatId);
  const charDone = isCharacterEvidenceComplete(state.characterEvidenceAnswers);
  const pouchDone = isPouchOrderComplete(state.pouchOrderIds);
  const sensoryDone = isSensoryComplete(state.sensoryUpgradeAnswers);
  const majasDone = isMajasComplete(state.majasAnswers);
  const dialogueDone = isDialogueComplete(state.dialogueAnswers);
  const hasDraftPlan =
    Boolean(studioDraft.storyTitle.trim()) && Boolean(studioDraft.worldRule.trim());

  const nodes: readonly ProgressionMapNode[] = [
    {
      id: "babak-1",
      orderLabel: "Misi 1",
      title: "Rahasia Alur",
      landmarkLabel: "Pustaka Barat Laut",
      shortBadge: "1",
      xPct: 24.5,
      yPct: 35.0,
      score: metrics.babak1Score,
      status: statusFor(state.sealAlurUnlocked, metrics.babak1Score),
      isRecommendedNext: recommendedNodeId === "babak-1",
      coachMarkText:
        metrics.babak1Score === 0
          ? "Mulai dari sini! Klik Misi 1"
          : "Yuk selesaikan Segel 1!",
      questPrompt:
        "Bantu Ivan menyusun urutan kisah Bola-Bola Waktu dari awal sampai akhir, lalu temukan pesan kebaikannya!",
      tpCodes: ["TP 1", "TP 2"],
      summary:
        "Urutkan 5 kejadian Gunung Alur, coba simulasi cerita tanpa puncak masalah, dan pilih amanat yang tepat.",
      ctaLabel: state.sealAlurUnlocked
        ? "Mainkan Lagi Misi 1 ->"
        : metrics.babak1Score > 0
          ? "Lanjutkan Misi 1 ->"
          : "Mulai Misi 1 Sekarang! ->",
      destination: { kind: "chapter", chapter: "alur" },
      subTasks: [
        {
          label: `Urutkan 5 Kejadian (${state.plotPlacedIds.length}/${BOLA_WAKTU_PLOT_BEATS.length})`,
          done: plotDone,
        },
        {
          label: "Coba Hapus Puncak Masalah",
          done: state.climaxSimulationTested,
        },
        {
          label: "Tebak Pesan Cerita",
          done: amanatDone,
        },
      ],
    },
    {
      id: "babak-2",
      orderLabel: "Misi 2",
      title: "Tokoh & Indra",
      landmarkLabel: "Menara Kristal Selatan",
      shortBadge: "2",
      xPct: 35.3,
      yPct: 56.8,
      score: metrics.babak2Score,
      status: statusFor(state.sealWatakUnlocked, metrics.babak2Score),
      isRecommendedNext: recommendedNodeId === "babak-2",
      coachMarkText: "Segel 1 beres! Lanjut ke Misi 2",
      questPrompt:
        "Buktikan sifat Mao & Yari lewat aksinya, urutkan empat kantong ajaib Emas saat dikejar Raksasa, dan hidupkan pancaindra!",
      tpCodes: ["TP 1", "TP 3"],
      summary:
        "Kenali sifat tokoh dari perbuatannya, urutkan empat kantong ajaib, dan pilih kalimat yang membuat pembaca ikut merasakan suasana.",
      ctaLabel: state.sealWatakUnlocked
        ? "Mainkan Lagi Misi 2 ->"
        : metrics.babak2Score > 0
          ? "Lanjutkan Misi 2 ->"
          : "Mulai Misi 2 Sekarang! ->",
      destination: { kind: "chapter", chapter: "watak" },
      subTasks: [
        {
          label: "Tebak Bukti Sifat Mao & Yari",
          done: charDone,
        },
        {
          label: `Urutkan Empat Kantong Emas (${state.pouchOrderIds.length}/${EMAS_POUCH_STEPS.length})`,
          done: pouchDone,
        },
        {
          label: "Kalimat Pancaindra",
          done: sensoryDone,
        },
      ],
    },
    {
      id: "quest-hub",
      orderLabel: "Misi Bonus",
      title: "Kuis 3 Tantangan",
      landmarkLabel: "Astrolab Pusat",
      shortBadge: "★",
      xPct: 51.5,
      yPct: 49.5,
      score: metrics.questScore,
      status: statusFor(
        solvedQuestsCount === ASTROLABE_SIDE_QUESTS.length,
        metrics.questScore
      ),
      isRecommendedNext: recommendedNodeId === "quest-hub",
      coachMarkText:
        recommendedNodeId === "quest-hub"
          ? "Tuntaskan 3 Kuis Bonus untuk 100%!"
          : "Kuis Bonus Seru!",
      questPrompt:
        "Mau tambah poin? Pecahkan 3 teka-teki singkat tentang ide cerita keren, logika keajaiban, dan ejaan dialog!",
      tpCodes: ["TP 2", "TP 5"],
      summary:
        "3 kuis kilat untuk melatih ide cerita yang tidak membosankan dan cara menulis tanda petik dialog yang benar.",
      ctaLabel: "Mainkan 3 Kuis Bonus ->",
      destination: { kind: "quest" },
      subTasks: [
        {
          label: "Kuis 1: Cari Ide Seru",
          done: Boolean(
            ASTROLABE_SIDE_QUESTS[0]?.options.find(
              (opt) => opt.id === state.questAnswers["quest-ide"]
            )?.isCorrect
          ),
        },
        {
          label: "Kuis 2: Logika Keajaiban",
          done: Boolean(
            ASTROLABE_SIDE_QUESTS[1]?.options.find(
              (opt) => opt.id === state.questAnswers["quest-logika"]
            )?.isCorrect
          ),
        },
        {
          label: "Kuis 3: Tanda Baca Dialog",
          done: Boolean(
            ASTROLABE_SIDE_QUESTS[2]?.options.find(
              (opt) => opt.id === state.questAnswers["quest-eyd"]
            )?.isCorrect
          ),
        },
      ],
    },
    {
      id: "babak-3",
      orderLabel: "Misi 3",
      title: "Gaya Bahasa",
      landmarkLabel: "Roda Kompas Utara",
      shortBadge: "3",
      xPct: 67.2,
      yPct: 27.0,
      score: metrics.babak3Score,
      status: statusFor(state.sealBahasaUnlocked, metrics.babak3Score),
      isRecommendedNext: recommendedNodeId === "babak-3",
      coachMarkText: "Tinggal 1 segel lagi! Klik Misi 3",
      questPrompt:
        "Racik kalimat perumpamaan (seperti/bagaikan) dan ubah obrolan tokoh menjadi kalimat cerita yang rapi!",
      tpCodes: ["TP 4"],
      summary:
        "Pasangkan kata perumpamaan (majas asosiasi), intip Kamus Kata Fantasi, dan ubah kalimat langsung jadi tak langsung.",
      ctaLabel: state.sealBahasaUnlocked
        ? "Mainkan Lagi Misi 3 ->"
        : metrics.babak3Score > 0
          ? "Lanjutkan Misi 3 ->"
          : "Mulai Misi 3 Sekarang! ->",
      destination: { kind: "chapter", chapter: "bahasa" },
      subTasks: [
        {
          label: "Pasangkan Perumpamaan",
          done: majasDone,
        },
        {
          label: "Ubah Kalimat Dialog",
          done: dialogueDone,
        },
      ],
    },
    {
      id: "babak-4",
      orderLabel: "Misi Puncak",
      title: "Studio Tulis",
      landmarkLabel: "Kastel Menara Timur",
      shortBadge: "4",
      xPct: 84.5,
      yPct: 43.8,
      score: metrics.babak4Score,
      status: statusFor(state.sealStudioUnlocked, metrics.babak4Score),
      isRecommendedNext: recommendedNodeId === "babak-4",
      coachMarkText: "Saatnya mengarang ceritamu di sini!",
      questPrompt:
        "Jadilah penulis cerita fantasi! Isi rencana ceritamu, tulis kisahnya langkah demi langkah, lalu cetak Piagam Penulis Muda!",
      tpCodes: ["TP 2", "TP 3", "TP 4", "TP 5"],
      summary:
        "Meja kerja penulis lengkap dengan contoh ide, bantuan menyusun paragraf, pemeriksa ejaan otomatis, dan cetak piagam.",
      ctaLabel: state.sealStudioUnlocked
        ? "Buka Karya & Piagamku ->"
        : studioAnalysis.totalWords > 0
          ? "Lanjutkan Menulis Ceritaku ->"
          : "Mulai Menulis Ceritamu! ->",
      destination: { kind: "studio" },
      subTasks: [
        {
          label: "Isi Judul & Aturan Keajaiban",
          done: hasDraftPlan,
        },
        {
          label: `5 Target Tulisan (${studioAnalysis.passedIndicatorsCount}/5)`,
          done: studioAnalysis.isReadyForSeal,
        },
        {
          label: `Simpan Karya Siap Segel (${state.savedManuscripts.length})`,
          done: state.savedManuscripts.some(
            (m) => analyzeStudentManuscript(m.draft).isReadyForSeal
          ),
        },
      ],
    },
  ];

  const segments: readonly ProgressionRouteSegment[] = [
    {
      id: "seg-1-2",
      fromId: "babak-1",
      toId: "babak-2",
      pathD: "M 337 269 C 350 368, 412 414, 486 436",
      isPrimaryArc: true,
      isCompleted: state.sealAlurUnlocked,
      isActiveNext: recommendedNodeId === "babak-2",
    },
    {
      id: "seg-2-3",
      fromId: "babak-2",
      toId: "babak-3",
      pathD: "M 486 436 C 562 326, 742 232, 925 207",
      isPrimaryArc: true,
      isCompleted: state.sealWatakUnlocked,
      isActiveNext: recommendedNodeId === "babak-3",
    },
    {
      id: "seg-3-4",
      fromId: "babak-3",
      toId: "babak-4",
      pathD: "M 925 207 C 1032 216, 1112 268, 1163 336",
      isPrimaryArc: true,
      isCompleted: state.sealBahasaUnlocked,
      isActiveNext: recommendedNodeId === "babak-4",
    },
    {
      id: "seg-2-quest",
      fromId: "babak-2",
      toId: "quest-hub",
      pathD: "M 486 436 C 578 442, 645 415, 709 380",
      isPrimaryArc: false,
      isCompleted: solvedQuestsCount === ASTROLABE_SIDE_QUESTS.length,
      isActiveNext: false,
    },
    {
      id: "seg-quest-3",
      fromId: "quest-hub",
      toId: "babak-3",
      pathD: "M 709 380 C 785 335, 860 278, 925 207",
      isPrimaryArc: false,
      isCompleted: solvedQuestsCount === ASTROLABE_SIDE_QUESTS.length,
      isActiveNext: false,
    },
  ];

  return { nodes, segments, recommendedNodeId };
}

export function getMapNodeIdForTpDestination(
  destination: GrimoireChapterId | "studio"
): ProgressionNodeId {
  switch (destination) {
    case "alur":
      return "babak-1";
    case "watak":
      return "babak-2";
    case "bahasa":
      return "babak-3";
    case "studio":
      return "babak-4";
  }
}
