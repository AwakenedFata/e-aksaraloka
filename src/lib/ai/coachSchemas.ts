import { z } from "zod";

/**
 * Kontrak skema input & output Socratic AI Coach (/api/ai/coach).
 * Selaras dengan docs/authority-sources-audit.md:
 * - Seluruh keluaran LLM diberi label `verificationStatus: "model_suggestion"`
 *   (tidak pernah mengaku sebagai otoritas resmi KBBI/EYD V).
 * - Seluruh mode dilarang melakukan ghostwriting paragraf utuh bagi siswa.
 */

export const coachThemeLexiconRequestSchema = z.object({
  mode: z.literal("theme_lexicon"),
  theme: z.string().trim().min(2, "Tulis tema ceritamu minimal 2 huruf.").max(120),
  settingPlace: z.string().trim().max(120).optional().default(""),
  worldRule: z.string().trim().max(320).optional().default(""),
  protagonistName: z.string().trim().max(60).optional().default(""),
});

export const coachLogicCheckRequestSchema = z.object({
  mode: z.literal("logic_check"),
  theme: z.string().trim().max(120).optional().default(""),
  worldRule: z
    .string()
    .trim()
    .min(8, "Isi dulu Aturan Benda/Kekuatan Ajaib di Lembar 1 (minimal 8 huruf).")
    .max(360),
  paragraphOrientasi: z.string().trim().max(1800).optional().default(""),
  paragraphKomplikasi: z.string().trim().max(1800).optional().default(""),
  paragraphKlimaks: z.string().trim().max(1800).optional().default(""),
  paragraphResolusi: z.string().trim().max(1800).optional().default(""),
});

export const coachSocraticReviewRequestSchema = z.object({
  mode: z.literal("socratic_review"),
  theme: z.string().trim().max(120).optional().default(""),
  worldRule: z.string().trim().max(360).optional().default(""),
  storyTitle: z.string().trim().max(120).optional().default(""),
  paragraphOrientasi: z.string().trim().max(1800).optional().default(""),
  paragraphKomplikasi: z.string().trim().max(1800).optional().default(""),
  paragraphKlimaks: z.string().trim().max(1800).optional().default(""),
  paragraphResolusi: z.string().trim().max(1800).optional().default(""),
  amanat: z.string().trim().max(360).optional().default(""),
});

export const coachRequestSchema = z.discriminatedUnion("mode", [
  coachThemeLexiconRequestSchema,
  coachLogicCheckRequestSchema,
  coachSocraticReviewRequestSchema,
]);

export type CoachRequest = z.infer<typeof coachRequestSchema>;

// ============================================================================
// OUTPUT DATA SCHEMAS (STRICT JSON VALIDATION)
// ============================================================================

export const aiSensoryWordSchema = z.object({
  word: z.string().trim().min(2).max(48),
  sense: z.enum(["Penglihatan", "Pendengaran", "Aroma / Sentuhan"]),
  type: z.enum(["Denotatif", "Konotatif", "Kiasan / Majas"]),
  meaning: z.string().trim().min(4).max(160),
  usageHint: z.string().trim().min(4).max(160),
});

export const aiMajasFrameSchema = z.object({
  connector: z.enum(["seperti", "bagaikan", "bagai", "laksana", "bak", "seumpama"]),
  frameWithBlank: z.string().trim().min(8).max(200),
  whyItFits: z.string().trim().min(4).max(160),
});

export const themeLexiconPayloadSchema = z.object({
  sensoryWords: z.array(aiSensoryWordSchema).min(3).max(8),
  majasFrames: z.array(aiMajasFrameSchema).min(2).max(4),
  imaginationQuestions: z.array(z.string().trim().min(6).max(180)).min(1).max(3),
});

export const logicCheckPayloadSchema = z.object({
  consistencyStatus: z.enum([
    "konsisten",
    "perlu_diperkuat",
    "terindikasi_melanggar",
  ]),
  summary: z.string().trim().min(10).max(360),
  strengths: z.array(z.string().trim().min(6).max(200)).min(1).max(3),
  guidingQuestions: z.array(z.string().trim().min(6).max(220)).min(1).max(3),
});

export const socraticReviewPayloadSchema = z.object({
  appreciations: z.array(z.string().trim().min(6).max(220)).min(1).max(3),
  guidingQuestions: z.array(z.string().trim().min(6).max(220)).min(1).max(3),
  nextMiniChallenge: z.string().trim().min(8).max(220),
});

export type ThemeLexiconPayload = z.infer<typeof themeLexiconPayloadSchema>;
export type LogicCheckPayload = z.infer<typeof logicCheckPayloadSchema>;
export type SocraticReviewPayload = z.infer<typeof socraticReviewPayloadSchema>;

export type CoachProviderKind = "groq" | "gemini" | "offline_fallback";
export type CoachVerificationStatus = "model_suggestion" | "curated_offline";

export interface CoachResponseBase {
  readonly provider: CoachProviderKind;
  readonly model: string;
  readonly fallbackUsed: boolean;
  readonly fallbackNotice?: string;
  readonly verificationStatus: CoachVerificationStatus;
  readonly disclaimer: string;
}

export type CoachSuccessResponse =
  | (CoachResponseBase & {
      readonly mode: "theme_lexicon";
      readonly data: ThemeLexiconPayload;
    })
  | (CoachResponseBase & {
      readonly mode: "logic_check";
      readonly data: LogicCheckPayload;
    })
  | (CoachResponseBase & {
      readonly mode: "socratic_review";
      readonly data: SocraticReviewPayload;
    });
