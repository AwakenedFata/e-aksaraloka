import { describe, expect, it } from "vitest";
import {
  INITIAL_LEARNING_STATE,
  computeCompetencyMetrics,
  recomputeSeals,
} from "./learningStore";
import { STORY_SEED_PRESETS } from "./literaryDetector";
import {
  MAP_CANVAS_HEIGHT,
  MAP_CANVAS_WIDTH,
  buildProgressionMapModel,
  getMapNodeIdForTpDestination,
} from "./progressionMap";

describe("Astrolab Overworld Progression Map model", () => {
  it("keeps all 4 realm nodes + quest hub unlocked/accessible even at 0% progress", () => {
    const metrics = computeCompetencyMetrics(INITIAL_LEARNING_STATE);
    const model = buildProgressionMapModel(INITIAL_LEARNING_STATE, metrics);

    expect(model.nodes).toHaveLength(5);
    expect(model.recommendedNodeId).toBe("babak-1");
    expect(model.nodes[0]?.isRecommendedNext).toBe(true);

    for (const node of model.nodes) {
      expect(node.xPct).toBeGreaterThan(0);
      expect(node.xPct).toBeLessThan(100);
      expect(node.yPct).toBeGreaterThan(0);
      expect(node.yPct).toBeLessThan(100);
      expect(["completed", "in_progress", "ready"]).toContain(node.status);
    }
    expect(MAP_CANVAS_WIDTH).toBe(1376);
    expect(MAP_CANVAS_HEIGHT).toBe(768);
  });

  it("advances recommended next stop and completed route segments sequentially as seals open", () => {
    const afterBabak1 = recomputeSeals({
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

    const metrics = computeCompetencyMetrics(afterBabak1);
    const model = buildProgressionMapModel(afterBabak1, metrics);

    expect(model.recommendedNodeId).toBe("babak-2");
    expect(model.nodes.find((n) => n.id === "babak-1")?.status).toBe("completed");
    expect(model.nodes.find((n) => n.id === "babak-2")?.isRecommendedNext).toBe(true);
    expect(model.segments.find((s) => s.id === "seg-1-2")?.isCompleted).toBe(true);
    expect(model.segments.find((s) => s.id === "seg-1-2")?.isActiveNext).toBe(true);
  });

  it("maps curriculum TP destinations to their exact progression node IDs", () => {
    expect(getMapNodeIdForTpDestination("alur")).toBe("babak-1");
    expect(getMapNodeIdForTpDestination("watak")).toBe("babak-2");
    expect(getMapNodeIdForTpDestination("bahasa")).toBe("babak-3");
    expect(getMapNodeIdForTpDestination("studio")).toBe("babak-4");
  });

  it("recommends quest-hub once all 3 Materi seals and Studio seal are unlocked while bonus quests remain", () => {
    const seed = STORY_SEED_PRESETS[0]!;
    const completedMainWithoutQuests = recomputeSeals({
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
      studioDraft: {
        ...INITIAL_LEARNING_STATE.studioDraft,
        ...seed.draftPreset,
        selfRevisionChecks: {
          "rev-struktur": true,
          "rev-aturan": true,
          "rev-watak-Indera": true,
          "rev-majas-dialog": true,
          "rev-eyd": true,
        },
      },
    });

    const metrics = computeCompetencyMetrics(completedMainWithoutQuests);
    const model = buildProgressionMapModel(completedMainWithoutQuests, metrics);
    expect(model.recommendedNodeId).toBe("quest-hub");
    expect(model.nodes.find((n) => n.id === "quest-hub")?.isRecommendedNext).toBe(true);
  });
});
