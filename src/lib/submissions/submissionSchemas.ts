import { z } from "zod";
import {
  INITIAL_STUDIO_DRAFT,
  analyzeStudentManuscript,
  type EydAndLexiconIssue,
  type LiteraryIndicatorStatus,
  type StudioDraftData,
} from "@/lib/learning/literaryDetector";
import {
  INITIAL_LEARNING_STATE,
  composeFullStoryText,
  computeCompetencyMetrics,
  recomputeSeals,
  type AksaralokaLearningState,
  type CompetencyMetrics,
  type MajasAnswerPair,
  type SheetSyncStatus,
} from "@/lib/learning/competencyScoring";

const studioExtraSpreadSchema = z.object({
  id: z.string().trim().min(1).max(64),
  leftTitle: z.string().max(160).default(""),
  rightTitle: z.string().max(160).default(""),
  leftText: z.string().max(8000).default(""),
  rightText: z.string().max(8000).default(""),
});

export const studioDraftSubmissionSchema = z.object({
  authorName: z.string().trim().max(120).default(""),
  authorClass: z.string().trim().max(40).default("VII-A"),
  authorAbsen: z.string().trim().max(24).optional().default(""),
  classCode: z.string().trim().max(40).optional().default(""),
  themeCategory: z.string().trim().max(140).default("Lintas Waktu & Konsekuensi"),
  worldRule: z.string().max(2000).default(""),
  protagonistName: z.string().max(120).default(""),
  protagonistTraitAction: z.string().max(2000).default(""),
  antagonistName: z.string().max(120).default(""),
  antagonistConflictTrigger: z.string().max(2000).default(""),
  settingPlace: z.string().max(300).default(""),
  sensorySight: z.string().max(1200).default(""),
  sensorySound: z.string().max(1200).default(""),
  sensorySmellTouch: z.string().max(1200).default(""),
  outlineOrientasi: z.string().max(2000).default(""),
  outlineKomplikasiKlimaks: z.string().max(2000).default(""),
  outlineResolusi: z.string().max(2000).default(""),
  paragraphOrientasi: z.string().max(12000).default(""),
  paragraphKomplikasi: z.string().max(12000).optional().default(""),
  paragraphKlimaks: z.string().max(12000).default(""),
  paragraphResolusi: z.string().max(12000).default(""),
  extraSpreads: z.array(studioExtraSpreadSchema).max(12).optional().default([]),
  isModelPresetReference: z.boolean().optional().default(false),
  storyTitle: z.string().max(200).default(""),
  amanat: z.string().max(2000).default(""),
  authorReflection: z.string().max(2000).optional().default(""),
  selfRevisionChecks: z.record(z.string(), z.boolean()).default({}),
});

const majasAnswerPairSchema = z.object({
  connector: z.string().max(80),
  comparison: z.string().max(160),
});

export const submitWorkRequestSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(2, "Nama lengkap siswa minimal 2 karakter.")
    .max(120, "Nama lengkap siswa maksimal 120 karakter."),
  authorClass: z
    .string()
    .trim()
    .min(1, "Kelas wajib diisi (contoh: VII-A).")
    .max(40, "Kelas maksimal 40 karakter."),
  absenNumber: z.string().trim().max(24).optional().default(""),
  classCode: z
    .string()
    .trim()
    .max(40, "Kode kelas maksimal 40 karakter.")
    .optional()
    .default(""),
  clientSessionId: z.string().trim().max(80).optional().default(""),
  learningState: z.object({
    plotPlacedIds: z.array(z.string().max(80)).max(20).default([]),
    climaxSimulationTested: z.boolean().default(false),
    selectedAmanatId: z.string().max(80).nullable().default(null),
    customAmanatReflection: z.string().max(2000).default(""),
    characterEvidenceAnswers: z.record(z.string(), z.string().max(80)).default({}),
    pouchOrderIds: z.array(z.string().max(80)).max(20).default([]),
    sensoryUpgradeAnswers: z.record(z.string(), z.string().max(80)).default({}),
    majasAnswers: z.record(z.string(), majasAnswerPairSchema).default({}),
    dialogueAnswers: z.record(z.string(), z.string().max(80)).default({}),
    questAnswers: z.record(z.string(), z.string().max(80)).default({}),
    studioDraft: studioDraftSubmissionSchema,
  }),
});

