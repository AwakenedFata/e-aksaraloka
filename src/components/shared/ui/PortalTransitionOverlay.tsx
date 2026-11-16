"use client";

import { useState, useEffect } from "react";

export type PortalTransitionPhase = "idle" | "fading-out" | "loading" | "fading-in";
export type PortalTransitionSpeed = "normal" | "fast";

interface PortalTransitionOverlayProps {
  readonly phase: PortalTransitionPhase;
  readonly speed?: PortalTransitionSpeed;
  readonly eyebrow?: string;
  readonly title?: string;
  readonly subtitle?: string;
}

/**
 * Full-screen obsidian-and-gold celestial astrolabe transition veil.
 * Fades out smoothly from the active sequence, renders an animated library compass
 * loader while the target hub frame and DOM scroll track align silently behind it,
 * then fades cleanly back into the destination scene.
 */
export function PortalTransitionOverlay({
  phase,
  speed = "normal",
  eyebrow = "PORTAL PUSTAKA",
  title = "Kembali ke Ruang Pustaka",
  subtitle = "Menyelaraskan gerbang utama...",
}: PortalTransitionOverlayProps) {
  const [prevPhase, setPrevPhase] = useState<PortalTransitionPhase>(phase);
  const [fadeOutEntered, setFadeOutEntered] = useState<boolean>(false);

  if (prevPhase !== phase) {
    setPrevPhase(phase);
    if (phase === "idle" || phase === "fading-out") {
      setFadeOutEntered(false);
    }
  }

  useEffect(() => {
    if (phase !== "fading-out") return;
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFadeOutEntered(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [phase]);

  if (phase === "idle") return null;

  const isVeilOpaque =
    (phase === "fading-out" && fadeOutEntered) || phase === "loading";
  const isLoaderVisible = phase === "loading";
  const isFast = speed === "fast";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={phase !== "fading-in"}
      aria-label={title}
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#030712] select-none pointer-events-auto transition-opacity ${
        phase === "fading-out"
          ? isFast
            ? "duration-[200ms] ease-out"
            : "duration-[420ms] ease-out"
          : phase === "loading"
          ? "duration-150 ease-out"
          : isFast
          ? "duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          : "duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      } ${isVeilOpaque ? "opacity-100" : "opacity-0"}`}
    >
      {/* Atmospheric midnight & golden radial glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(205,162,80,0.16) 0%, rgba(36,20,66,0.28) 34%, rgba(3,7,18,0.98) 72%)",
        }}
      />

      {/* Central Astrolabe & 4-Point Compass Emblem */}
      <div
        className={`relative z-10 flex flex-col items-center px-6 text-center transition-all duration-500 ease-out ${
          isLoaderVisible
            ? "opacity-100 scale-100 translate-y-0"
            : phase === "fading-in"
            ? "opacity-0 scale-105 -translate-y-1"
            : fadeOutEntered
            ? "opacity-75 scale-95 translate-y-1"
            : "opacity-0 scale-95 translate-y-2"
        }`}
      >
        <div className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center">
          {/* Ambient golden aura */}
          <div
            aria-hidden="true"
            className="animate-portal-pulse absolute inset-2 rounded-full bg-[#cda250]/15 blur-xl"
          />

          {/* Outer slowly rotating celestial degree ring */}
          <svg
            viewBox="0 0 120 120"
            fill="none"
            className="animate-portal-spin-slow absolute inset-0 h-full w-full text-[#cda250]/65"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r="55"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
            <circle
              cx="60"
              cy="60"
              r="49"
              stroke="#f4d993"
              strokeOpacity="0.28"
              strokeWidth="0.75"
            />
            <circle cx="60" cy="5" r="2.2" fill="#f4d993" />
            <circle cx="60" cy="115" r="1.5" fill="#cda250" fillOpacity="0.7" />
          </svg>

          {/* Counter-rotating inner orbital arc */}
          <svg
            viewBox="0 0 100 100"
            fill="none"
            className="animate-portal-spin-reverse absolute inset-3.5 h-[calc(100%-28px)] w-[calc(100%-28px)] text-[#f4d993]"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeOpacity="0.55"
              strokeDasharray="48 22 14 18"
              strokeLinecap="round"
            />
          </svg>

          {/* Center Aksaraloka 4-point Compass Star */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#cda250]/40 bg-[#071324]/90 shadow-[0_0_28px_rgba(244,217,147,0.35)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-6 w-6 text-[#f4d993] drop-shadow-[0_0_10px_rgba(244,217,147,0.85)]"
              aria-hidden="true"
            >
              <path
                d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                fill="currentColor"
                fillOpacity="0.22"
              />
              <circle cx="12" cy="12" r="2.25" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Typography matching Hub & Modal design language */}
        <p className="mt-5 font-brand text-[10px] sm:text-[11px] font-semibold tracking-[0.28em] text-[#cda250] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 font-serif text-xl sm:text-2xl font-medium tracking-wide text-stone-100">
          {title}
        </h2>

        {/* Sweeping golden shimmer progress beam */}
        <div
          aria-hidden="true"
          className="relative mt-5 h-[2px] w-48 sm:w-56 overflow-hidden rounded-full bg-[#cda250]/20"
        >
          <div className="animate-portal-sweep h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-[#f4d993] to-transparent shadow-[0_0_12px_rgba(244,217,147,0.85)]" />
        </div>

        <p className="mt-3 text-xs tracking-wider text-stone-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
