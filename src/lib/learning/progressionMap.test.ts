import { describe, expect, it } from "vitest";
import {
  INITIAL_LEARNING_STATE,
  computeCompetencyMetrics,
  recomputeSeals,
} from "./learningStore";
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
});