export type SubmitWorkRequestPayload = z.infer<typeof submitWorkRequestSchema>;

export const teacherReviewUpdateSchema = z.object({
  teacherScore: z
    .number()
    .min(0, "Nilai guru minimal 0.")
    .max(100, "Nilai guru maksimal 100.")
    .nullable(),
  teacherFeedback: z
    .string()
    .trim()
    .max(2000, "Catatan guru maksimal 2000 karakter.")
    .default(""),
  isFeaturedInGallery: z.boolean().default(false),
});

export type TeacherReviewUpdatePayload = z.infer<typeof teacherReviewUpdateSchema>;

export const upsertClassroomSchema = z.object({
  classCode: z
    .string()
    .trim()
    .min(2, "Kode kelas minimal 2 karakter.")
    .max(40, "Kode kelas maksimal 40 karakter.")
    .regex(/^[A-Za-z0-9_-]+$/, "Kode kelas hanya boleh huruf, angka, '-' atau '_'."),
  className: z
    .string()
    .trim()
    .min(1, "Nama kelas wajib diisi (contoh: VII-A).")
    .max(60),
  teacherName: z.string().trim().max(120).optional().default(""),
  spreadsheetId: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^[A-Za-z0-9_-]{10,120}$/.test(v),
      "Format Spreadsheet ID tidak valid."
    )
    .optional()
    .default(""),
  isActive: z.boolean().optional().default(true),
});

export type UpsertClassroomPayload = z.infer<typeof upsertClassroomSchema>;

export type AuthenticityStatus =
  | "orisinal"
  | "teks_contoh_preset"
  | "belum_lengkap_placeholder";

export interface PracticeAnswersSnapshot {
  readonly plotPlacedIds: readonly string[];
  readonly climaxSimulationTested: boolean;
  readonly selectedAmanatId: string | null;
  readonly customAmanatReflection: string;
  readonly characterEvidenceAnswers: Readonly<Record<string, string>>;
  readonly pouchOrderIds: readonly string[];
  readonly sensoryUpgradeAnswers: Readonly<Record<string, string>>;
  readonly majasAnswers: Readonly<Record<string, MajasAnswerPair>>;
  readonly dialogueAnswers: Readonly<Record<string, string>>;
  readonly questAnswers: Readonly<Record<string, string>>;
}

export interface SubmissionAnalysisSnapshot {
  readonly totalWords: number;
  readonly orientasiWords: number;
  readonly komplikasiWords: number;
  readonly klimaksWords: number;
  readonly resolusiWords: number;
  readonly passedIndicatorsCount: number;
  readonly indicators: readonly LiteraryIndicatorStatus[];
  readonly eydIssuesCount: number;
  readonly eydAndLexiconIssues: readonly EydAndLexiconIssue[];
  readonly revisionCheckedCount: number;
  readonly totalRevisionChecklistCount: number;
  readonly isModelPresetReference: boolean;
  readonly unfilledPlaceholderCount: number;
  readonly isReadyForSeal: boolean;
  readonly authenticityStatus: AuthenticityStatus;
}

export interface TeacherReviewRecord {
  readonly teacherScore: number | null;
  readonly teacherFeedback: string;
  readonly reviewedAtIso: string | null;
  readonly isFeaturedInGallery: boolean;
}

export interface SheetSyncRecord {
  readonly status: SheetSyncStatus;
  readonly syncedAtIso: string | null;
  readonly lastError: string | null;
  readonly spreadsheetId: string | null;
  readonly rekapRowNumber: number | null;
}

