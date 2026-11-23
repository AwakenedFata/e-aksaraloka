"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  computeCoverStageMetrics,
  type CoverStageMetrics,
} from "@/lib/ui/bookHomography";
import {
  MAP_CANVAS_HEIGHT,
  MAP_CANVAS_WIDTH,
  type ProgressionMapNode,
  type ProgressionNodeId,
  type ProgressionRouteSegment,
} from "@/lib/learning/progressionMap";

export interface WalkthroughStepInfo {
  readonly stepNumber: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
  readonly focusNodeId: ProgressionNodeId;
}

export const PETA_WALKTHROUGH_STEPS: readonly WalkthroughStepInfo[] = [
  {
    stepNumber: 1,
    title: "Langkah 1/3 · Pilih Titik Misi di Peta!",
    body: "Pilih Misi 1, 2, atau 3 buat bermain dan mengumpulkan 3 Segel Rahasia. Semua misi langsung terbuka untuk dicoba!",
    focusNodeId: "babak-1",
  },
  {
    stepNumber: 2,
    title: "Langkah 2/3 · Kuis Bonus & Kamus Kata",
    body: "Klik bintang Astrolab buat tebak-tebakan seru, atau pilih tab 'LKS & Kamus' di atas layar kalau mau kamus kata fantasi dan lembar cetak!",
    focusNodeId: "quest-hub",
  },
  {
    stepNumber: 3,
    title: "Langkah 3/3 · Mengarang di Studio Tulis!",
    body: "Kalau sudah siap, pilih Misi Puncak (Studio Tulis) buat mengarang cerita fantasimu sendiri dan mencetak Piagam Penulis Muda!",
    focusNodeId: "babak-4",
  },
];

interface AstrolabProgressionMapProps {
  readonly nodes: readonly ProgressionMapNode[];
  readonly segments: readonly ProgressionRouteSegment[];
  readonly selectedNodeId: ProgressionNodeId;
  readonly walkthroughStep: number | null;
  readonly showInteractivePins: boolean;
  readonly onSelectNode: (nodeId: ProgressionNodeId) => void;
  readonly onNavigateNode: (node: ProgressionMapNode) => void;
  readonly onNextWalkthrough: () => void;
  readonly onDismissWalkthrough: () => void;
}

function NodeGlyph({
  id,
  isCompleted,
}: {
  readonly id: ProgressionNodeId;
  readonly isCompleted: boolean;
}) {
  if (isCompleted) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        className="h-5 w-5 sm:h-6 sm:w-6"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  switch (id) {
    case "babak-1":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:h-6 sm:w-6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v4.5l3 2" />
        </svg>
      );
    case "babak-2":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:h-6 sm:w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
          />
          <circle cx="12" cy="12" r="2.75" />
        </svg>
      );
    case "quest-hub":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:h-6 sm:w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3z"
          />
        </svg>
      );
    case "babak-3":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:h-6 sm:w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.5 3.5l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4 1.4-3.6zM17 13.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z"
          />
        </svg>
      );
    case "babak-4":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:h-6 sm:w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 4c-5.5.5-9.8 3.5-12.5 8.5L5 19l6.5-2.5C16.5 13.8 19.5 9.5 20 4z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l5.5-5.5" />
        </svg>
      );
  }
}

