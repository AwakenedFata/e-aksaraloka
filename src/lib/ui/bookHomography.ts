export type Point2D = readonly [number, number];

/**
 * Quad corners ordered clockwise starting from top-left:
 * [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export type Quad2D = readonly [Point2D, Point2D, Point2D, Point2D];

export interface BookPageCurveParams {
  /** Maximum upward arch at the belly of the page (CSS px at 1080p baseline). */
  readonly archLiftPx: number;
  /** Downward fold plunge into the central book gutter spine (CSS px at 1080p baseline). */
  readonly spineDipPx: number;
  /** Gentle downward droop at the outer page edge (CSS px at 1080p baseline). */
  readonly outerDropPx: number;
}

export interface BookSpreadCalibration {
  /** Normalized [0..1] coordinates in 1920x1080 cover-stage space for the left page. */
  readonly leftQuadNorm: Quad2D;
  /** Normalized [0..1] coordinates in 1920x1080 cover-stage space for the right page. */
  readonly rightQuadNorm: Quad2D;
  /** Surface arch/gutter curvature applied per page along the horizontal page axis. */
  readonly leftCurve: BookPageCurveParams;
  readonly rightCurve: BookPageCurveParams;
}

export interface CoverStageMetrics {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

export const STAGE_SOURCE_WIDTH = 1920;
export const STAGE_SOURCE_HEIGHT = 1080;

/**
 * Baseline calibration empirically measured on `reading-frames/frame-537.webp` (1920x1080).
 * Coordinates represent inner typographic parchment bounds [TL, TR, BR, BL] clearing
 * outer leather/page rims, spine shadow gutter, and bottom thumb contours.
 */
export const READING_BOOK_DEFAULT_CALIBRATION: BookSpreadCalibration = {
  leftQuadNorm: [
    [0.218, 0.194],
    [0.456, 0.222],
    [0.454, 0.816],
    [0.172, 0.804],
  ],
  rightQuadNorm: [
    [0.512, 0.222],
    [0.752, 0.204],
    [0.764, 0.804],
    [0.510, 0.816],
  ],
  leftCurve: {
    archLiftPx: 11,
    spineDipPx: 12,
    outerDropPx: 2,
  },
  rightCurve: {
    archLiftPx: 10,
    spineDipPx: 11,
    outerDropPx: 4,
  },
};

/**
 * Baseline calibration for Mode 2D (`book-base.webp` + `single-page.webp` inside 946:603 container).
 * Respects the orthographic flat-lay geometry of `single-page.webp` (spine fold at x = 0.4905)
 * with parallel vertical bounds so dense copy, inputs, selects, and scrollbars stay upright and symmetric
 * while still supporting live corner & curve tuning via the In-App Calibrator.
 */
export const READING_2D_DEFAULT_CALIBRATION: BookSpreadCalibration = {
  leftQuadNorm: [
    [0.086, 0.050],
    [0.474, 0.050],
    [0.474, 0.946],
    [0.086, 0.946],
  ],
  rightQuadNorm: [
    [0.507, 0.050],
    [0.912, 0.050],
    [0.912, 0.946],
    [0.507, 0.946],
  ],
  leftCurve: {
    archLiftPx: 0,
    spineDipPx: 0,
    outerDropPx: 0,
  },
  rightCurve: {
    archLiftPx: 0,
    spineDipPx: 0,
    outerDropPx: 0,
  },
};

/**
 * Baseline calibration empirically measured on `studio-tulis-frames/frame-188.webp` (1920x1080).
 * Coordinates represent inner typographic parchment bounds [TL, TR, BR, BL] on the open desk
 * codex following true trapezoidal perspective, outward page fan, spine crease slant (0.487 -> 0.505),
 * and deep physical gull-wing page belly & spine plunge curvature.
 */
export const STUDIO_BOOK_DEFAULT_CALIBRATION: BookSpreadCalibration = {
  leftQuadNorm: [
    [0.337, 0.492],
    [0.476, 0.480],
    [0.493, 0.748],
    [0.314, 0.758],
  ],
  rightQuadNorm: [
    [0.500, 0.477],
    [0.638, 0.474],
    [0.666, 0.728],
    [0.517, 0.743],
  ],
  leftCurve: {
    archLiftPx: 16,
    spineDipPx: 19,
    outerDropPx: 5,
  },
  rightCurve: {
    archLiftPx: 16,
    spineDipPx: 19,
    outerDropPx: 5,
  },
};

export function hasSignificantPageCurve(curve: BookPageCurveParams): boolean {
  return (
    Math.max(
      Math.abs(curve.archLiftPx),
      Math.abs(curve.spineDipPx),
      Math.abs(curve.outerDropPx)
    ) > 0.1
  );
}

export interface SpreadQuadProjection {
  readonly leftMatrixCss: string;
  readonly rightMatrixCss: string;
  readonly leftDisp: PageDisplacementSpec;
  readonly rightDisp: PageDisplacementSpec;
  readonly hasLeftCurve: boolean;
  readonly hasRightCurve: boolean;
  readonly leftFilterPad: number;
  readonly rightFilterPad: number;
}

/**
 * Shared projection + SVG curvature builder for left/right spread quads so both
 * Kitab Materi and Studio Tulis compute identical homography and filter padding consistently.
 */
export function computeSpreadQuadProjection(params: {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly baseLeftWidth: number;
  readonly baseRightWidth: number;
  readonly baseHeight: number;
  readonly curveScale: number;
  readonly calibration: BookSpreadCalibration;
}): SpreadQuadProjection {
  const {
    stageWidth,
    stageHeight,
    baseLeftWidth,
    baseRightWidth,
    baseHeight,
    curveScale,
    calibration,
  } = params;

  const leftQuadPx = calibration.leftQuadNorm.map(([nx, ny]) => [
    nx * stageWidth,
    ny * stageHeight,
  ]) as unknown as Quad2D;
  const rightQuadPx = calibration.rightQuadNorm.map(([nx, ny]) => [
    nx * stageWidth,
    ny * stageHeight,
  ]) as unknown as Quad2D;

  const leftMatrixCss = computeHomographyMatrix3d(baseLeftWidth, baseHeight, leftQuadPx);
  const rightMatrixCss = computeHomographyMatrix3d(baseRightWidth, baseHeight, rightQuadPx);
  const leftDisp = buildPageDisplacementSpec("left", calibration.leftCurve, curveScale);
  const rightDisp = buildPageDisplacementSpec("right", calibration.rightCurve, curveScale);

  return {
    leftMatrixCss,
    rightMatrixCss,
    leftDisp,
    rightDisp,
    hasLeftCurve: hasSignificantPageCurve(calibration.leftCurve),
    hasRightCurve: hasSignificantPageCurve(calibration.rightCurve),
    leftFilterPad: Math.ceil(leftDisp.filterScale + 4),
    rightFilterPad: Math.ceil(rightDisp.filterScale + 4),
  };
}

/**
 * Mirrors the exact `object-fit: cover` centered scaling logic in `ScrollCanvasSequence.tsx`
 * so overlay coordinates map 1:1 to source image space regardless of viewport aspect ratio.
 */
export function computeCoverStageMetrics(
  viewportWidth: number,
  viewportHeight: number,
  sourceWidth = STAGE_SOURCE_WIDTH,
  sourceHeight = STAGE_SOURCE_HEIGHT
): CoverStageMetrics {
  const safeVw = Math.max(1, Number.isFinite(viewportWidth) ? viewportWidth : sourceWidth);
  const safeVh = Math.max(1, Number.isFinite(viewportHeight) ? viewportHeight : sourceHeight);
  const scale = Math.max(safeVw / sourceWidth, safeVh / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    width,
    height,
    offsetX: (safeVw - width) / 2,
    offsetY: (safeVh - height) / 2,
    scale,
  };
}

/**
 * Computes a CSS `matrix3d(...)` string (requires `transform-origin: 0 0`) mapping
 * `[0,0], [width,0], [width,height], [0,height]` to `targetQuad` via 8x8 Direct Linear Transform
 * with Gauss-Jordan partial pivoting and singularity guards.
 */
export function computeHomographyMatrix3d(
  width: number,
  height: number,
  targetQuad: Quad2D
): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 1 || height <= 1) {
    return "none";
  }

  for (const [ux, vy] of targetQuad) {
    if (!Number.isFinite(ux) || !Number.isFinite(vy)) {
      return "none";
    }
  }

  const src: readonly Point2D[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!;
    const [u, v] = targetQuad[i]!;
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k]![i]!) > Math.abs(A[maxRow]![i]!)) {
        maxRow = k;
      }
    }

    const rowI = A[i]!;
    A[i] = A[maxRow]!;
    A[maxRow] = rowI;
    const tmpB = b[i]!;
    b[i] = b[maxRow]!;
    b[maxRow] = tmpB;

    const pivot = A[i]![i]!;
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-9) {
      return "none";
    }

    for (let j = i; j < n; j++) {
      A[i]![j]! /= pivot;
    }
    b[i]! /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k]![i]!;
        for (let j = i; j < n; j++) {
          A[k]![j]! -= factor * A[i]![j]!;
        }
        b[k]! -= factor * b[i]!;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(b[i])) {
      return "none";
    }
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = b as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  // Column-major 4x4 CSS matrix3d mapping (x, y, 0, 1) -> (x', y', 0, w')
  // Preserve significant digits on tiny 1/px perspective terms (h6, h7) to prevent sub-pixel drift.
  const m = [
    h0, h3, 0, h6,
    h1, h4, 0, h7,
    0, 0, 1, 0,
    h2, h5, 0, 1,
  ].map((val) => (Math.abs(val) < 1e-12 ? 0 : Number(val.toPrecision(10))));

  return `matrix3d(${m.join(", ")})`;
}

