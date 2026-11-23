/**
 * Pure, server-safe competency & seal scoring engine for E-Aksaraloka.
 *
 * Intentionally free of `"use client"`, DOM, and `window` references so both
 * the client learning store (`learningStore.ts`) and server-side API route
 * handlers (`POST /api/submissions`) compute identical, tamper-resistant scores.
 */

import {
  type GrimoireChapterId,
  BOLA_WAKTU_PLOT_BEATS,
  BOLA_WAKTU_AMANAT_OPTIONS,
  CHARACTER_EVIDENCE_CHALLENGES,
  EMAS_POUCH_STEPS,
  SENSORY_UPGRADE_CHALLENGES,
  MAJAS_ASOSIASI_CHALLENGES,
  DIALOGUE_TRANSMUTATION_CHALLENGES,
  ASTROLABE_SIDE_QUESTS,
} from "./narrativeCurriculumData";
import {
  INITIAL_STUDIO_DRAFT,
  analyzeStudentManuscript,
  type SavedManuscriptItem,
  type StudioDraftData,
} from "./literaryDetector";

export interface MajasAnswerPair {
  readonly connector: string;
  readonly comparison: string;
}

export type SheetSyncStatus = "pending" | "synced" | "failed" | "not_configured";

export interface LastSubmissionMeta {
  readonly submissionId: string;
  readonly version: number;
  readonly submittedAtIso: string;
  readonly classCode: string;
  readonly sheetSyncStatus: SheetSyncStatus;
  readonly storedInDatabase: boolean;
}

export interface AksaralokaLearningState {
  readonly activeGrimoireChapter: GrimoireChapterId;
  readonly hasOpenedGrimoireIntro: boolean;
  // Babak I: Segel Kompas Waktu (Alur & Amanat)
  readonly plotPlacedIds: readonly string[];
  readonly climaxSimulationTested: boolean;
  readonly selectedAmanatId: string | null;
  readonly customAmanatReflection: string;
  readonly sealAlurUnlocked: boolean;
  // Babak II: Segel Cermin Watak & Lensa Lima Indra
  readonly characterEvidenceAnswers: Readonly<Record<string, string>>;
  readonly pouchOrderIds: readonly string[];
  readonly sensoryUpgradeAnswers: Readonly<Record<string, string>>;
  readonly sealWatakUnlocked: boolean;
  // Babak III: Segel Alkimia Bahasa (Majas Asosiasi & Dialog EYD V)
  readonly majasAnswers: Readonly<Record<string, MajasAnswerPair>>;
  readonly dialogueAnswers: Readonly<Record<string, string>>;
  readonly sealBahasaUnlocked: boolean;
  // Side-Quests di Astrolab Peta Pembelajaran
  readonly questAnswers: Readonly<Record<string, string>>;
  // Babak IV: Meja Studio Tulis Mandiri & Galeri Pustaka (Tahap 2)
  readonly studioDraft: StudioDraftData;
  readonly savedManuscripts: readonly SavedManuscriptItem[];
  readonly sealStudioUnlocked: boolean;
  // Metadata pengumpulan resmi terakhir ke server/guru (opsional, backward-compatible)
  readonly lastSubmissionMeta?: LastSubmissionMeta | null;
}

export interface CompetencyMetrics {
  readonly babak1Score: number;
  readonly babak2Score: number;
  readonly babak3Score: number;
  readonly babak4Score: number;
  readonly questScore: number;
  readonly overallPercentage: number;
  readonly holisticTotalPercentage: number;
  readonly unlockedSealsCount: number;
  readonly kelayakanCategory: string;
  readonly materiKelayakanCategory: string;
  readonly masteryRankTitle: string;
}

export const INITIAL_LEARNING_STATE: AksaralokaLearningState = {
  activeGrimoireChapter: "alur",
  hasOpenedGrimoireIntro: false,
  plotPlacedIds: [],
  climaxSimulationTested: false,
  selectedAmanatId: null,
  customAmanatReflection: "",
  sealAlurUnlocked: false,
  characterEvidenceAnswers: {},
  pouchOrderIds: [],
  sensoryUpgradeAnswers: {},
  sealWatakUnlocked: false,
  majasAnswers: {},
  dialogueAnswers: {},
  sealBahasaUnlocked: false,
  questAnswers: {},
  studioDraft: INITIAL_STUDIO_DRAFT,
  savedManuscripts: [],
  sealStudioUnlocked: false,
  lastSubmissionMeta: null,
};

/** Gelar penguasaan bermakna berbasis pencapaian nyata (bukan poin kosong). */
export function getMasteryRankTitle(
  unlockedSealsCount: number,
  sealStudioUnlocked: boolean
): string {
  if (unlockedSealsCount >= 3 && sealStudioUnlocked) {
    return "Penulis Muda Aksaraloka";
  }
  if (unlockedSealsCount >= 3) {
    return "Penjaga Pustaka (Siap Mengarang!)";
  }
  if (unlockedSealsCount >= 1 || sealStudioUnlocked) {
    return "Penjelajah Aksara";
  }
  return "Pengembara Baru";
}

