import { describe, expect, it } from "vitest";
import {
  buildPageDisplacementSpec,
  computeCoverStageMetrics,
  computeEffectiveCoverStageMetrics,
  computeHomographyMatrix3d,
  computeMobile3dCameraTransform,
  computeSpreadQuadProjection,
  evaluatePageArchOffsetPx,
  hasSignificantPageCurve,
  READING_2D_DEFAULT_CALIBRATION,
  READING_BOOK_DEFAULT_CALIBRATION,
  STUDIO_BOOK_DEFAULT_CALIBRATION,
  type Quad2D,
} from "./bookHomography";

function parseMatrix3d(str: string): number[] {
  const inner = str.replace(/^matrix3d\(/, "").replace(/\)$/, "");
  return inner.split(",").map((part) => Number(part.trim()));
}

function projectPoint(m: readonly number[], x: number, y: number): [number, number] {
  // Column-major 4x4 projection of (x, y, 0, 1)
  const xp = m[0]! * x + m[4]! * y + m[12]!;
  const yp = m[1]! * x + m[5]! * y + m[13]!;
  const wp = m[3]! * x + m[7]! * y + m[15]!;
  return [xp / wp, yp / wp];
}

describe("computeHomographyMatrix3d", () => {
  it("projects all four corners to arbitrary trapezoidal coordinates cleanly", () => {
    const w = 480;
    const h = 660;
    const target: Quad2D = [
      [418, 210],
      [875, 240],
      [871, 888],
      [318, 876],
    ];

    const css = computeHomographyMatrix3d(w, h, target);
    expect(css.startsWith("matrix3d(")).toBe(true);

    const m = parseMatrix3d(css);
    expect(m).toHaveLength(16);

    const projected = [
      projectPoint(m, 0, 0),
      projectPoint(m, w, 0),
      projectPoint(m, w, h),
      projectPoint(m, 0, h),
    ];

    for (let i = 0; i < 4; i++) {
      expect(projected[i]![0]).toBeCloseTo(target[i]![0], 2);
      expect(projected[i]![1]).toBeCloseTo(target[i]![1], 2);
    }
  });

  it("returns 'none' safely on degenerate widths or collinear target corners", () => {
    expect(
      computeHomographyMatrix3d(0, 500, [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ])
    ).toBe("none");

    expect(
      computeHomographyMatrix3d(400, 500, [
        [0, 0],
        [100, 0],
        [200, 0],
        [300, 0],
      ])
    ).toBe("none");
  });
});

describe("computeCoverStageMetrics", () => {
  it("matches centered object-fit: cover geometry for 16:10 viewports", () => {
    const metrics = computeCoverStageMetrics(1440, 900, 1920, 1080);
    expect(metrics.height).toBeCloseTo(900, 3);
    expect(metrics.width).toBeCloseTo(1600, 3);
    expect(metrics.offsetX).toBeCloseTo(-80, 3);
    expect(metrics.offsetY).toBeCloseTo(0, 3);
  });

  it("matches centered object-fit: cover geometry for ultrawide 21:9 viewports", () => {
    const metrics = computeCoverStageMetrics(2560, 1080, 1920, 1080);
    expect(metrics.width).toBeCloseTo(2560, 3);
    expect(metrics.height).toBeCloseTo(1440, 3);
    expect(metrics.offsetX).toBeCloseTo(0, 3);
    expect(metrics.offsetY).toBeCloseTo(-180, 3);
  });
});

