import { describe, expect, it, vi } from "vitest";
import { FANTASY_LEXICON_BANK } from "./narrativeCurriculumData";
import {
  buildDynamicSentenceFrame,
  rollFantasyIdeaRecipe,
  type SentenceFrameGroupId,
} from "./creativeScaffolding";
import { INITIAL_STUDIO_DRAFT, analyzeStudentManuscript } from "./literaryDetector";

describe("Layer 1 Offline Creative Scaffolding Engine", () => {
  it("provides 6 rich lexicon categories with 48 curated entries spanning Denotatif, Konotatif, and Kiasan / Majas", () => {
    expect(FANTASY_LEXICON_BANK).toHaveLength(6);
    const allEntries = FANTASY_LEXICON_BANK.flatMap((cat) => cat.entries);
    expect(allEntries.length).toBe(48);

    const types = new Set(allEntries.map((e) => e.type));
    expect(types.has("Denotatif")).toBe(true);
    expect(types.has("Konotatif")).toBe(true);
    expect(types.has("Kiasan / Majas")).toBe(true);
  });

  it("rolls complete combinatorial fantasy idea recipes deterministically when seeded", () => {
    const r1 = rollFantasyIdeaRecipe(1);
    const r2 = rollFantasyIdeaRecipe(2);

    expect(r1.themeLabel.length).toBeGreaterThan(5);
    expect(r1.protagonistName.length).toBeGreaterThan(2);
    expect(r1.worldRule.length).toBeGreaterThan(15);
    expect(r1.sensoryHint.sight.length).toBeGreaterThan(10);
    expect(r1.themeLabel).not.toBe(r2.themeLabel);
  });

  it("generates varied multi-pattern sentence frames adapted to custom student themes while preserving [...] anti-cheat blanks", () => {
    const ctx = {
      protagonistName: "Lina",
      antagonistName: "Raja Karang",
      settingPlace: "Pasar Bawah Laut",
      themeCategory: "Kerajaan Ubur-Ubur Bercahaya",
    };

    const groups: readonly SentenceFrameGroupId[] = [
      "komplikasi_waktu",
      "majas_asosiasi",
      "dialog_langsung",
      "tak_langsung_akhir",
    ];

    for (const group of groups) {
      const first = buildDynamicSentenceFrame(group, 0, ctx);
      const second = buildDynamicSentenceFrame(group, 1, ctx);
      expect(first.totalPatterns).toBe(4);
      expect(first.text).not.toBe(second.text);
      expect(first.text).toMatch(/\[[^\]\n]{3,110}\]/);
      expect(second.text).toMatch(/\[[^\]\n]{3,110}\]/);
    }

    // Verify inserting all 4 raw frames CANNOT cheat isReadyForSeal because [...] blanks remain unfilled
    const withFramesOnly = analyzeStudentManuscript({
      ...INITIAL_STUDIO_DRAFT,
      themeCategory: ctx.themeCategory,
      storyTitle: "Pasar Karang",
      worldRule: "Cahaya karang hanya menyala bagi anak yang jujur.",
      protagonistName: ctx.protagonistName,
      antagonistName: ctx.antagonistName,
      settingPlace: ctx.settingPlace,
      paragraphKomplikasi: buildDynamicSentenceFrame("komplikasi_waktu", 0, ctx).text,
      paragraphKlimaks:
        buildDynamicSentenceFrame("majas_asosiasi", 0, ctx).text +
        buildDynamicSentenceFrame("dialog_langsung", 0, ctx).text,
      paragraphResolusi: buildDynamicSentenceFrame("tak_langsung_akhir", 0, ctx).text,
      amanat: "Kejujuran selalu menang atas keserakahan.",
    });

    expect(withFramesOnly.unfilledPlaceholderCount).toBeGreaterThanOrEqual(4);
    expect(withFramesOnly.isReadyForSeal).toBe(false);
    vi.restoreAllMocks();
  });
});
