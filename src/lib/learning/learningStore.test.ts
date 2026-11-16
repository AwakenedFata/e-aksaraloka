import { describe, expect, it } from "vitest";
import {
  INITIAL_LEARNING_STATE,
  computeCompetencyMetrics,
  recomputeSeals,
} from "./learningStore";
import { STORY_SEED_PRESETS } from "./literaryDetector";

describe("learningStore & competency metrics", () => {
  it("starts with 0% competency and 0 unlocked seals", () => {
    const metrics = computeCompetencyMetrics(INITIAL_LEARNING_STATE);
    expect(metrics.babak1Score).toBe(0);
    expect(metrics.babak2Score).toBe(0);
    expect(metrics.babak3Score).toBe(0);
    expect(metrics.babak4Score).toBe(0);
    expect(metrics.questScore).toBe(0);
    expect(metrics.overallPercentage).toBe(0);
    expect(metrics.unlockedSealsCount).toBe(0);
  });

  it("unlocks Seal I (Kompas Waktu) when all 5 plot beats, climax simulation, and amanat are solved", () => {
    const solvedBabak1 = recomputeSeals({
      ...INITIAL_LEARNING_STATE,
      plotPlacedIds: [
        "beat-orientasi",
        "beat-pemantik",
        "beat-komplikasi",
        "beat-klimaks",
        "beat-resolusi",
      ],
      climaxSimulationTested: true,
      selectedAmanatId: "amanat-b",
    });

    expect(solvedBabak1.sealAlurUnlocked).toBe(true);
    const metrics = computeCompetencyMetrics(solvedBabak1);
    expect(metrics.babak1Score).toBe(100);
    expect(metrics.unlockedSealsCount).toBe(1);
  });

  it("unlocks all 3 seals + Studio seal and reaches Sangat Mahir (81-100%) when all challenges and manuscript are solved", () => {
    const seed = STORY_SEED_PRESETS[0]!;
    const fullState = recomputeSeals({
      ...INITIAL_LEARNING_STATE,
      plotPlacedIds: [
        "beat-orientasi",
        "beat-pemantik",
        "beat-komplikasi",
        "beat-klimaks",
        "beat-resolusi",
      ],
      climaxSimulationTested: true,
      selectedAmanatId: "amanat-b",
      characterEvidenceAnswers: {
        "char-mao": "mao-opt-1",
        "char-yari": "yari-opt-2",
      },
      pouchOrderIds: ["biji-timun", "jarum", "garam", "terasi"],
      sensoryUpgradeAnswers: {
        "sens-1": "s1-a",
        "sens-2": "s2-b",
        "sens-3": "s3-a",
      },
      majasAnswers: {
        "majas-1": { connector: "bagaikan", comparison: "minyak dan air" },
        "majas-2": { connector: "laksana", comparison: "oase di padang pasir" },
        "majas-3": { connector: "seperti", comparison: "anak panah" },
      },
      dialogueAnswers: {
        "dlg-1": "dlg-1-b",
        "dlg-2": "dlg-2-a",
      },
      questAnswers: {
        "quest-ide": "q1-a",
        "quest-logika": "q2-a",
        "quest-eyd": "q3-a",
      },
      studioDraft: {
        ...INITIAL_LEARNING_STATE.studioDraft,
        ...seed.draftPreset,
        selfRevisionChecks: {
          "rev-struktur": true,
          "rev-aturan": true,
          "rev-watak-indera": true,
          "rev-majas-dialog": true,
          "rev-eyd": true,
        },
      },
    });

    expect(fullState.sealAlurUnlocked).toBe(true);
    expect(fullState.sealWatakUnlocked).toBe(true);
    expect(fullState.sealBahasaUnlocked).toBe(true);
    expect(fullState.sealStudioUnlocked).toBe(true);

    const metrics = computeCompetencyMetrics(fullState);
    expect(metrics.babak1Score).toBe(100);
    expect(metrics.babak2Score).toBe(100);
    expect(metrics.babak3Score).toBe(100);
    expect(metrics.babak4Score).toBe(100);
    expect(metrics.questScore).toBe(100);
    expect(metrics.overallPercentage).toBe(100);
    expect(metrics.holisticTotalPercentage).toBe(100);
    expect(metrics.unlockedSealsCount).toBe(3);
    expect(metrics.kelayakanCategory).toContain("Sangat Mahir");
  });
});