describe("page arch curvature & SVG displacement spec", () => {
  it("models upward arch belly and downward plunge at central spine on both pages", () => {
    const leftOuter = evaluatePageArchOffsetPx("left", 0, READING_BOOK_DEFAULT_CALIBRATION.leftCurve);
    const leftBelly = evaluatePageArchOffsetPx("left", 0.45, READING_BOOK_DEFAULT_CALIBRATION.leftCurve);
    const leftSpine = evaluatePageArchOffsetPx("left", 1, READING_BOOK_DEFAULT_CALIBRATION.leftCurve);
    expect(leftBelly).toBeGreaterThan(leftOuter);
    expect(leftSpine).toBeLessThan(leftOuter);

    const rightSpine = evaluatePageArchOffsetPx("right", 0, READING_BOOK_DEFAULT_CALIBRATION.rightCurve);
    const rightBelly = evaluatePageArchOffsetPx("right", 0.55, READING_BOOK_DEFAULT_CALIBRATION.rightCurve);
    const rightOuter = evaluatePageArchOffsetPx("right", 1, READING_BOOK_DEFAULT_CALIBRATION.rightCurve);
    expect(rightBelly).toBeGreaterThan(rightOuter);
    expect(rightSpine).toBeLessThan(rightOuter);

    const twoDLeftBelly = evaluatePageArchOffsetPx("left", 0.5, READING_2D_DEFAULT_CALIBRATION.leftCurve);
    const twoDLeftSpine = evaluatePageArchOffsetPx("left", 1, READING_2D_DEFAULT_CALIBRATION.leftCurve);
    expect(twoDLeftBelly).toBe(0);
    expect(twoDLeftSpine).toBe(0);
    expect(READING_2D_DEFAULT_CALIBRATION.leftQuadNorm[0][1]).toBe(
      READING_2D_DEFAULT_CALIBRATION.leftQuadNorm[1][1]
    );
    expect(READING_2D_DEFAULT_CALIBRATION.rightQuadNorm[2][1]).toBe(
      READING_2D_DEFAULT_CALIBRATION.rightQuadNorm[3][1]
    );
  });

  it("encodes valid sRGB linearGradient SVG data URI with neutral R=128", () => {
    const spec = buildPageDisplacementSpec("left", READING_BOOK_DEFAULT_CALIBRATION.leftCurve, 1);
    expect(spec.filterScale).toBeGreaterThanOrEqual(2);
    expect(spec.dataUri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const decoded = decodeURIComponent(spec.dataUri.replace("data:image/svg+xml;utf8,", ""));
    expect(decoded).toContain("rgb(128,");
    expect(decoded).toContain("<linearGradient");
  });

  it("provides valid Studio Tulis 3D calibration and shared spread projection helper", () => {
    expect(hasSignificantPageCurve(STUDIO_BOOK_DEFAULT_CALIBRATION.leftCurve)).toBe(true);
    expect(hasSignificantPageCurve(READING_2D_DEFAULT_CALIBRATION.leftCurve)).toBe(false);

    const studioBelly = evaluatePageArchOffsetPx("left", 0.45, STUDIO_BOOK_DEFAULT_CALIBRATION.leftCurve);
    const studioSpine = evaluatePageArchOffsetPx("left", 1, STUDIO_BOOK_DEFAULT_CALIBRATION.leftCurve);
    expect(studioBelly).toBeGreaterThan(0);
    expect(studioSpine).toBeLessThan(0);

    const proj3d = computeSpreadQuadProjection({
      stageWidth: 1920,
      stageHeight: 1080,
      baseLeftWidth: 273,
      baseRightWidth: 273,
      baseHeight: 283,
      curveScale: 1,
      calibration: STUDIO_BOOK_DEFAULT_CALIBRATION,
    });
    expect(proj3d.leftMatrixCss.startsWith("matrix3d(")).toBe(true);
    expect(proj3d.rightMatrixCss.startsWith("matrix3d(")).toBe(true);
    expect(proj3d.hasLeftCurve).toBe(true);
    expect(proj3d.hasRightCurve).toBe(true);
  });
});

describe("mobile 3D portrait-first camera framing", () => {
  it("keeps desktop, tablet, and landscape viewports untouched at identity transform", () => {
    expect(computeMobile3dCameraTransform(1280, 720, "kitab-left").active).toBe(false);
    expect(computeMobile3dCameraTransform(844, 390, "studio").active).toBe(false);
    expect(computeMobile3dCameraTransform(768, 1024, "kitab-right").active).toBe(false);
    expect(computeMobile3dCameraTransform(390, 844, "none").active).toBe(false);
  });

  it("frames both pages of Studio Tulis 3D and single pages of Kitab 3D fully inside mobile portrait without clipping", () => {
    const viewports: readonly [number, number][] = [
      [390, 844],
      [375, 667],
      [360, 780],
    ];

    for (const [vw, vh] of viewports) {
      const studioCam = computeMobile3dCameraTransform(vw, vh, "studio");
      expect(studioCam.active).toBe(true);
      const studioStage = computeEffectiveCoverStageMetrics(vw, vh, studioCam);
      const studioLeftX =
        studioStage.offsetX + STUDIO_BOOK_DEFAULT_CALIBRATION.leftQuadNorm[3][0] * studioStage.width;
      const studioRightX =
        studioStage.offsetX + STUDIO_BOOK_DEFAULT_CALIBRATION.rightQuadNorm[2][0] * studioStage.width;
      const studioTopY =
        studioStage.offsetY + STUDIO_BOOK_DEFAULT_CALIBRATION.rightQuadNorm[1][1] * studioStage.height;
      const studioBottomY =
        studioStage.offsetY + STUDIO_BOOK_DEFAULT_CALIBRATION.leftQuadNorm[3][1] * studioStage.height;

      expect(studioLeftX).toBeGreaterThanOrEqual(0);
      expect(studioRightX).toBeLessThanOrEqual(vw);
      expect(studioTopY).toBeGreaterThanOrEqual(90);
      expect(studioBottomY).toBeLessThanOrEqual(vh - 150);

      const kitabLeftCam = computeMobile3dCameraTransform(vw, vh, "kitab-left");
      const kitabRightCam = computeMobile3dCameraTransform(vw, vh, "kitab-right");
      expect(kitabLeftCam.zoom).toBeCloseTo(kitabRightCam.zoom, 6);

      const leftStage = computeEffectiveCoverStageMetrics(vw, vh, kitabLeftCam);
      expect(
        leftStage.offsetX + READING_BOOK_DEFAULT_CALIBRATION.leftQuadNorm[3][0] * leftStage.width
      ).toBeGreaterThanOrEqual(0);
      expect(
        leftStage.offsetX + READING_BOOK_DEFAULT_CALIBRATION.leftQuadNorm[1][0] * leftStage.width
      ).toBeLessThanOrEqual(vw);

      const rightStage = computeEffectiveCoverStageMetrics(vw, vh, kitabRightCam);
      expect(
        rightStage.offsetX + READING_BOOK_DEFAULT_CALIBRATION.rightQuadNorm[3][0] * rightStage.width
      ).toBeGreaterThanOrEqual(0);
      expect(
        rightStage.offsetX + READING_BOOK_DEFAULT_CALIBRATION.rightQuadNorm[2][0] * rightStage.width
      ).toBeLessThanOrEqual(vw);
    }
  });
});
