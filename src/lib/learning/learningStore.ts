"use client";

import { useSyncExternalStore } from "react";
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
  STORY_SEED_PRESETS,
  analyzeStudentManuscript,
  type SavedManuscriptItem,
  type StudioDraftData,
} from "./literaryDetector";

export interface MajasAnswerPair {
  readonly connector: string;
  readonly comparison: string;
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
  // Babak II: Segel Cermin Watak & Lensa Lima Indera
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
}

const STORAGE_KEY = "aksaraloka:learning-state:v1";

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
};

let currentState: AksaralokaLearningState = INITIAL_LEARNING_STATE;
let hasHydratedFromStorage = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function hydrateFromStorageOnce(): void {
  if (hasHydratedFromStorage || typeof window === "undefined") return;
  hasHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AksaralokaLearningState>;
    if (parsed && typeof parsed === "object") {
      const mergedDraft: StudioDraftData = parsed.studioDraft
        ? {
            ...INITIAL_STUDIO_DRAFT,
            ...parsed.studioDraft,
            selfRevisionChecks: {
              ...INITIAL_STUDIO_DRAFT.selfRevisionChecks,
              ...(parsed.studioDraft.selfRevisionChecks ?? {}),
            },
          }
        : INITIAL_STUDIO_DRAFT;

      currentState = recomputeSeals({
        ...INITIAL_LEARNING_STATE,
        ...parsed,
        studioDraft: mergedDraft,
        savedManuscripts: Array.isArray(parsed.savedManuscripts)
          ? parsed.savedManuscripts
          : [],
      });
    }
  } catch (err) {
    void err;
  }
}

function persistToStorage(state: AksaralokaLearningState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    void err;
  }
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