/**
 * Skala 5 tingkat penguasaan / kelayakan selaras dengan Pedoman PjBL hlm. 9:
 * 81–100%, 61–80%, 41–60%, 21–40%, dan 0–20%.
 */
export function getPjblMasteryCategory(percentage: number): string {
  if (percentage >= 81) return "Sangat Mahir / Sangat Layak (81–100%)";
  if (percentage >= 61) return "Cakap / Layak (61–80%)";
  if (percentage >= 41) return "Cukup Berkembang (41–60%)";
  if (percentage >= 21) return "Perlu Bimbingan (21–40%)";
  return "Tahap Eksplorasi Awal (0–20%)";
}

export function isPlotOrderCorrect(placedIds: readonly string[]): boolean {
  if (placedIds.length !== BOLA_WAKTU_PLOT_BEATS.length) return false;
  return BOLA_WAKTU_PLOT_BEATS.every((beat, idx) => placedIds[idx] === beat.id);
}

export function isAmanatCorrect(selectedId: string | null): boolean {
  if (!selectedId) return false;
  const found = BOLA_WAKTU_AMANAT_OPTIONS.find((o) => o.id === selectedId);
  return Boolean(found?.isCorrect);
}

export function isCharacterEvidenceComplete(
  answers: Readonly<Record<string, string>>
): boolean {
  return CHARACTER_EVIDENCE_CHALLENGES.every((challenge) => {
    const chosenId = answers[challenge.id];
    const opt = challenge.options.find((o) => o.id === chosenId);
    return Boolean(opt?.isValidEvidence);
  });
}

export function isPouchOrderComplete(pouchIds: readonly string[]): boolean {
  if (pouchIds.length !== EMAS_POUCH_STEPS.length) return false;
  return EMAS_POUCH_STEPS.every((step, idx) => pouchIds[idx] === step.pouchId);
}

export function isSensoryComplete(
  answers: Readonly<Record<string, string>>
): boolean {
  return SENSORY_UPGRADE_CHALLENGES.every((challenge) => {
    const chosenId = answers[challenge.id];
    const opt = challenge.options.find((o) => o.id === chosenId);
    return Boolean(opt?.isRichSensory);
  });
}

export function isMajasComplete(
  answers: Readonly<Record<string, MajasAnswerPair>>
): boolean {
  return MAJAS_ASOSIASI_CHALLENGES.every((item) => {
    const pair = answers[item.id];
    return (
      pair !== undefined &&
      pair.connector === item.correctConnector &&
      pair.comparison === item.correctComparison
    );
  });
}

export function isDialogueComplete(
  answers: Readonly<Record<string, string>>
): boolean {
  return DIALOGUE_TRANSMUTATION_CHALLENGES.every((item) => {
    const chosenId = answers[item.id];
    const opt = item.options.find((o) => o.id === chosenId);
    return Boolean(opt?.isCorrect);
  });
}

export function recomputeSeals(
  state: AksaralokaLearningState
): AksaralokaLearningState {
  const sealAlurUnlocked =
    isPlotOrderCorrect(state.plotPlacedIds) &&
    state.climaxSimulationTested &&
    isAmanatCorrect(state.selectedAmanatId);

  const sealWatakUnlocked =
    isCharacterEvidenceComplete(state.characterEvidenceAnswers) &&
    isPouchOrderComplete(state.pouchOrderIds) &&
    isSensoryComplete(state.sensoryUpgradeAnswers);

  const sealBahasaUnlocked =
    isMajasComplete(state.majasAnswers) &&
    isDialogueComplete(state.dialogueAnswers);

  const studioAnalysis = analyzeStudentManuscript(
    state.studioDraft ?? INITIAL_STUDIO_DRAFT
  );
  const hasQualifyingSavedManuscript =
    Array.isArray(state.savedManuscripts) &&
    state.savedManuscripts.some(
      (item) => analyzeStudentManuscript(item.draft).isReadyForSeal
    );
  const sealStudioUnlocked =
    studioAnalysis.isReadyForSeal || hasQualifyingSavedManuscript;

  return {
    ...state,
    sealAlurUnlocked,
    sealWatakUnlocked,
    sealBahasaUnlocked,
    sealStudioUnlocked,
  };
}