/**
 * Computes signed vertical displacement (CSS px, + = visually UP on page belly,
 * - = visually DOWN into spine/outer curve) at normalized horizontal position `u` in [0..1].
 */
export function evaluatePageArchOffsetPx(
  side: "left" | "right",
  u: number,
  curve: BookPageCurveParams
): number {
  const clampedU = Math.max(0, Math.min(1, u));
  // t = 0 at outer edge, t = 1 at central spine fold
  const t = side === "left" ? clampedU : 1 - clampedU;
  const archBump = Math.sin(Math.PI * t) * curve.archLiftPx;
  const spinePlunge = Math.pow(t, 3.2) * curve.spineDipPx;
  const outerDroop = Math.pow(1 - t, 2.6) * curve.outerDropPx;
  return archBump - spinePlunge - outerDroop;
}

export interface PageDisplacementSpec {
  readonly dataUri: string;
  readonly filterScale: number;
}

/**
 * Builds a C1-continuous procedural SVG displacement Data URI (`sRGB` color space)
 * for a single open book page. Keeps R=128 (zero horizontal glyph smear) and encodes
 * smooth vertical book curvature strictly in the G channel.
 */
export function buildPageDisplacementSpec(
  side: "left" | "right",
  curve: BookPageCurveParams,
  viewportStageScale = 1,
  sampleCount = 16
): PageDisplacementSpec {
  const scaledCurve: BookPageCurveParams = {
    archLiftPx: curve.archLiftPx * viewportStageScale,
    spineDipPx: curve.spineDipPx * viewportStageScale,
    outerDropPx: curve.outerDropPx * viewportStageScale,
  };

  let maxAbs = 1;
  const offsets: number[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const u = i / sampleCount;
    const px = evaluatePageArchOffsetPx(side, u, scaledCurve);
    offsets.push(px);
    if (Math.abs(px) > maxAbs) maxAbs = Math.abs(px);
  }

  // Symmetric filter scale ensures exact linear encoding across G in [0..255] around 128 (#80)
  const filterScale = Math.max(2, Math.ceil(maxAbs * 2.15));
  const halfScale = filterScale / 2;

  const stops = offsets
    .map((offsetPx, idx) => {
      const pct = ((idx / sampleCount) * 100).toFixed(2);
      const norm = 0.5 + offsetPx / (2 * halfScale);
      const g = Math.max(0, Math.min(255, Math.round(norm * 255)));
      return `<stop offset="${pct}%" stop-color="rgb(128,${g},128)"/>`;
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">${stops}</linearGradient></defs>` +
    `<rect width="256" height="64" fill="url(#g)"/>` +
    `</svg>`;

  return {
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    filterScale,
  };
}
