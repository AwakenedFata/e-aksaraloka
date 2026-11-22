import { describe, expect, it } from "vitest";
import {
  INITIAL_STUDIO_DRAFT,
  STORY_SEED_PRESETS,
  analyzeStudentManuscript,
  applyAutomaticEydFixes,
  auditEydAndLexicon,
  buildKbbiReferenceUrl,
} from "./literaryDetector";

describe("literaryDetector & Authority Layer", () => {
  it("evaluates all 3 story seed presets at 100% indicator readiness", () => {
    for (const preset of STORY_SEED_PRESETS) {
      const result = analyzeStudentManuscript({
        ...INITIAL_STUDIO_DRAFT,
        ...preset.draftPreset,
        selfRevisionChecks: {
          "rev-struktur": true,
          "rev-aturan": true,
          "rev-watak-indera": true,
          "rev-majas-dialog": true,
          "rev-eyd": true,
        },
      });
      expect(result.passedIndicatorsCount).toBe(5);
      expect(result.studioScore).toBe(100);
      expect(result.eydAndLexiconIssues.length).toBe(0);
      expect(result.isReadyForSeal).toBe(true);
    }
  });

  it("detects EYD V locative prepositions, quote punctuation, and non-standard lexicon items", () => {
    const sample =
      'Diperpustakaan tua itu, Raka mengambil resiko besar dan berbisik "Aku butuh nasehat"! ';
    const issues = auditEydAndLexicon(sample);

    expect(issues.some((i) => i.id === "eyd-di-perpustakaan")).toBe(true);
    expect(issues.some((i) => i.id === "eyd-quote-punct")).toBe(true);
    expect(issues.some((i) => i.id === "lex-resiko")).toBe(true);
    expect(issues.some((i) => i.id === "lex-nasehat")).toBe(true);

    const fixed = applyAutomaticEydFixes(sample);
    expect(fixed).toContain("Di perpustakaan");
    expect(fixed).toContain("risiko");
    expect(fixed).toContain("nasihat");
    expect(fixed).toContain('!"');
    expect(auditEydAndLexicon(fixed).length).toBe(0);
  });

  it("generates safe KBBI VI reference links without scraping", () => {
    const url = buildKbbiReferenceUrl("Berpendar");
    expect(url).toBe("https://kbbi.kemendikdasmen.go.id/entri/berpendar");
  });

  it("includes extraSpreads pages in totalWords and literary indicator scanning", () => {
    const basePreset = STORY_SEED_PRESETS[0]!;
    const withoutExtra = analyzeStudentManuscript({
      ...INITIAL_STUDIO_DRAFT,
      ...basePreset.draftPreset,
      extraSpreads: [],
    });

    const withExtra = analyzeStudentManuscript({
      ...INITIAL_STUDIO_DRAFT,
      ...basePreset.draftPreset,
      extraSpreads: [
        {
          id: "extra-1",
          leftTitle: "Lembar Tambahan 1A",
          rightTitle: "Lembar Tambahan 1B",
          leftText: "Damar kembali melangkah di lorong yang sunyi.",
          rightText: "Cahaya jam saku itu kini padam dengan tenang.",
        },
      ],
    });

    expect(withExtra.totalWords).toBeGreaterThan(withoutExtra.totalWords);
  });

  it("tracks komplikasiWords separately and blocks isReadyForSeal while isModelPresetReference is true", () => {
    const basePreset = STORY_SEED_PRESETS[0]!;
    const modelRefResult = analyzeStudentManuscript({
      ...INITIAL_STUDIO_DRAFT,
      ...basePreset.draftPreset,
      isModelPresetReference: true,
      selfRevisionChecks: {
        "rev-struktur": true,
        "rev-aturan": true,
        "rev-watak-indera": true,
        "rev-majas-dialog": true,
        "rev-eyd": true,
      },
    });

    expect(modelRefResult.komplikasiWords).toBeGreaterThan(10);
    expect(modelRefResult.isModelPresetReference).toBe(true);
    expect(modelRefResult.isReadyForSeal).toBe(false);
  });

  it("rejects non-metaphor 'seperti biasa', substring non-sensory words, empty komplikasi, and unfilled [...] scaffold blanks", () => {
    const flawedDraft = {
      ...INITIAL_STUDIO_DRAFT,
      themeCategory: "Kerajaan Kucing Mekanik Bawah Tanah",
      storyTitle: "Misteri Gerbang Besi",
      worldRule: "Setiap jam berdentang dua kali, pintu besi hanya terbuka bagi yang jujur.",
      protagonistName: "Bima",
      antagonistName: "Ratu Besi",
      settingPlace: "Kota Gear",
      paragraphOrientasi:
        "Di Kota Gear, Bima berjalan seperti biasa melewati keramaian yang baur dan serupa sambil mengusap keringat di dahi.",
      paragraphKomplikasi: "",
      paragraphKlimaks:
        'Ratu Besi berkata, "[Tulis ucapan langsung di sini!]" Bima segera berlari keatas menara menuju mahluk lembab itu.',
      paragraphResolusi:
        "Akhirnya Bima menjelaskan bahwa ia berpesan agar semua penduduk menjaga mesin kota dengan jujur.",
      amanat: "Kejujuran lebih kuat dari kecurangan dalam keadaan sulit.",
      selfRevisionChecks: {
        "rev-struktur": true,
        "rev-aturan": true,
        "rev-watak-indera": true,
        "rev-majas-dialog": true,
        "rev-eyd": true,
      },
    };

    const result = analyzeStudentManuscript(flawedDraft);
    const struktur = result.indicators.find((i) => i.id === "struktur");
    const indera = result.indicators.find((i) => i.id === "konsistensi_indera");
    const majas = result.indicators.find((i) => i.id === "majas_asosiasi");
    const takLangsung = result.indicators.find((i) => i.id === "tak_langsung_konjungsi");

    expect(struktur?.passed).toBe(false);
    expect(indera?.passed).toBe(false);
    expect(majas?.passed).toBe(false);
    expect(takLangsung?.passed).toBe(true);
    expect(result.unfilledPlaceholderCount).toBe(1);
    expect(result.isReadyForSeal).toBe(false);
    expect(result.eydAndLexiconIssues.some((i) => i.id === "eyd-ke-atas")).toBe(true);
    expect(result.eydAndLexiconIssues.some((i) => i.id === "lex-mahluk")).toBe(true);
    expect(result.eydAndLexiconIssues.some((i) => i.id === "lex-lembab")).toBe(true);
  });
});
