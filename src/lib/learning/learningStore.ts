"use client";

import { useSyncExternalStore } from "react";
import type { GrimoireChapterId } from "./narrativeCurriculumData";
import {
  INITIAL_STUDIO_DRAFT,
  STORY_SEED_PRESETS,
  analyzeStudentManuscript,
  type SavedManuscriptItem,
  type StudioDraftData,
} from "./literaryDetector";
import {
  INITIAL_LEARNING_STATE,
  computeCompetencyMetrics,
  recomputeSeals,
  type AksaralokaLearningState,
  type CompetencyMetrics,
  type LastSubmissionMeta,
} from "./competencyScoring";

export {
  INITIAL_LEARNING_STATE,
  composeFullStoryText,
  computeCompetencyMetrics,
  getMasteryRankTitle,
  getPjblMasteryCategory,
  isAmanatCorrect,
  isCharacterEvidenceComplete,
  isDialogueComplete,
  isMajasComplete,
  isPlotOrderCorrect,
  isPouchOrderComplete,
  isSensoryComplete,
  recomputeSeals,
  type AksaralokaLearningState,
  type CompetencyMetrics,
  type LastSubmissionMeta,
  type MajasAnswerPair,
  type SheetSyncStatus,
} from "./competencyScoring";

const STORAGE_KEY = "aksaraloka:learning-state:v1";

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
        lastSubmissionMeta: parsed.lastSubmissionMeta ?? null,
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

export function setLastSubmissionMeta(
  meta: LastSubmissionMeta | null
): AksaralokaLearningState {
  return updateLearningState((prev) => ({
    ...prev,
    lastSubmissionMeta: meta,
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