export function AstrolabProgressionMap({
  nodes,
  segments,
  selectedNodeId,
  walkthroughStep,
  showInteractivePins,
  onSelectNode,
  onNavigateNode,
  onNextWalkthrough,
  onDismissWalkthrough,
}: AstrolabProgressionMapProps) {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const mobileCardRefs = useRef<Partial<Record<ProgressionNodeId, HTMLButtonElement | null>>>({});
  const [stageMetrics, setStageMetrics] = useState<CoverStageMetrics>(() =>
    typeof window !== "undefined"
      ? computeCoverStageMetrics(
          window.innerWidth,
          window.innerHeight,
          MAP_CANVAS_WIDTH,
          MAP_CANVAS_HEIGHT
        )
      : {
          width: MAP_CANVAS_WIDTH,
          height: MAP_CANVAS_HEIGHT,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        }
  );

  useEffect(() => {
    const syncStage = () => {
      setIsMobileViewport(window.innerWidth < 768);
      setStageMetrics(
        computeCoverStageMetrics(
          window.innerWidth,
          window.innerHeight,
          MAP_CANVAS_WIDTH,
          MAP_CANVAS_HEIGHT
        )
      );
    };
    const rafId = window.requestAnimationFrame(syncStage);
    window.addEventListener("resize", syncStage);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncStage);
    };
  }, []);

  const activeNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0]!;
  const currentTour =
    walkthroughStep !== null
      ? PETA_WALKTHROUGH_STEPS[walkthroughStep] ?? null
      : null;

  const renderConstellationSvg = () => (
    <svg
      viewBox={`0 0 ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="astrolab-route-glow"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
        >
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {segments.map((seg) => {
        const strokeColor = seg.isCompleted
          ? "#34d399"
          : seg.isActiveNext
            ? "#f4d993"
            : seg.isPrimaryArc
              ? "rgba(244, 217, 147, 0.62)"
              : "rgba(147, 197, 253, 0.48)";

        return (
          <g key={seg.id}>
            <path
              d={seg.pathD}
              fill="none"
              stroke="rgba(4, 9, 21, 0.72)"
              strokeWidth={seg.isPrimaryArc ? 8 : 5.5}
              strokeLinecap="round"
              strokeDasharray={seg.isCompleted ? undefined : "12 8"}
            />
            <path
              d={seg.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={
                seg.isCompleted ? 4 : seg.isPrimaryArc ? 3.2 : 2.4
              }
              strokeLinecap="round"
              strokeDasharray={seg.isCompleted ? undefined : "12 8"}
              filter={
                seg.isCompleted || seg.isActiveNext
                  ? "url(#astrolab-route-glow)"
                  : undefined
              }
            />
          </g>
        );
      })}
    </svg>
  );

  if (isMobileViewport) {
    return (
      <>
        {/* Subtle full-screen dark astrolabe atmosphere behind mobile map layout */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden bg-[#030712]"
        >
          <Image
            src="/peta-frame/map-frame.jpg"
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="object-cover opacity-20 blur-md scale-105 select-none"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/80 via-[#030712]/72 to-[#030712]/95" />
        </div>

        {showInteractivePins && (
          <div className="fixed inset-0 z-20 flex flex-col gap-2.5 px-3 pt-[102px] pb-3">
            {/* 1. Uncropped 16:9 Mini Overworld Map — ALL 5 pins visible without edge clipping */}
            <div className="relative mx-auto w-full max-w-[480px] aspect-[1376/768] shrink-0 overflow-hidden rounded-2xl border border-[#cda250]/55 shadow-[0_14px_34px_rgba(0,0,0,0.9)]">
              <Image
                src="/peta-frame/map-frame.jpg"
                alt="Peta Petualangan Dunia Cerita Fantasi Aksaraloka"
                fill
                priority
                unoptimized
                sizes="(max-width: 767px) 100vw, 480px"
                className="object-cover select-none"
                draggable={false}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(2,6,18,0.45)_100%)]"
              />
              {renderConstellationSvg()}

              {nodes.map((node) => {
                const isSelected = node.id === activeNode.id;
                const isCompleted = node.status === "completed";
                const isInProgress = node.status === "in_progress";
                const pinTone = isCompleted
                  ? "border-emerald-300 bg-[#052e26]/95 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.8)]"
                  : node.isRecommendedNext || isInProgress
                    ? "border-[#f4d993] bg-[#0a1730]/95 text-[#f4d993] shadow-[0_0_18px_rgba(244,217,147,0.85)]"
                    : "border-[#cda250]/85 bg-[#060f22]/92 text-amber-100 shadow-lg";

                return (
                  <button
                    key={node.id}
                    type="button"
                    style={{ left: `${node.xPct}%`, top: `${node.yPct}%` }}
                    aria-label={`${node.orderLabel}: ${node.title}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelectNode(node.id);
                      mobileCardRefs.current[node.id]?.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth",
                      });
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center cursor-pointer focus:outline-none ${
                      isSelected ? "z-30" : "z-20"
                    }`}
                  >
                    {node.isRecommendedNext && !isCompleted && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute h-9 w-9 rounded-full border border-[#f4d993]/85 animate-ping motion-reduce:animate-none"
                      />
                    )}
                    <span
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-brand text-[11px] font-bold transition-transform ${pinTone} ${
                        isSelected
                          ? "ring-2 ring-white scale-115"
                          : ""
                      }`}
                    >
                      {isCompleted ? "✓" : node.shortBadge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 2. Thumb-Scrollable Vertical Mission Journey List */}
            <div
              data-lenis-prevent
              className="mx-auto w-full max-w-[480px] flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5"
            >
              {nodes.map((node) => {
                const isSelected = node.id === activeNode.id;
                const isCompleted = node.status === "completed";
                const statusBadge = isCompleted
                  ? "Selesai ✓"
                  : node.score > 0
                    ? `${node.score}%`
                    : node.isRecommendedNext
                      ? "Yuk Mulai!"
                      : "Siap";

                return (
                  <button
                    key={node.id}
                    ref={(el) => {
                      mobileCardRefs.current[node.id] = el;
                    }}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onNavigateNode(node);
                      } else {
                        onSelectNode(node.id);
                      }
                    }}
                    className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#f4d993] bg-slate-900/95 shadow-[0_8px_24px_rgba(205,162,80,0.25)]"
                        : "border-white/12 bg-slate-950/85 hover:border-[#cda250]/50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                          isCompleted
                            ? "border-emerald-300 bg-[#052e26] text-emerald-200"
                            : isSelected || node.isRecommendedNext
                              ? "border-[#f4d993] bg-[#0a1730] text-[#f4d993]"
                              : "border-[#cda250]/70 bg-[#060f22] text-amber-100"
                        }`}
                      >
                        <NodeGlyph id={node.id} isCompleted={isCompleted} />
                      </span>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-serif text-sm font-bold text-white truncate">
                            {node.orderLabel}: {node.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isCompleted
                                ? "bg-emerald-500/20 text-emerald-300"
                                : node.isRecommendedNext || node.score > 0
                                  ? "bg-[#cda250]/30 text-[#ffe8b6]"
                                  : "bg-white/10 text-stone-300"
                            }`}
                          >
                            {statusBadge}
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed text-stone-300">
                          {isSelected ? node.questPrompt : node.summary}
                        </p>

                        {isSelected && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {node.subTasks.map((task) => (
                              <span
                                key={task.label}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  task.done
                                    ? "border-emerald-400/50 bg-emerald-950/60 text-emerald-200"
                                    : "border-white/15 bg-white/5 text-stone-300"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={
                                    task.done ? "text-emerald-300 font-bold" : "text-[#f4d993]"
                                  }
                                >
                                  {task.done ? "✓" : "○"}
                                </span>
                                <span>{task.label}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 3. Fixed Thumb-Ergonomic Primary CTA Button */}
            <div className="mx-auto w-full max-w-[480px] shrink-0 pt-0.5">
              <button
                type="button"
                onClick={() => onNavigateNode(activeNode)}
                className="w-full min-h-[48px] rounded-full border border-[#f4d993]/80 bg-gradient-to-r from-[#f4d993] to-[#d9ad54] px-4 py-2.5 text-sm font-bold tracking-wide text-slate-950 shadow-[0_10px_28px_rgba(205,162,80,0.4)] active:scale-[0.99] transition cursor-pointer"
              >
                {activeNode.ctaLabel}
              </button>
            </div>
          </div>
        )}

        {/* Mobile Walkthrough Card */}
        {showInteractivePins && currentTour && (
          <div className="pointer-events-auto fixed inset-x-3 bottom-18 z-40 mx-auto max-w-sm rounded-2xl border-2 border-[#f4d993] bg-slate-950/96 p-3.5 text-stone-100 shadow-[0_18px_45px_rgba(0,0,0,0.95)] backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[#cda250]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f4d993]">
                Tur Petunjuk Singkat
              </span>
              <button
                type="button"
                onClick={onDismissWalkthrough}
                className="min-h-[32px] px-2 text-xs font-semibold text-stone-300 hover:text-white cursor-pointer"
              >
                Lewati [X]
              </button>
            </div>
            <h3 className="font-serif text-sm font-bold text-white">
              {currentTour.title}
            </h3>
            <p className="text-xs text-stone-200 leading-relaxed">
              {currentTour.body}
            </p>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                {PETA_WALKTHROUGH_STEPS.map((st, idx) => (
                  <span
                    key={st.stepNumber}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === walkthroughStep
                        ? "w-5 bg-[#f4d993]"
                        : "w-1.5 bg-white/25"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={onNextWalkthrough}
                className="min-h-[36px] rounded-full bg-[#f4d993] px-4 py-1 text-xs font-bold text-[#030712] cursor-pointer shadow"
              >
                {walkthroughStep === PETA_WALKTHROUGH_STEPS.length - 1
                  ? "Mengerti, Ayo Mulai!"
                  : "Lanjut ->"}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* ================================================================= */}
      {/* FULL-SCREEN COVER-MATCHED STAGE FOR MAP-FRAME.JPG (1376x768)      */}
      {/* Bebas container kotak pembungkus — tampil 100% penuh seperti      */}
      {/* frame materi dan frame meja studio tulis.                         */}
      {/* ================================================================= */}
      <div
        className="pointer-events-none fixed overflow-hidden"
        style={{
          left: `${stageMetrics.offsetX}px`,
          top: `${stageMetrics.offsetY}px`,
          width: `${stageMetrics.width}px`,
          height: `${stageMetrics.height}px`,
        }}
      >
        <Image
          src="/peta-frame/map-frame.jpg"
          alt="Peta Petualangan Dunia Cerita Fantasi Aksaraloka"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover select-none"
          draggable={false}
        />

        {/* Soft Top/Bottom Edge Vignette so Floating Pills Read Clearly */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(2,6,18,0.52)_100%)]"
        />

        {showInteractivePins && (
          <>
            {/* SVG Progression Constellation Route Layer Locked 1:1 to 1376x768 */}
            {renderConstellationSvg()}

            {/* Interactive Landmark Nodes Directly on Full-Screen Parchment */}
            {nodes.map((node) => {
              const isSelected = node.id === activeNode.id;
              const isCompleted = node.status === "completed";
              const isInProgress = node.status === "in_progress";
              const isQuestHub = node.id === "quest-hub";
              const showCoachBubble =
                currentTour === null &&
                node.isRecommendedNext &&
                !isCompleted;

              const medallionTone = isCompleted
                ? "border-emerald-300 bg-[#052e26]/95 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.85)]"
                : node.isRecommendedNext || isInProgress
                  ? "border-[#f4d993] bg-[#0a1730]/95 text-[#f4d993] shadow-[0_0_26px_rgba(244,217,147,0.88)]"
                  : "border-[#cda250]/85 bg-[#060f22]/92 text-amber-100 hover:border-[#f4d993] shadow-[0_12px_24px_rgba(0,0,0,0.8)]";

              const statusTag = isCompleted
                ? "Selesai ✓"
                : node.score > 0
                  ? `${node.score}%`
                  : node.isRecommendedNext
                    ? "Yuk Mulai!"
                    : "Buka";

              return (
                <div
                  key={node.id}
                  style={{ left: `${node.xPct}%`, top: `${node.yPct}%` }}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 ${
                    isSelected || showCoachBubble ? "z-30" : "z-20"
                  }`}
                >
                  {/* Floating Coach Mark Speech Bubble Above Recommended Pin */}
                  {showCoachBubble && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap animate-float-gentle">
                      <div className="rounded-full border border-[#f4d993] bg-slate-950/95 px-3 py-1 text-[11px] font-bold text-[#ffe8b6] shadow-[0_8px_22px_rgba(0,0,0,0.9)]">
                        {node.coachMarkText}
                      </div>
                      <div className="mx-auto h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-[#f4d993]" />
                    </div>
                  )}

                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${node.orderLabel}: ${node.title} (${statusTag}). Klik untuk lihat misi, klik lagi untuk langsung masuk.`}
                    onClick={() => {
                      if (isSelected) {
                        onNavigateNode(node);
                      } else {
                        onSelectNode(node.id);
                      }
                    }}
                    onDoubleClick={() => onNavigateNode(node)}
                    className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
                  >
                    {node.isRecommendedNext && !isCompleted && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-1/2 h-13 w-13 sm:h-15 sm:w-15 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f4d993]/80 animate-ping motion-reduce:animate-none"
                      />
                    )}

                    <span
                      className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        isQuestHub
                          ? "h-11 w-11 sm:h-13 sm:w-13"
                          : "h-12 w-12 sm:h-14 sm:w-14"
                      } ${medallionTone} ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110"
                          : "group-hover:scale-108"
                      }`}
                    >
                      <NodeGlyph id={node.id} isCompleted={isCompleted} />

                      <span className="absolute -top-1.5 -right-1.5 rounded-full border border-[#cda250]/90 bg-slate-950 px-1.5 py-0.5 font-brand text-[9.5px] font-bold text-[#f4d993] shadow">
                        {node.shortBadge}
                      </span>
                    </span>

                    <span
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap shadow-[0_8px_20px_rgba(0,0,0,0.85)] backdrop-blur-md transition-colors ${
                        isSelected
                          ? "border-[#f4d993] bg-slate-950/95 text-white"
                          : "border-[#cda250]/60 bg-slate-950/88 text-stone-100 group-hover:border-[#f4d993]"
                      }`}
                    >
                      <span>
                        {node.orderLabel}: {node.title}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9.5px] font-bold ${
                          isCompleted
                            ? "bg-emerald-500/25 text-emerald-300"
                            : node.score > 0 || node.isRecommendedNext
                              ? "bg-[#cda250]/35 text-[#f4d993]"
                              : "bg-white/10 text-stone-300"
                        }`}
                      >
                        {statusTag}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* INTERACTIVE 3-STEP WALKTHROUGH POPOVER (FLOATING CORNER HUD)      */}
      {/* ================================================================= */}
      {showInteractivePins && currentTour && (
        <div className="pointer-events-auto fixed inset-x-3 bottom-24 sm:inset-x-auto sm:right-6 sm:bottom-22 sm:w-[360px] z-40 rounded-2xl border-2 border-[#f4d993] bg-slate-950/94 p-3.5 text-stone-100 shadow-[0_18px_45px_rgba(0,0,0,0.95)] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-[#cda250]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f4d993]">
              Tur Petunjuk Singkat
            </span>
            <button
              type="button"
              onClick={onDismissWalkthrough}
              className="text-[10.5px] font-semibold text-stone-400 hover:text-white cursor-pointer"
            >
              Lewati [X]
            </button>
          </div>

          <h3 className="font-serif text-sm sm:text-base font-bold text-white">
            {currentTour.title}
          </h3>
          <p className="text-xs text-stone-200 leading-relaxed">
            {currentTour.body}
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              {PETA_WALKTHROUGH_STEPS.map((st, idx) => (
                <span
                  key={st.stepNumber}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === walkthroughStep
                      ? "w-5 bg-[#f4d993]"
                      : "w-1.5 bg-white/25"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onNextWalkthrough}
              className="rounded-full bg-[#f4d993] px-3.5 py-1 text-[11px] font-bold text-[#030712] hover:bg-white transition-colors cursor-pointer shadow"
            >
              {walkthroughStep === PETA_WALKTHROUGH_STEPS.length - 1
                ? "Mengerti, Ayo Mulai!"
                : "Lanjut ->"}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BOTTOM FLOATING ACTION DOCK BAR (SAMA SEPERTI MATERI & STUDIO 3D) */}
      {/* ================================================================= */}
      {showInteractivePins && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-4 sm:px-6">
          <div className="pointer-events-auto flex w-full max-w-[1180px] flex-col lg:flex-row lg:items-center justify-between gap-2.5 rounded-2xl border border-[#d6b26f]/45 bg-slate-950/86 px-4 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.9)] backdrop-blur-md">
            <div className="space-y-1 min-w-0 flex-1">
              {/* Row 1: Quick Selector Pills + Sub-Misi Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {nodes.map((node) => {
                  const isSelected = node.id === activeNode.id;
                  const isCompleted = node.status === "completed";
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#f3d89b] text-slate-950 shadow-[0_0_12px_rgba(243,216,155,0.4)]"
                          : "border border-[#d6b26f]/40 bg-slate-900/90 text-amber-100/85 hover:border-[#f3d89b]/70 hover:text-white"
                      }`}
                    >
                      <span>
                        {node.shortBadge}. {node.title}
                      </span>
                      <span
                        className={
                          isSelected
                            ? "text-slate-950"
                            : isCompleted
                              ? "text-emerald-300"
                              : "text-[#f4d993]"
                        }
                      >
                        {isCompleted ? "✓" : `${node.score}%`}
                      </span>
                    </button>
                  );
                })}

                <div className="mx-1 hidden h-3.5 w-px bg-[#d6b26f]/30 xl:block" />

                {activeNode.subTasks.map((task) => (
                  <span
                    key={task.label}
                    className={`hidden md:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      task.done
                        ? "border-emerald-400/50 bg-emerald-950/60 text-emerald-200"
                        : "border-white/15 bg-white/5 text-stone-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        task.done
                          ? "text-emerald-300 font-bold"
                          : "text-[#f4d993]"
                      }
                    >
                      {task.done ? "✓" : "○"}
                    </span>
                    <span>{task.label}</span>
                  </span>
                ))}
              </div>

              {/* Row 2: Quest Prompt Sentence */}
              <p className="text-xs text-stone-200 leading-snug truncate">
                <strong className="text-[#ffe8b6]">
                  {activeNode.orderLabel} ({activeNode.title}):
                </strong>{" "}
                {activeNode.questPrompt}
              </p>
            </div>

            {/* Gamified CTA Button */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateNode(activeNode)}
                className="w-full lg:w-auto rounded-full border border-emerald-400/65 bg-emerald-900/90 px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.3)] transition hover:border-emerald-300 hover:bg-emerald-800 hover:scale-[1.02] cursor-pointer"
              >
                {activeNode.ctaLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
