export type SequenceType = "hero" | "materi" | "reading" | "latihan";

export const HERO_EXIT_SCROLL_RATIO = 0.28;

/**
 * Smooth C1-continuous ease-in -> steady linear cruise -> ease-out curve.
 *
 * Ramp ratio = 0.20 means:
 * - First 20% smoothly accelerates from 0 to cruise speed (cosine ramp)
 * - Middle 60% moves at dead-constant velocity (1.25x average)
 * - Final 20% smoothly decelerates back to 0 (cosine ramp)
 *
 * Compared to pure cosine ease (peak 1.571x) or cubic ease (peak 1.50x),
 * capping peak speed at 1.25x keeps 60 Hz display cadence uniform with
 * minimal frame-skipping judder during button-triggered cutscenes.
 */
const DEFAULT_RAMP_RATIO = 0.2;

function evaluateRampIntegral(u: number, ramp: number, vCruise: number): number {
  if (u <= 0) return 0;
  return vCruise * (u / 2 - (ramp / (2 * Math.PI)) * Math.sin((Math.PI * u) / ramp));
}

export function easeSmoothCruise(t: number, rampRatio: number = DEFAULT_RAMP_RATIO): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 0) return 0;
  if (clamped === 1) return 1;

  const ramp = Math.max(0.05, Math.min(0.49, rampRatio));
  const vCruise = 1 / (1 - ramp);

  if (clamped < ramp) {
    return evaluateRampIntegral(clamped, ramp, vCruise);
  }

  const rampDisplacement = vCruise * (ramp / 2);
  if (clamped <= 1 - ramp) {
    return rampDisplacement + vCruise * (clamped - ramp);
  }

  const remaining = 1 - clamped;
  return 1 - evaluateRampIntegral(remaining, ramp, vCruise);
}

/**
 * Maps DOM scrollY within the active sequence's scroll track to a continuous frame index.
 */
export function scrollYToFrame(
  sequence: SequenceType,
  scrollY: number,
  scrollableHeight: number,
  totalFrames: number,
  heroMaxFrame: number = 50
): number {
  const maxFrames = Math.max(1, totalFrames);
  if (maxFrames === 1) return 1;

  const safeScrollable = Math.max(1, scrollableHeight);
  const clampedY = Math.max(0, Math.min(safeScrollable, scrollY));

  if (sequence === "hero") {
    const clampedHeroMax = Math.max(2, Math.min(maxFrames, heroMaxFrame));
    const heroExitScroll = safeScrollable * HERO_EXIT_SCROLL_RATIO;

    if (clampedY <= heroExitScroll) {
      const exitProgress = heroExitScroll > 0 ? clampedY / heroExitScroll : 1;
      return 1 + exitProgress * (clampedHeroMax - 1);
    }

    const tailSpan = Math.max(1, safeScrollable - heroExitScroll);
    const tailProgress = Math.min(1, Math.max(0, (clampedY - heroExitScroll) / tailSpan));
    return clampedHeroMax + tailProgress * (maxFrames - clampedHeroMax);
  }

  const progress = clampedY / safeScrollable;
  return 1 + progress * (maxFrames - 1);
}

/**
 * Exact inverse of `scrollYToFrame` for syncing DOM scroll position cleanly
 * after direct-frame auto-playback completes or is interrupted.
 */
export function frameToScrollY(
  sequence: SequenceType,
  frame: number,
  scrollableHeight: number,
  totalFrames: number,
  heroMaxFrame: number = 50
): number {
  const maxFrames = Math.max(1, totalFrames);
  const safeScrollable = Math.max(0, scrollableHeight);
  if (maxFrames === 1 || safeScrollable === 0) return 0;

  const clampedFrame = Math.max(1, Math.min(maxFrames, frame));

  if (sequence === "hero") {
    const clampedHeroMax = Math.max(2, Math.min(maxFrames, heroMaxFrame));
    const heroExitScroll = safeScrollable * HERO_EXIT_SCROLL_RATIO;

    if (clampedFrame <= clampedHeroMax) {
      const exitProgress = (clampedFrame - 1) / Math.max(1, clampedHeroMax - 1);
      return exitProgress * heroExitScroll;
    }

    const tailProgress = (clampedFrame - clampedHeroMax) / Math.max(1, maxFrames - clampedHeroMax);
    return heroExitScroll + tailProgress * (safeScrollable - heroExitScroll);
  }

  const progress = (clampedFrame - 1) / (maxFrames - 1);
  return progress * safeScrollable;
}

/**
 * Computes Hero UI exit progress [0, 1] directly from frame index.
 */
export function computeHeroExitProgress(
  frame: number,
  exitStartFrame: number = 20,
  exitEndFrame: number = 50
): number {
  if (exitEndFrame <= exitStartFrame) return frame >= exitEndFrame ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - exitStartFrame) / (exitEndFrame - exitStartFrame)));
}

/**
 * Computes distance-proportional animation duration (ms) when starting from mid-sequence.
 */
export function calculateAutoplayDurationMs(
  startFrame: number,
  targetFrame: number,
  totalFrames: number,
  fullDurationMs: number,
  minDurationMs: number
): number {
  const span = Math.max(1, totalFrames - 1);
  const distanceRatio = Math.min(1, Math.abs(targetFrame - startFrame) / span);
  return Math.max(minDurationMs, Math.round(distanceRatio * fullDurationMs));
}