export function isCharacterEvidenceComplete(answers: Readonly<Record<string, string>>): boolean {
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

export function isSensoryComplete(answers: Readonly<Record<string, string>>): boolean {
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

export function isDialogueComplete(answers: Readonly<Record<string, string>>): boolean {
  return DIALOGUE_TRANSMUTATION_CHALLENGES.every((item) => {
    const chosenId = answers[item.id];
    const opt = item.options.find((o) => o.id === chosenId);
    return Boolean(opt?.isCorrect);
  });
}

export function recomputeSeals(state: AksaralokaLearningState): AksaralokaLearningState {
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
  const sealStudioUnlocked =
    studioAnalysis.isReadyForSeal ||
    (Array.isArray(state.savedManuscripts) && state.savedManuscripts.length > 0);

  return {
    ...state,
    sealAlurUnlocked,
    sealWatakUnlocked,
    sealBahasaUnlocked,
    sealStudioUnlocked,
  };
}

export function computeCompetencyMetrics(state: AksaralokaLearningState): CompetencyMetrics {
  // Babak I Score (50% plot order, 20% climax simulation, 30% amanat)
  let correctPlotCount = 0;
  BOLA_WAKTU_PLOT_BEATS.forEach((beat, idx) => {
    if (state.plotPlacedIds[idx] === beat.id) correctPlotCount++;
  });
  const plotScore = (correctPlotCount / BOLA_WAKTU_PLOT_BEATS.length) * 50;
  const simScore = state.climaxSimulationTested ? 20 : 0;
  const amanatScore = isAmanatCorrect(state.selectedAmanatId) ? 30 : 0;
  const babak1Score = Math.round(plotScore + simScore + amanatScore);

  // Babak II Score (35% character evidence, 30% pouch escalation, 35% sensory 5 indera)
  let correctCharCount = 0;
  CHARACTER_EVIDENCE_CHALLENGES.forEach((ch) => {
    const chosen = ch.options.find((o) => o.id === state.characterEvidenceAnswers[ch.id]);
    if (chosen?.isValidEvidence) correctCharCount++;
  });
  let correctPouchCount = 0;
  EMAS_POUCH_STEPS.forEach((st, idx) => {
    if (state.pouchOrderIds[idx] === st.pouchId) correctPouchCount++;
  });
  let correctSensoryCount = 0;
  SENSORY_UPGRADE_CHALLENGES.forEach((ch) => {
    const chosen = ch.options.find((o) => o.id === state.sensoryUpgradeAnswers[ch.id]);
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
    if (pair && pair.connector === item.correctConnector && pair.comparison === item.correctComparison) {
      correctMajasCount++;
    }
  });
  let correctDialogueCount = 0;
  DIALOGUE_TRANSMUTATION_CHALLENGES.forEach((item) => {
    const chosen = item.options.find((o) => o.id === state.dialogueAnswers[item.id]);
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
  const questScore = Math.round((correctQuestCount / ASTROLABE_SIDE_QUESTS.length) * 100);

  // Babak IV Score (Live Literary Detector di Studio Tulis)
  const studioAnalysis = analyzeStudentManuscript(
    state.studioDraft ?? INITIAL_STUDIO_DRAFT
  );
  const babak4Score = studioAnalysis.studioScore;

  const overallPercentage = Math.round(
    babak1Score * 0.3 + babak2Score * 0.3 + babak3Score * 0.3 + questScore * 0.1
  );

  const holisticTotalPercentage = Math.round(
    overallPercentage * 0.6 + babak4Score * 0.4
  );

  const unlockedSealsCount =
    (state.sealAlurUnlocked ? 1 : 0) +
    (state.sealWatakUnlocked ? 1 : 0) +
    (state.sealBahasaUnlocked ? 1 : 0);

  // Kategori kelayakan/penguasaan sesuai skala persentase Pedoman PjBL hlm. 9
  const kelayakanCategory =
    overallPercentage >= 81
      ? "Sangat Mahir (81–100%)"
      : overallPercentage >= 61
      ? "Cakap / Layak (61–80%)"
      : overallPercentage >= 41
      ? "Berkembang (41–60%)"
      : "Tahap Eksplorasi Awal (0–40%)";

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
  };
}

export function updateLearningState(
  updater: (prev: AksaralokaLearningState) => AksaralokaLearningState
): AksaralokaLearningState {
  hydrateFromStorageOnce();
  const nextRaw = updater(currentState);
  const next = recomputeSeals(nextRaw);
  currentState = next;
  persistToStorage(next);
  notifyListeners();
  return next;
}

export function resetLearningState(): void {
  currentState = INITIAL_LEARNING_STATE;
  persistToStorage(currentState);
  notifyListeners();
}

export function setActiveGrimoireChapter(chapter: GrimoireChapterId): void {
  updateLearningState((prev) => ({
    ...prev,
    activeGrimoireChapter: chapter,
  }));
}

export function markGrimoireIntroOpened(): void {
  updateLearningState((prev) => ({
    ...prev,
    hasOpenedGrimoireIntro: true,
  }));
}

export function updateStudioDraft(
  patch: Partial<StudioDraftData>
): AksaralokaLearningState {
  const isEditingStoryParagraphs =
    patch.paragraphOrientasi !== undefined ||
    patch.paragraphKomplikasi !== undefined ||
    patch.paragraphKlimaks !== undefined ||
    patch.paragraphResolusi !== undefined;

  return updateLearningState((prev) => ({
    ...prev,
    studioDraft: {
      ...prev.studioDraft,
      ...patch,
      isModelPresetReference:
        patch.isModelPresetReference !== undefined
          ? patch.isModelPresetReference
          : isEditingStoryParagraphs
            ? false
            : prev.studioDraft.isModelPresetReference,
    },
  }));
}

export function toggleStudioRevisionCheck(
  checkId: string
): AksaralokaLearningState {
  return updateLearningState((prev) => ({
    ...prev,
    studioDraft: {
      ...prev.studioDraft,
      selfRevisionChecks: {
        ...prev.studioDraft.selfRevisionChecks,
        [checkId]: !prev.studioDraft.selfRevisionChecks[checkId],
      },
    },
  }));
}

export function applyStudioSeedPreset(
  presetId: string,
  mode: "outline_only" | "full_model_reference" = "outline_only"
): AksaralokaLearningState {
  const found = STORY_SEED_PRESETS.find((p) => p.id === presetId);
  if (!found) return currentState;

  if (mode === "outline_only") {
    return updateLearningState((prev) => ({
      ...prev,
      studioDraft: {
        ...prev.studioDraft,
        ...found.draftPreset,
        paragraphOrientasi: "",
        paragraphKomplikasi: "",
        paragraphKlimaks: "",
        paragraphResolusi: "",
        isModelPresetReference: false,
      },
    }));
  }

  return updateLearningState((prev) => ({
    ...prev,
    studioDraft: {
      ...prev.studioDraft,
      ...found.draftPreset,
      isModelPresetReference: true,
    },
  }));
}

export function saveCurrentManuscriptToPustaka(): SavedManuscriptItem {
  hydrateFromStorageOnce();
  const draft = currentState.studioDraft;
  const analysis = analyzeStudentManuscript(draft);
  const item: SavedManuscriptItem = {
    id: `ms-${Date.now()}`,
    savedAtIso: new Date().toISOString(),
    storyTitle: draft.storyTitle.trim() || "Manuskrip Fantasi Tanpa Judul",
    authorName: draft.authorName.trim() || "Penjaga Aksara Muda",
    authorClass: draft.authorClass.trim() || "VII",
    themeCategory: draft.themeCategory,
    wordCount: analysis.totalWords,
    studioScore: analysis.studioScore,
    draft,
  };

  updateLearningState((prev) => ({
    ...prev,
    savedManuscripts: [item, ...prev.savedManuscripts].slice(0, 12),
  }));

  return item;
}

export function loadSavedManuscriptToEditor(manuscriptId: string): void {
  updateLearningState((prev) => {
    const found = prev.savedManuscripts.find((m) => m.id === manuscriptId);
    if (!found) return prev;
    return {
      ...prev,
      studioDraft: found.draft,
    };
  });
}

export function deleteSavedManuscriptFromPustaka(manuscriptId: string): void {
  updateLearningState((prev) => ({
    ...prev,
    savedManuscripts: prev.savedManuscripts.filter((m) => m.id !== manuscriptId),
  }));
}

function subscribeLearningStore(listener: () => void): () => void {
  hydrateFromStorageOnce();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot(): AksaralokaLearningState {
  hydrateFromStorageOnce();
  return currentState;
}

function getServerSnapshot(): AksaralokaLearningState {
  return INITIAL_LEARNING_STATE;
}

export function useAksaralokaLearning(): {
  readonly state: AksaralokaLearningState;
  readonly metrics: CompetencyMetrics;
} {
  const state = useSyncExternalStore(
    subscribeLearningStore,
    getClientSnapshot,
    getServerSnapshot
  );
  const metrics = computeCompetencyMetrics(state);
  return { state, metrics };
}
