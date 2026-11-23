import { describe, expect, it } from "vitest";
import { INITIAL_STUDIO_DRAFT } from "@/lib/learning/literaryDetector";
import {
  buildVerifiedSubmissionRecord,
  submitWorkRequestSchema,
} from "@/lib/submissions/submissionSchemas";
import {
  NASKAH_CERITA_HEADERS,
  PETA_RANCANG_HEADERS,
  REKAP_NILAI_HEADERS,
  buildNaskahCeritaRow,
  buildPetaRancangRow,
  buildRekapNilaiRow,
  buildTeacherExportCsv,
  escapeCsvCell,
  truncateSheetCell,
} from "./googleSheetsFormatters";

function buildSampleRecord() {
  const payload = submitWorkRequestSchema.parse({
    authorName: "Bima Pratama",
    authorClass: "VII-C",
    absenNumber: "07",
    classCode: "VII-C-2026",
    learningState: {
      plotPlacedIds: [],
      climaxSimulationTested: false,
      selectedAmanatId: null,
      customAmanatReflection: "Kebaikan selalu berbuah manis.",
      characterEvidenceAnswers: {},
      pouchOrderIds: [],
      sensoryUpgradeAnswers: {},
      majasAnswers: {},
      dialogueAnswers: {},
      questAnswers: {},
      studioDraft: {
        ...INITIAL_STUDIO_DRAFT,
        storyTitle: "Pedang Cahaya dari Gunung Perak",
        worldRule: "Pedang hanya bisa diangkat oleh hati yang tulus.",
        protagonistName: "Bima",
        protagonistTraitAction: "Pantang menyerah saat menolong desa.",
        antagonistName: "Raja Bayangan",
        antagonistConflictTrigger: "Membekukan sungai desa.",
        settingPlace: "Gunung Perak",
        sensorySight: "Kilau perak berkilau terang.",
        sensorySound: "Gemericik sungai membeku seketika.",
        sensorySmellTouch: "Hawa dingin menusuk tulang.",
        outlineOrientasi: "Bima menemukan gua perak.",
        outlineKomplikasiKlimaks: "Raja Bayangan menyerang desa.",
        outlineResolusi: "Bima mencairkan sungai dengan ketulusan.",
        paragraphOrientasi: "Di kaki Gunung Perak, cahaya perak berkilau terang di balik kabut.",
        paragraphKomplikasi: "Raja Bayangan datang membekukan sungai desa hingga warga resah.",
        paragraphKlimaks: 'Bima berseru tegas, "Aku tidak akan menyerah!" lalu pedangnya bersinar seperti mentari.',
        paragraphResolusi: "Akhirnya es mencair dan desa kembali damai.",
        amanat: "Ketulusan mengalahkan keserakahan.",
        authorReflection: "Seru sekali merancang dunia fantasi sendiri.",
      },
    },
  });

  return buildVerifiedSubmissionRecord({
    payload,
    resolvedClassCode: "VII-C-2026",
    version: 1,
    previousTeacherReview: {
      teacherScore: 92,
      teacherFeedback: "Alur sangat runtut dan imajinatif.",
      reviewedAtIso: "2026-11-24T02:00:00.000Z",
      isFeaturedInGallery: true,
    },
  });
}

describe("googleSheetsFormatters (3-tab mapping & CSV security)", () => {
  it("aligns Rekap_Nilai, Naskah_Cerita, and Peta_Rancang_LKS rows 1:1 with their headers", () => {
    const record = buildSampleRecord();

    const rekapFull = buildRekapNilaiRow(record, {
      baseUrl: "https://e-aksaraloka.vercel.app",
      includeTeacherColumns: true,
    });
    const rekapWithoutTeacher = buildRekapNilaiRow(record, {
      baseUrl: "https://e-aksaraloka.vercel.app",
      includeTeacherColumns: false,
    });
    const naskahRow = buildNaskahCeritaRow(record);
    const petaRow = buildPetaRancangRow(record);

    expect(rekapFull).toHaveLength(REKAP_NILAI_HEADERS.length);
    expect(rekapWithoutTeacher).toHaveLength(REKAP_NILAI_HEADERS.length - 2);
    expect(rekapFull[24]).toContain("https://e-aksaraloka.vercel.app/guru?karya=");
    expect(rekapFull[25]).toBe(92);
    expect(rekapFull[26]).toBe("Alur sangat runtut dan imajinatif.");

    expect(naskahRow).toHaveLength(NASKAH_CERITA_HEADERS.length);
    expect(petaRow).toHaveLength(PETA_RANCANG_HEADERS.length);
  });

  it("truncates oversized cells safely below Google Sheets 50,000-char limit", () => {
    const huge = "A".repeat(60_000);
    const truncated = truncateSheetCell(huge);
    expect(truncated.length).toBeLessThanOrEqual(49_000);
    expect(truncated).toContain("dipotong");
  });

  it("prevents CSV formula injection and outputs UTF-8 BOM for Windows Excel", () => {
    expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(escapeCsvCell("+SUM(A1:A5)")).toBe("'+SUM(A1:A5)");
    expect(escapeCsvCell("@alert")).toBe("'@alert");
    expect(escapeCsvCell('Dia berkata, "Halo!"')).toBe('"Dia berkata, ""Halo!"""');
    expect(escapeCsvCell(95)).toBe("95");

    const csv = buildTeacherExportCsv([buildSampleRecord()], "https://e-aksaraloka.vercel.app");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Pedang Cahaya dari Gunung Perak");
    expect(csv).toContain("Bima Pratama");
  });
});
