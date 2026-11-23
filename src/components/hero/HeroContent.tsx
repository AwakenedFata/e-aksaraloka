"use client";

import { memo, useSyncExternalStore } from "react";
import Image from "next/image";

interface HeroContentProps {
  readonly currentStep?: 1 | 2 | 3;
  readonly isHeroInteractive?: boolean;
  readonly onNavigateToHub?: () => void;
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => { };
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

export const HeroContent = memo(function HeroContent({
  currentStep = 1,
  isHeroInteractive = true,
  onNavigateToHub,
}: HeroContentProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Exit progress (0..1) is driven imperatively at 60/120 FPS via `--hero-exit`
  // CSS custom property on the parent sticky container to avoid React re-renders.
  const interactivePointerEvents: React.CSSProperties["pointerEvents"] = isHeroInteractive
    ? "auto"
    : "none";

  // 1. Eyebrow badge
  const eyebrowStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -45px), 0)",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.6), 1)",
    willChange: "transform, opacity",
  };

  // 2. Main Heading: translates upward and subtly scales down (0.96)
  const headingStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -85px), 0) scale(calc(1 - var(--hero-exit, 0) * 0.04))",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.25), 1)",
    willChange: "transform, opacity",
  };

  // 3. Narrative Description
  const paragraphStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -65px), 0)",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.4), 1)",
    willChange: "transform, opacity",
  };

  // 4. CTA Action Buttons
  const buttonsStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -50px), 0)",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.5), 1)",
    pointerEvents: interactivePointerEvents,
    willChange: "transform, opacity",
  };

  // 5. Right Floating Card ("Pustaka Fantasi")
  const rightCardStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -80px), 0) scale(calc(1 - var(--hero-exit, 0) * 0.07))",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.3), 1)",
    pointerEvents: interactivePointerEvents,
    willChange: "transform, opacity",
  };

  // 6. Right Vertical Step Indicator (01/02/03)
  const stepIndicatorStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "translateY(-50%)"
      : "translate3d(0, calc(-50% - var(--hero-exit, 0) * 55px), 0)",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.3), 1)",
    pointerEvents: interactivePointerEvents,
    willChange: "transform, opacity",
  };

  // 7. Bottom Row (Preview Thumbnail + Quote)
  const bottomRowStyle: React.CSSProperties = {
    transform: prefersReducedMotion
      ? "none"
      : "translate3d(0, calc(var(--hero-exit, 0) * -35px), 0)",
    opacity: prefersReducedMotion ? 1 : "clamp(0, calc(1 - var(--hero-exit, 0) * 1.6), 1)",
    willChange: "transform, opacity",
  };

  return (
    <div
      className={`relative z-10 flex h-dvh max-h-dvh w-full flex-col justify-between px-5 sm:px-10 lg:px-16 2xl:px-24 pt-18 min-[380px]:pt-20 sm:pt-28 lg:pt-28 2xl:pt-32 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-8 lg:pb-10 overflow-hidden ${!isHeroInteractive ? "pointer-events-none" : ""
        }`}
    >
      {/* Top / Middle Grid Area */}
      <div className="mx-auto flex w-full max-w-7xl 2xl:max-w-[1536px] flex-1 min-h-0 items-center justify-between py-2 sm:py-0">
        {/* Left Column: Editorial Headline & Actions */}
        <div className="max-w-2xl 2xl:max-w-3xl">
          {/* Eyebrow with Left Dash (matching reference layout) */}
          <div
            style={eyebrowStyle}
            className="flex items-center gap-2.5 sm:gap-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
          >
            <span className="h-[1.5px] w-6 sm:w-8 bg-white/70" />
            <span className="text-[10.5px] sm:text-xs 2xl:text-sm font-semibold tracking-[0.22em] sm:tracking-[0.25em] text-white uppercase">
              TEKS NARASI · KELAS VII SMP
            </span>
          </div>

          {/* Oversized Editorial Heading (Playfair Display) */}
          <h1
            id="hero-heading"
            style={headingStyle}
            className="mt-2.5 min-[380px]:mt-3.5 sm:mt-5 2xl:mt-6 font-serif text-[2.1rem] min-[380px]:text-4xl sm:text-5xl md:text-6xl lg:text-[4.75rem] 2xl:text-[5.5rem] font-medium tracking-tight text-white leading-[1.04] select-text drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] origin-left"
          >
            Setiap Cerita.
            <br />
            Membuka Dunia.
          </h1>

          {/* Supporting Copy (Tailored to Indonesian narrative writing skills) */}
          <p
            style={paragraphStyle}
            className="mt-2.5 min-[380px]:mt-3.5 sm:mt-5 2xl:mt-6 max-w-lg 2xl:max-w-xl text-[13px] min-[380px]:text-sm sm:text-base lg:text-lg 2xl:text-xl text-white/95 font-normal leading-relaxed select-text drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
          >
            Rangkai orientasi yang memikat, susun komplikasi mendebarkan, dan hidupkan resolusi ceritamu!.
          </p>

          {/* Action Buttons Row: White Pill Button + Translucent Play Button */}
          <div
            style={buttonsStyle}
            className="mt-4 min-[380px]:mt-5 sm:mt-7 2xl:mt-9 flex flex-wrap items-center gap-3 sm:gap-6"
          >
            {/* Primary Action Button (Solid White Pill with Circular Arrow) */}
            <button
              type="button"
              onClick={onNavigateToHub}
              data-scroll-duration="4"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-2.5 min-[380px]:px-7 min-[380px]:py-3 sm:py-3.5 2xl:px-8 2xl:py-4 text-xs sm:text-sm font-semibold tracking-wider text-black transition-all duration-300 hover:bg-[#f4d993] hover:shadow-xl hover:shadow-white/10 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
              aria-label="Mulai Petualangan - Gulir ke Ruang Pustaka"
            >
              <span className="uppercase">Mulai Petualangan</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="h-3.5 w-3.5 text-black"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </button>

            {/* Secondary Action Button (Circular Translucent Play + Label) */}
            <button
              type="button"
              onClick={onNavigateToHub}
              data-scroll-duration="4"
              className="group inline-flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-medium tracking-wide text-white transition-colors hover:text-[#f4d993] focus-visible:outline-2 focus-visible:outline-white rounded-full p-1 cursor-pointer"
              aria-label="Pratinjau Alur - Gulir ke Ruang Pustaka"
            >
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 2xl:h-12 2xl:w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/20 group-hover:scale-105">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 ml-0.5 text-white group-hover:text-[#f4d993] transition-colors"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>Pratinjau Alur</span>
            </button>
          </div>
        </div>

        {/* Right Floating Glassmorphic Card (matching "Sky City" in reference) */}
        <div
          style={rightCardStyle}
          className="hidden lg:flex flex-col items-end gap-6"
        >
          <div className="group relative flex items-center gap-3.5 rounded-2xl border border-white/15 bg-[#0a1220]/85 md:bg-[#0a1220]/75 p-2.5 pr-4 md:backdrop-blur-sm shadow-2xl ring-1 ring-white/5 transition-all duration-300 hover:border-white/30 hover:bg-[#0f1b2e]/85 hover:-translate-y-0.5">
            {/* Thumbnail */}
            <div className="relative h-12 w-12 2xl:h-14 2xl:w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/20">
              <Image
                src="/hero-frames/frame-240.webp"
                alt="Pustaka Aksaraloka"
                fill
                unoptimized
                sizes="56px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>

            {/* Card Content */}
            <div className="flex flex-col pr-1">
              <span className="text-xs 2xl:text-sm font-semibold tracking-wide text-white">
                Pustaka Fantasi
              </span>
              <span className="text-[11px] 2xl:text-xs text-stone-300">
                Semesta ceritamu menanti
              </span>
            </div>

            {/* Circular Arrow Button */}
            <button
              type="button"
              onClick={onNavigateToHub}
              aria-label="Kunjungi Pustaka Fantasi"
              className="flex h-7 w-7 2xl:h-8 2xl:w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-all duration-300 hover:bg-white hover:text-black cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Far Right Vertical Step Indicator (01, 02, 03 - matching reference right bar) */}
      <div
        style={stepIndicatorStyle}
        className="absolute right-6 sm:right-10 2xl:right-12 top-1/2 z-20 hidden md:flex flex-col items-center gap-5 select-none"
      >
        {/* Step 01: Orientasi */}
        <div className="group flex flex-col items-center gap-1.5 cursor-pointer">
          <span
            className={`font-mono text-xs font-semibold transition-colors duration-300 ${currentStep === 1 ? "text-white" : "text-stone-500 group-hover:text-stone-300"
              }`}
          >
            01
          </span>
          <div
            className={`w-[2px] rounded-full transition-all duration-300 ${currentStep === 1 ? "h-7 bg-white shadow-[0_0_8px_white]" : "h-3 bg-stone-700"
              }`}
          />
        </div>

        {/* Step 02: Komplikasi */}
        <div className="group flex flex-col items-center gap-1.5 cursor-pointer">
          <span
            className={`font-mono text-xs font-semibold transition-colors duration-300 ${currentStep === 2 ? "text-white" : "text-stone-500 group-hover:text-stone-300"
              }`}
          >
            02
          </span>
          <div
            className={`w-[2px] rounded-full transition-all duration-300 ${currentStep === 2 ? "h-7 bg-white shadow-[0_0_8px_white]" : "h-3 bg-stone-700"
              }`}
          />
        </div>

        {/* Step 03: Resolusi */}
        <div className="group flex flex-col items-center gap-1.5 cursor-pointer">
          <span
            className={`font-mono text-xs font-semibold transition-colors duration-300 ${currentStep === 3 ? "text-white" : "text-stone-500 group-hover:text-stone-300"
              }`}
          >
            03
          </span>
          <div
            className={`w-[2px] rounded-full transition-all duration-300 ${currentStep === 3 ? "h-7 bg-white shadow-[0_0_8px_white]" : "h-3 bg-stone-700"
              }`}
          />
        </div>
      </div>

      {/* Bottom Row (Matching reference bottom-left preview & bottom-right quote) */}
      <div
        style={bottomRowStyle}
        className="mx-auto flex w-full max-w-7xl 2xl:max-w-[1536px] items-center justify-between pt-3.5 sm:pt-6 border-t border-white/15 flex-shrink-0"
      >
        {/* Bottom Left Card (Circular Thumbnail + Copy matching reference) */}
        <div className="flex items-center gap-3 sm:gap-4 max-w-md 2xl:max-w-lg min-w-0">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14 flex-shrink-0 overflow-hidden rounded-full border border-white/30 shadow-lg ring-2 ring-white/10">
            <Image
              src="/hero-frames/frame-001.webp"
              alt="Eksplorasi Alur Magis"
              fill
              unoptimized
              sizes="56px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white leading-snug">
              Keterampilan Menulis Teks Fantasi
            </span>
            <span className="text-[11px] sm:text-xs leading-snug sm:leading-relaxed text-stone-300">
              Dari ruang nyata menuju latar ajaib, mulailah merangkai ceritamu.
            </span>
          </div>
        </div>

        {/* Bottom Right Quote (matching "— More than a destination — it's a feeling.") */}
        <div className="hidden sm:flex items-center gap-3 text-right text-xs sm:text-[13px] 2xl:text-sm text-stone-300 select-none">
          {/* Subtle 4-point star glyph */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5 text-[#f4d993] flex-shrink-0"
            aria-hidden="true"
          >
            <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
          </svg>
          <span className="font-light tracking-wide text-stone-300">
            — Bukan sekadar tulisan — ini semesta imajinasimu.
          </span>
        </div>
      </div>
    </div>
  );
});
