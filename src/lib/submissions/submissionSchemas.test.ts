import { describe, expect, it } from "vitest";
import { INITIAL_STUDIO_DRAFT } from "@/lib/learning/literaryDetector";
import {
  buildStudentKey,
  buildVerifiedSubmissionRecord,
  deriveAuthenticityStatus,
  normalizeClassCode,
  submitWorkRequestSchema,
} from "./submissionSchemas";

function makeBasePayload(overrides: Partial<typeof INITIAL_STUDIO_DRAFT> = {}) {
  return submitWorkRequestSchema.parse({
    authorName: "Nadia Putri",
    authorClass: "VII-A",
    absenNumber: "14",
    classCode: "vii-a-2026",
    clientSessionId: "ses-test-1",
    learningState: {
      plotPlacedIds: [
        "beat-orientasi",
        "beat-muncul-masalah",
        "beat-eskalasi",
        "beat-klimaks",
        "beat-resolusi",
      ],
      climaxSimulationTested: true,
      selectedAmanatId: "am-tanggung-jawab",
      customAmanatReflection: "Kita harus jujur dan berani bertanggung jawab.",
      characterEvidenceAnswers: {},
      pouchOrderIds: [],
      sensoryUpgradeAnswers: {},
      majasAnswers: {},
      dialogueAnswers: {},
      questAnswers: {},
      studioDraft: {
        ...INITIAL_STUDIO_DRAFT,
        storyTitle: "Lentera Kristal di Lembah Awan",
        worldRule: "Lentera hanya menyala jika pemiliknya berkata jujur.",
        protagonistName: "Raka",
        protagonistTraitAction: "Jujur dan berani menolong sahabatnya.",
        antagonistName: "Kabut Abu",
        antagonistConflictTrigger: "Mencoba memadamkan lentera dengan tipu daya.",
        settingPlace: "Lembah Awan Biru",
        sensorySight: "Cahaya emas berpendar menembus kabut tipis.",
        sensorySound: "Gemuruh angin malam menggema di tebing batu.",
        sensorySmellTouch: "Hawa dingin menusuk tangan dan aroma pinus basah.",
        paragraphOrientasi:
          "Di dalam Lembah Awan Biru, cahaya emas berpendar dari lentera kristal milik Raka. Aroma pinus basah dan hawa dingin menyapu wajahnya.",
        paragraphKomplikasi:
          "Tiba-tiba gemuruh angin menggema ketika Kabut Abu datang merampas lentera itu bagaikan bayangan raksasa.",
        paragraphKlimaks:
          'Kabut Abu berbisik dingin, "Serahkan lentera itu sekarang!" Namun Raka tetap jujur sehingga lentera menyala terang sekali.',
        paragraphResolusi:
          "Akhirnya Kabut Abu pun lenyap. Raka mengatakan bahwa kejujuran selalu mengalahkan tipu daya, lalu ia pulang dengan hati lega.",
        extraSpreads: [
          {
            id: "sp-1",
            leftTitle: "Epilog",
            rightTitle: "Catatan",
            leftText: "Sejak hari itu, lentera tetap terjaga di menara desa.",
            rightText: "",
          },
        ],
        amanat: "Kejujuran membawa cahaya di tengah kesulitan.",
        authorReflection: "Bagian klimaks paling menantang untuk direvisi.",
        selfRevisionChecks: {
          "rev-struktur": true,
          "rev-aturan": true,
          "rev-watak-Indra": true,
          "rev-majas-dialog": true,
          "rev-eyd": true,
        },
        ...overrides,
      },
    },
  });
}

describe("submissionSchemas & server-side verification", () => {
  it("normalizes classCode and generates stable studentKey across whitespace/case differences", () => {
    expect(normalizeClassCode(" vii a 2026 ", "VII-A")).toBe("VII-A-2026");
    expect(normalizeClassCode("", "VII-B")).toBe("VII-B");

    const k1 = buildStudentKey({
      classCode: "VII-A-2026",
      authorClass: "VII-A",
      absenNumber: "14",
      authorName: "Nadia Putri",
    });
    const k2 = buildStudentKey({
      classCode: " vii-a-2026 ",
      authorClass: "vii-a",
      absenNumber: " 14 ",
      authorName: "  nadia   putri ",
    });
    expect(k1).toBe(k2);
  });

  it("recomputes metrics, fullStoryText, and authenticity server-side without trusting client scores", () => {
    const payload = makeBasePayload();
    const record = buildVerifiedSubmissionRecord({
      payload,
      resolvedClassCode: "VII-A-2026",
      version: 2,
    });

    expect(record.version).toBe(2);
    expect(record.isLatest).toBe(true);
    expect(record.classCode).toBe("VII-A-2026");
    expect(record.analysis.authenticityStatus).toBe("orisinal");
    expect(record.analysis.totalWords).toBeGreaterThan(45);
    expect(record.metrics.babak4Score).toBeGreaterThan(0);
    expect(record.fullStoryText).toContain("Lembah Awan Biru");
    expect(record.fullStoryText).toContain("menara desa");
    expect(record.sheetSync.status).toBe("pending");
  });

  it("flags model preset copies and unfilled [...] placeholders accurately for teachers", () => {
    expect(
      deriveAuthenticityStatus({
        isModelPresetReference: true,
        unfilledPlaceholderCount: 0,
      })
    ).toBe("teks_contoh_preset");

    expect(
      deriveAuthenticityStatus({
        isModelPresetReference: false,
        unfilledPlaceholderCount: 2,
      })
    ).toBe("belum_lengkap_placeholder");

    const presetRecord = buildVerifiedSubmissionRecord({
      payload: makeBasePayload({ isModelPresetReference: true }),
      resolvedClassCode: "VII-A",
      version: 1,
    });
    expect(presetRecord.analysis.authenticityStatus).toBe("teks_contoh_preset");
    expect(presetRecord.analysis.isReadyForSeal).toBe(false);
  });
});