export function computeCompetencyMetrics(
  state: AksaralokaLearningState
): CompetencyMetrics {
  // Babak I Score (50% plot order, 20% climax simulation, 30% amanat)
  let correctPlotCount = 0;
  BOLA_WAKTU_PLOT_BEATS.forEach((beat, idx) => {
    if (state.plotPlacedIds[idx] === beat.id) correctPlotCount++;
  });
  const plotScore = (correctPlotCount / BOLA_WAKTU_PLOT_BEATS.length) * 50;
  const simScore = state.climaxSimulationTested ? 20 : 0;
  const amanatScore = isAmanatCorrect(state.selectedAmanatId) ? 30 : 0;
  const babak1Score = Math.round(plotScore + simScore + amanatScore);

  // Babak II Score (35% character evidence, 30% pouch escalation, 35% sensory 5 Indra)
  let correctCharCount = 0;
  CHARACTER_EVIDENCE_CHALLENGES.forEach((ch) => {
    const chosen = ch.options.find(
      (o) => o.id === state.characterEvidenceAnswers[ch.id]
    );
    if (chosen?.isValidEvidence) correctCharCount++;
  });
  let correctPouchCount = 0;
  EMAS_POUCH_STEPS.forEach((st, idx) => {
    if (state.pouchOrderIds[idx] === st.pouchId) correctPouchCount++;
  });
  let correctSensoryCount = 0;
  SENSORY_UPGRADE_CHALLENGES.forEach((ch) => {
    const chosen = ch.options.find(
      (o) => o.id === state.sensoryUpgradeAnswers[ch.id]
    );
    if (chosen?.isRichSensory) correctSensoryCount++;
  });
  const babak2Score = Math.round(
    (correctCharCount / CHARACTER_EVIDENCE_CHALLENGES.length) * 35 +
      (correctPouchCount / EMAS_POUCH_STEPS.length) * 30 +
      (correctSensoryCount / SENSORY_UPGRADE_CHALLENGES.length) * 35
  );

  // Babak III Score (50% majas asosiasi, 50% kalimat langsung/tak langsung)
  let correctMajasCount = 0;
  MAJAS_ASOSIASI_CHALLENGES.forEach((item) => {
    const pair = state.majasAnswers[item.id];
    if (
      pair &&
      pair.connector === item.correctConnector &&
      pair.comparison === item.correctComparison
    ) {
      correctMajasCount++;
    }
  });
  let correctDialogueCount = 0;
  DIALOGUE_TRANSMUTATION_CHALLENGES.forEach((item) => {
    const chosen = item.options.find(
      (o) => o.id === state.dialogueAnswers[item.id]
    );
    if (chosen?.isCorrect) correctDialogueCount++;
  });
  const babak3Score = Math.round(
    (correctMajasCount / MAJAS_ASOSIASI_CHALLENGES.length) * 50 +
      (correctDialogueCount / DIALOGUE_TRANSMUTATION_CHALLENGES.length) * 50
  );

  // Quest Score
  let correctQuestCount = 0;
  ASTROLABE_SIDE_QUESTS.forEach((q) => {
    const chosen = q.options.find((o) => o.id === state.questAnswers[q.id]);
    if (chosen?.isCorrect) correctQuestCount++;
  });
  const questScore = Math.round(
    (correctQuestCount / ASTROLABE_SIDE_QUESTS.length) * 100
  );

  // Babak IV Score (Live Literary Detector di Studio Tulis)
  const studioAnalysis = analyzeStudentManuscript(
    state.studioDraft ?? INITIAL_STUDIO_DRAFT
  );
  const babak4Score = studioAnalysis.studioScore;

  const overallPercentage = Math.round(
    babak1Score * 0.3 +
      babak2Score * 0.3 +
      babak3Score * 0.3 +
      questScore * 0.1
  );

  const holisticTotalPercentage = Math.round(
    overallPercentage * 0.6 + babak4Score * 0.4
  );

  const unlockedSealsCount =
    (state.sealAlurUnlocked ? 1 : 0) +
    (state.sealWatakUnlocked ? 1 : 0) +
    (state.sealBahasaUnlocked ? 1 : 0);

  const kelayakanCategory = getPjblMasteryCategory(holisticTotalPercentage);
  const materiKelayakanCategory = getPjblMasteryCategory(overallPercentage);
  const masteryRankTitle = getMasteryRankTitle(
    unlockedSealsCount,
    state.sealStudioUnlocked
  );

  return {
    babak1Score,
    babak2Score,
    babak3Score,
    babak4Score,
    questScore,
    overallPercentage,
    holisticTotalPercentage,
    unlockedSealsCount,
    kelayakanCategory,
    materiKelayakanCategory,
    masteryRankTitle,
  };
}

/**
 * Menggabungkan seluruh paragraf cerita (Orientasi, Komplikasi, Klimaks,
 * Resolusi, serta lembar tambahan bila ada) menjadi naskah utuh siap baca.
 */
export function composeFullStoryText(draft: StudioDraftData): string {
  const sections: string[] = [];
  const pushIfNonEmpty = (text: string | undefined) => {
    const trimmed = text?.trim();
    if (trimmed) sections.push(trimmed);
  };

  pushIfNonEmpty(draft.paragraphOrientasi);
  pushIfNonEmpty(draft.paragraphKomplikasi);
  pushIfNonEmpty(draft.paragraphKlimaks);
  pushIfNonEmpty(draft.paragraphResolusi);

  if (Array.isArray(draft.extraSpreads)) {
    for (const spread of draft.extraSpreads) {
      pushIfNonEmpty(spread.leftText);
      pushIfNonEmpty(spread.rightText);
    }
  }

  return sections.join("\n\n");
}
