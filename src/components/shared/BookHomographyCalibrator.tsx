"use client";

import { useState, useCallback } from "react";
import {
  evaluatePageArchOffsetPx,
  type BookPageCurveParams,
  type BookSpreadCalibration,
  type Point2D,
  type Quad2D,
} from "@/lib/ui/bookHomography";

interface BookHomographyCalibratorProps {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly stageOffsetX: number;
  readonly stageOffsetY: number;
  readonly stageScale?: number;
  readonly calibration: BookSpreadCalibration;
  readonly leftMatrixCss: string;
  readonly rightMatrixCss: string;
  readonly onChangeCalibration: (next: BookSpreadCalibration) => void;
  readonly onResetCalibration: () => void;
  readonly onClose: () => void;
}

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;

type DragHandleState = {
  readonly side: "left" | "right";
  readonly cornerIndex: 0 | 1 | 2 | 3;
};

function clampNorm(value: number): number {
  return Number(Math.max(0.02, Math.min(0.98, value)).toFixed(4));
}

function buildCurvedEdgePolyline(
  side: "left" | "right",
  startNorm: Point2D,
  endNorm: Point2D,
  curve: BookPageCurveParams,
  stageWidth: number,
  stageHeight: number,
  stageScale: number
): string {
  const points: string[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = (startNorm[0] + (endNorm[0] - startNorm[0]) * u) * stageWidth;
    const baseY = (startNorm[1] + (endNorm[1] - startNorm[1]) * u) * stageHeight;
    const curveDy = evaluatePageArchOffsetPx(side, u, curve) * stageScale;
    // Visually UP on screen corresponds to smaller SVG y coordinate
    points.push(`${(x).toFixed(1)},${(baseY - curveDy).toFixed(1)}`);
  }
  return points.join(" ");
}