export interface StudentSubmissionRecord {
  readonly submissionId: string;
  readonly studentKey: string;
  readonly version: number;
  readonly isLatest: boolean;
  readonly submittedAtIso: string;
  readonly updatedAtIso: string;
  readonly classCode: string;
  readonly authorName: string;
  readonly authorClass: string;
  readonly absenNumber: string;
  readonly clientSessionId: string;
  readonly storyTitle: string;
  readonly themeCategory: string;
  readonly metrics: CompetencyMetrics;
  readonly analysis: SubmissionAnalysisSnapshot;
  readonly draft: StudioDraftData;
  readonly fullStoryText: string;
  readonly customAmanatReflection: string;
  readonly practiceAnswers: PracticeAnswersSnapshot;
  readonly teacherReview: TeacherReviewRecord;
  readonly sheetSync: SheetSyncRecord;
}

export interface ClassroomRecord {
  readonly classCode: string;
  readonly className: string;
  readonly teacherName: string;
  readonly spreadsheetId: string | null;
  readonly isActive: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export function normalizeClassCode(rawClassCode: string, authorClass: string): string {
  const cleanedCode = rawClassCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleanedCode.length >= 2) return cleanedCode;

  const fromClass = authorClass
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fromClass.length >= 1 ? fromClass : "UMUM";
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

/**
 * Kunci identitas siswa yang stabil per kelas untuk melacak versi revisi (v1, v2, ...)
 * dan memperbarui baris siswa di tab Rekap_Nilai tanpa duplikasi ganda.
 */
export function buildStudentKey(params: {
  readonly classCode: string;
  readonly authorClass: string;
  readonly absenNumber: string;
  readonly authorName: string;
}): string {
  const normCode = normalizeClassCode(params.classCode, params.authorClass).toLowerCase();
  const normClass = normalizeToken(params.authorClass) || "vii";
  const normAbsen = normalizeToken(params.absenNumber);
  const normName = normalizeToken(params.authorName) || "siswa";
  return `${normCode}::${normClass}::${normAbsen || "na"}::${normName}`;
}

export function deriveAuthenticityStatus(params: {
  readonly isModelPresetReference: boolean;
  readonly unfilledPlaceholderCount: number;
}): AuthenticityStatus {
  if (params.isModelPresetReference) return "teks_contoh_preset";
  if (params.unfilledPlaceholderCount > 0) return "belum_lengkap_placeholder";
  return "orisinal";
}

export function formatAuthenticityLabel(status: AuthenticityStatus): string {
  if (status === "teks_contoh_preset") return "Teks Contoh Preset (Perlu Ditulis Sendiri)";
  if (status === "belum_lengkap_placeholder") return "Masih Ada Bagian [...] Belum Diisi";
  return "Orisinal";
}

export function generateSubmissionId(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `SUB-${y}${m}${d}-${rand}`;
}

/**
 * Membangun dokumen pengumpulan terverifikasi penuh dengan menghitung ulang
 * seluruh skor Babak I–IV, segel, dan analisis EYD V secara deterministik di server.
 */
export function buildVerifiedSubmissionRecord(params: {
  readonly payload: SubmitWorkRequestPayload;
  readonly resolvedClassCode: string;
  readonly version: number;
  readonly previousTeacherReview?: TeacherReviewRecord | null;
  readonly spreadsheetId?: string | null;
  readonly now?: Date;
}): StudentSubmissionRecord {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const { payload } = params;

  const normalizedDraft: StudioDraftData = {
    ...INITIAL_STUDIO_DRAFT,
    ...payload.learningState.studioDraft,
    authorName: payload.authorName,
    authorClass: payload.authorClass,
    authorAbsen: payload.absenNumber,
    classCode: params.resolvedClassCode,
    selfRevisionChecks: {
      ...INITIAL_STUDIO_DRAFT.selfRevisionChecks,
      ...payload.learningState.studioDraft.selfRevisionChecks,
    },
  };

  const reconstructedState: AksaralokaLearningState = recomputeSeals({
    ...INITIAL_LEARNING_STATE,
    plotPlacedIds: payload.learningState.plotPlacedIds,
    climaxSimulationTested: payload.learningState.climaxSimulationTested,
    selectedAmanatId: payload.learningState.selectedAmanatId,
    customAmanatReflection: payload.learningState.customAmanatReflection,
    characterEvidenceAnswers: payload.learningState.characterEvidenceAnswers,
    pouchOrderIds: payload.learningState.pouchOrderIds,
    sensoryUpgradeAnswers: payload.learningState.sensoryUpgradeAnswers,
    majasAnswers: payload.learningState.majasAnswers,
    dialogueAnswers: payload.learningState.dialogueAnswers,
    questAnswers: payload.learningState.questAnswers,
    studioDraft: normalizedDraft,
    savedManuscripts: [],
  });

  const metrics = computeCompetencyMetrics(reconstructedState);
  const rawAnalysis = analyzeStudentManuscript(normalizedDraft);
  const fullStoryText = composeFullStoryText(normalizedDraft);
  const authenticityStatus = deriveAuthenticityStatus({
    isModelPresetReference: rawAnalysis.isModelPresetReference,
    unfilledPlaceholderCount: rawAnalysis.unfilledPlaceholderCount,
  });

  const studentKey = buildStudentKey({
    classCode: params.resolvedClassCode,
    authorClass: payload.authorClass,
    absenNumber: payload.absenNumber,
    authorName: payload.authorName,
  });

  return {
    submissionId: generateSubmissionId(now),
    studentKey,
    version: params.version,
    isLatest: true,
    submittedAtIso: nowIso,
    updatedAtIso: nowIso,
    classCode: params.resolvedClassCode,
    authorName: payload.authorName,
    authorClass: payload.authorClass,
    absenNumber: payload.absenNumber,
    clientSessionId: payload.clientSessionId,
    storyTitle: normalizedDraft.storyTitle.trim() || "Manuskrip Fantasi Tanpa Judul",
    themeCategory: normalizedDraft.themeCategory.trim() || "Fantasi Bebas",
    metrics,
    analysis: {
      totalWords: rawAnalysis.totalWords,
      orientasiWords: rawAnalysis.orientasiWords,
      komplikasiWords: rawAnalysis.komplikasiWords,
      klimaksWords: rawAnalysis.klimaksWords,
      resolusiWords: rawAnalysis.resolusiWords,
      passedIndicatorsCount: rawAnalysis.passedIndicatorsCount,
      indicators: rawAnalysis.indicators,
      eydIssuesCount: rawAnalysis.eydAndLexiconIssues.length,
      eydAndLexiconIssues: rawAnalysis.eydAndLexiconIssues,
      revisionCheckedCount: rawAnalysis.revisionCheckedCount,
      totalRevisionChecklistCount: rawAnalysis.totalRevisionChecklistCount,
      isModelPresetReference: rawAnalysis.isModelPresetReference,
      unfilledPlaceholderCount: rawAnalysis.unfilledPlaceholderCount,
      isReadyForSeal: rawAnalysis.isReadyForSeal,
      authenticityStatus,
    },
    draft: normalizedDraft,
    fullStoryText,
    customAmanatReflection: payload.learningState.customAmanatReflection.trim(),
    practiceAnswers: {
      plotPlacedIds: payload.learningState.plotPlacedIds,
      climaxSimulationTested: payload.learningState.climaxSimulationTested,
      selectedAmanatId: payload.learningState.selectedAmanatId,
      customAmanatReflection: payload.learningState.customAmanatReflection,
      characterEvidenceAnswers: payload.learningState.characterEvidenceAnswers,
      pouchOrderIds: payload.learningState.pouchOrderIds,
      sensoryUpgradeAnswers: payload.learningState.sensoryUpgradeAnswers,
      majasAnswers: payload.learningState.majasAnswers,
      dialogueAnswers: payload.learningState.dialogueAnswers,
      questAnswers: payload.learningState.questAnswers,
    },
    teacherReview: params.previousTeacherReview ?? {
      teacherScore: null,
      teacherFeedback: "",
      reviewedAtIso: null,
      isFeaturedInGallery: false,
    },
    sheetSync: {
      status: "pending",
      syncedAtIso: null,
      lastError: null,
      spreadsheetId: params.spreadsheetId ?? null,
      rekapRowNumber: null,
    },
  };
}
