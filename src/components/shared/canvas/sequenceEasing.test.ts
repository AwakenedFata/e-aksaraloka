import { describe, expect, it } from "vitest";
import {
  calculateAutoplayDurationMs,
  computeHeroExitProgress,
  easeSmoothCruise,
  frameToScrollY,
  scrollYToFrame,
} from "./sequenceEasing";

describe("easeSmoothCruise", () => {
  it("hits exact boundary endpoints and symmetry", () => {
    expect(easeSmoothCruise(-0.2)).toBe(0);
    expect(easeSmoothCruise(0)).toBe(0);
    expect(easeSmoothCruise(0.5)).toBeCloseTo(0.5, 6);
    expect(easeSmoothCruise(1)).toBe(1);
    expect(easeSmoothCruise(1.4)).toBe(1);

    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      expect(easeSmoothCruise(t) + easeSmoothCruise(1 - t)).toBeCloseTo(1, 6);
    }
  });

  it("is monotonically increasing and caps peak velocity near 1.25x instead of cosine 1.57x", () => {
    const dt = 0.001;
    let prev = easeSmoothCruise(0);
    let maxVelocity = 0;

    for (let step = 1; step <= 1000; step++) {
      const t = step * dt;
      const cur = easeSmoothCruise(t);
      expect(cur).toBeGreaterThanOrEqual(prev);
      const velocity = (cur - prev) / dt;
      if (velocity > maxVelocity) maxVelocity = velocity;
      prev = cur;
    }

    expect(maxVelocity).toBeCloseTo(1.25, 2);
    expect(maxVelocity).toBeLessThan(1.27);
  });
});

describe("scrollYToFrame & frameToScrollY roundtrips", () => {
  it("roundtrips hero frames across both exit phase (1-50) and tail phase (50-240)", () => {
    const scrollable = 1500;
    for (const frame of [1, 15, 30, 50, 120, 200, 240]) {
      const y = frameToScrollY("hero", frame, scrollable, 240, 50);
      const back = scrollYToFrame("hero", y, scrollable, 240, 50);
      expect(back).toBeCloseTo(frame, 4);
    }
  });

  it("roundtrips materi and reading frames cleanly", () => {
    const scrollable = 2500;
    for (const frame of [1, 75, 150, 299]) {
      const y = frameToScrollY("materi", frame, scrollable, 299);
      expect(scrollYToFrame("materi", y, scrollable, 299)).toBeCloseTo(frame, 4);
    }
    for (const frame of [1, 180, 360, 537]) {
      const y = frameToScrollY("reading", frame, scrollable, 537);
      expect(scrollYToFrame("reading", y, scrollable, 537)).toBeCloseTo(frame, 4);
    }
  });
});

describe("computeHeroExitProgress & calculateAutoplayDurationMs", () => {
  it("computes clamped exit progress between exit bounds", () => {
    expect(computeHeroExitProgress(1, 20, 50)).toBe(0);
    expect(computeHeroExitProgress(20, 20, 50)).toBe(0);
    expect(computeHeroExitProgress(35, 20, 50)).toBeCloseTo(0.5, 6);
    expect(computeHeroExitProgress(50, 20, 50)).toBe(1);
    expect(computeHeroExitProgress(120, 20, 50)).toBe(1);
  });

  it("scales duration proportionally with minimum clamp", () => {
    expect(calculateAutoplayDurationMs(1, 240, 240, 4800, 750)).toBe(4800);
    expect(calculateAutoplayDurationMs(220, 240, 240, 4800, 750)).toBe(750);
    expect(calculateAutoplayDurationMs(150, 1, 299, 4400, 1600)).toBeGreaterThanOrEqual(2100);
  });
});