export function BookHomographyCalibrator({
  stageWidth,
  stageHeight,
  stageOffsetX,
  stageOffsetY,
  stageScale: stageScaleProp,
  calibration,
  leftMatrixCss,
  rightMatrixCss,
  onChangeCalibration,
  onResetCalibration,
  onClose,
}: BookHomographyCalibratorProps) {
  const [dragging, setDragging] = useState<DragHandleState | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const stageScale = stageScaleProp ?? stageHeight / 1080;

  const updateCorner = useCallback(
    (side: "left" | "right", cornerIndex: 0 | 1 | 2 | 3, clientX: number, clientY: number) => {
      const nx = clampNorm((clientX - stageOffsetX) / Math.max(1, stageWidth));
      const ny = clampNorm((clientY - stageOffsetY) / Math.max(1, stageHeight));

      const sourceQuad = side === "left" ? calibration.leftQuadNorm : calibration.rightQuadNorm;
      const nextQuad = sourceQuad.map((pt, idx) =>
        idx === cornerIndex ? ([nx, ny] as const) : pt
      ) as unknown as Quad2D;

      onChangeCalibration(
        side === "left"
          ? { ...calibration, leftQuadNorm: nextQuad }
          : { ...calibration, rightQuadNorm: nextQuad }
      );
    },
    [calibration, onChangeCalibration, stageHeight, stageOffsetX, stageOffsetY, stageWidth]
  );

  const updateCurveParam = useCallback(
    (side: "left" | "right", key: keyof BookPageCurveParams, value: number) => {
      if (side === "left") {
        onChangeCalibration({
          ...calibration,
          leftCurve: { ...calibration.leftCurve, [key]: value },
        });
      } else {
        onChangeCalibration({
          ...calibration,
          rightCurve: { ...calibration.rightCurve, [key]: value },
        });
      }
    },
    [calibration, onChangeCalibration]
  );

  const handleCopyPayload = useCallback(async () => {
    const payload = {
      normalizedCalibration: calibration,
      runtimePixels: {
        stageWidth: Math.round(stageWidth),
        stageHeight: Math.round(stageHeight),
        leftMatrix3d: leftMatrixCss,
        rightMatrix3d: rightMatrixCss,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      // Fallback ignored cleanly when clipboard API is blocked
    }
  }, [calibration, leftMatrixCss, rightMatrixCss, stageHeight, stageWidth]);

  const toStagePolygonPoints = (quad: Quad2D): string =>
    quad
      .map(([nx, ny]) => `${(nx * stageWidth).toFixed(1)},${(ny * stageHeight).toFixed(1)}`)
      .join(" ");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cover-matched SVG Wireframe & Curve Guides */}
      <div
        className="pointer-events-none fixed overflow-hidden"
        style={{
          left: `${stageOffsetX}px`,
          top: `${stageOffsetY}px`,
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
        }}
      >
        <svg
          width={stageWidth}
          height={stageHeight}
          viewBox={`0 0 ${stageWidth} ${stageHeight}`}
          className="pointer-events-none absolute inset-0"
        >
          <polygon
            points={toStagePolygonPoints(calibration.leftQuadNorm)}
            fill="rgba(245, 158, 11, 0.08)"
            stroke="rgba(245, 158, 11, 0.9)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <polyline
            points={buildCurvedEdgePolyline(
              "left",
              calibration.leftQuadNorm[0],
              calibration.leftQuadNorm[1],
              calibration.leftCurve,
              stageWidth,
              stageHeight,
              stageScale
            )}
            fill="none"
            stroke="rgba(251, 191, 36, 0.95)"
            strokeWidth={2}
          />
          <polyline
            points={buildCurvedEdgePolyline(
              "left",
              calibration.leftQuadNorm[3],
              calibration.leftQuadNorm[2],
              calibration.leftCurve,
              stageWidth,
              stageHeight,
              stageScale
            )}
            fill="none"
            stroke="rgba(251, 191, 36, 0.75)"
            strokeWidth={1.6}
          />
          <polygon
            points={toStagePolygonPoints(calibration.rightQuadNorm)}
            fill="rgba(34, 211, 238, 0.08)"
            stroke="rgba(34, 211, 238, 0.9)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <polyline
            points={buildCurvedEdgePolyline(
              "right",
              calibration.rightQuadNorm[0],
              calibration.rightQuadNorm[1],
              calibration.rightCurve,
              stageWidth,
              stageHeight,
              stageScale
            )}
            fill="none"
            stroke="rgba(34, 211, 238, 0.95)"
            strokeWidth={2}
          />
          <polyline
            points={buildCurvedEdgePolyline(
              "right",
              calibration.rightQuadNorm[3],
              calibration.rightQuadNorm[2],
              calibration.rightCurve,
              stageWidth,
              stageHeight,
              stageScale
            )}
            fill="none"
            stroke="rgba(34, 211, 238, 0.75)"
            strokeWidth={1.6}
          />
        </svg>

        {(["left", "right"] as const).map((side) => {
          const quad = side === "left" ? calibration.leftQuadNorm : calibration.rightQuadNorm;
          const accentClass =
            side === "left"
              ? "border-amber-300 bg-amber-600/90 text-white"
              : "border-cyan-300 bg-cyan-600/90 text-white";

          return quad.map(([nx, ny], cornerIdx) => {
            const idx = cornerIdx as 0 | 1 | 2 | 3;
            const isActive =
              dragging?.side === side && dragging.cornerIndex === idx;

            return (
              <button
                key={`${side}-${CORNER_LABELS[idx]}`}
                type="button"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                  setDragging({ side, cornerIndex: idx });
                }}
                onPointerMove={(e) => {
                  if (!isActive) return;
                  e.stopPropagation();
                  updateCorner(side, idx, e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  if (!isActive) return;
                  e.stopPropagation();
                  (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
                  setDragging(null);
                }}
                style={{
                  left: `${nx * stageWidth}px`,
                  top: `${ny * stageHeight}px`,
                }}
                className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 px-1.5 py-0.5 text-[9px] font-bold shadow-lg active:cursor-grabbing ${accentClass}`}
                title={`Seret sudut ${side === "left" ? "Kiri" : "Kanan"} ${CORNER_LABELS[idx]}`}
              >
                {side === "left" ? "L" : "R"}-{CORNER_LABELS[idx]}
              </button>
            );
          });
        })}
      </div>

      {/* Compact Control Drawer */}
      <div className="pointer-events-auto fixed top-20 right-4 z-50 w-72 rounded-2xl border border-[#cda250]/60 bg-slate-950/92 p-3 text-[11px] text-stone-100 shadow-2xl backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
          <span className="font-brand text-[10px] font-bold tracking-wider text-[#f4d993] uppercase">
            In-App Homography Calibrator
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-white/20 px-2 py-0.5 text-[10px] hover:bg-white/10"
          >
            Tutup
          </button>
        </div>

        {(["left", "right"] as const).map((side) => {
          const curve = side === "left" ? calibration.leftCurve : calibration.rightCurve;
          return (
            <div key={side} className="space-y-1 border-b border-white/10 pb-2">
              <p className="text-[10px] font-bold text-[#f4d993]">
                {side === "left" ? "Halaman Kiri (Kuning)" : "Halaman Kanan (Sian)"}
              </p>
              <label className="flex items-center justify-between gap-2 text-[10px]">
                <span>Lengkungan Perut ({curve.archLiftPx}px)</span>
                <input
                  type="range"
                  min={0}
                  max={28}
                  step={1}
                  value={curve.archLiftPx}
                  onChange={(e) =>
                    updateCurveParam(side, "archLiftPx", Number(e.target.value))
                  }
                  className="w-28 accent-amber-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-[10px]">
                <span>Jatuh Lipatan Tengah ({curve.spineDipPx}px)</span>
                <input
                  type="range"
                  min={0}
                  max={28}
                  step={1}
                  value={curve.spineDipPx}
                  onChange={(e) =>
                    updateCurveParam(side, "spineDipPx", Number(e.target.value))
                  }
                  className="w-28 accent-amber-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-[10px]">
                <span>Lengkung Tepi Luar ({curve.outerDropPx}px)</span>
                <input
                  type="range"
                  min={0}
                  max={18}
                  step={1}
                  value={curve.outerDropPx}
                  onChange={(e) =>
                    updateCurveParam(side, "outerDropPx", Number(e.target.value))
                  }
                  className="w-28 accent-amber-400"
                />
              </label>
            </div>
          );
        })}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="flex-1 cursor-pointer rounded-lg bg-[#f4d993] px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-[#fae5b0]"
          >
            {copiedJson ? "JSON Tersalin!" : "Salin JSON Kalibrasi"}
          </button>
          <button
            type="button"
            onClick={onResetCalibration}
            className="cursor-pointer rounded-lg border border-white/25 px-2.5 py-1 text-[10px] font-semibold hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
