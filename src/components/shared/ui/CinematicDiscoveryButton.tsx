"use client";

import { useState, useEffect } from "react";
import { TheaterSpotlight } from "@/components/shared/ui/Spotlight";

/**
 * Standard icon dimensions, golden glow, and hover scale shared by all
 * circular Hub and Stage discovery buttons so icon sizes stay uniform.
 */
export const DISCOVERY_ICON_CLASS =
  "h-9 w-9 sm:h-10 sm:w-10 2xl:h-13 2xl:w-13 text-[#eac77e] drop-shadow-[0_2px_12px_rgba(244,217,147,0.85)] transition-transform duration-500 group-hover:scale-110";

interface CinematicDiscoveryButtonProps {
  /** True once the underlying canvas sequence settles on the hub/target frame. */
  readonly isReady: boolean;
  /** Tailwind positioning utilities (e.g. `left-[10%] top-[38.5%]`). */
  readonly positionClassName: string;
  /** Short uppercase tooltip text displayed above the button on hover. */
  readonly label: string;
  /** Accessible button description announced to screen readers. */
  readonly ariaLabel: string;
  /** Fade out button on click before triggering transition; false for in-place overlays. */
  readonly fadeOutOnClick?: boolean;
  /** Invoked when clicked (after the 260ms fade-out when `fadeOutOnClick` is true). */
  readonly onSelect?: () => void;
  /** Custom SVG glyph rendered inside the golden circular ring. */
  readonly children: React.ReactNode;
}

/**
 * Shared circular discovery button with volumetric followspot highlight,
 * 500ms cinematic reveal delay, hover glow, and floating label tooltip.
 */
export function CinematicDiscoveryButton({
  isReady,
  positionClassName,
  label,
  ariaLabel,
  fadeOutOnClick = true,
  onSelect,
  children,
}: CinematicDiscoveryButtonProps) {
  const [prevReady, setPrevReady] = useState<boolean>(isReady);
  const [isSettledAndReady, setIsSettledAndReady] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  if (prevReady !== isReady) {
    setPrevReady(isReady);
    if (!isReady) {
      setIsSettledAndReady(false);
      setIsFadingOut(false);
    }
  }

  useEffect(() => {
    if (!isReady || isFadingOut) {
      return;
    }

    const timer = setTimeout(() => {
      setIsSettledAndReady(true);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [isReady, isFadingOut]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isReady || isFadingOut) return;

    if (fadeOutOnClick) {
      setIsFadingOut(true);
    }
    // Invoke synchronously inside the native tap/click gesture so mobile iOS/Android
    // grant immediate hardware <video>.play() activation without losing UserActivation.
    onSelect?.();
  };

  const isVisible = isSettledAndReady && isReady && !isFadingOut;

  const cardStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? "translate3d(0, 0, 0) scale(1)"
      : isFadingOut
        ? "translate3d(0, -16px, 0) scale(0.92)"
        : "translate3d(0, 18px, 0) scale(0.9)",
    pointerEvents: isVisible ? "auto" : "none",
    willChange: "transform, opacity",
    transition: isFadingOut
      ? "transform 0.26s cubic-bezier(0.4, 0, 1, 1), opacity 0.26s ease-in"
      : isVisible
        ? "transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.65s cubic-bezier(0.2, 0, 0, 1)"
        : "transform 0.2s ease-out, opacity 0.18s ease-out",
  };

  return (
    <div
      style={cardStyle}
      className={`absolute ${positionClassName} -translate-x-1/2 -translate-y-1/2 z-30 select-none`}
    >
      {/* Mount blurred spotlight SVG only after settling so hidden blur never runs during canvas motion */}
      {isSettledAndReady && isReady && (
        <TheaterSpotlight
          className="-top-[170px] sm:-top-[210px] left-1/2 -translate-x-1/2 w-[280px] sm:w-[340px] h-[360px] sm:h-[430px] -z-10 animate-theater-spotlight"
          fill="#fef08a"
        />
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={!isVisible}
        className="group relative flex h-14 w-14 sm:h-16 sm:w-16 2xl:h-20 2xl:w-20 items-center justify-center rounded-full border-[2.5px] border-[#eac77e] bg-gradient-to-b from-[#1a140b]/85 via-[#0b1c16]/75 to-[#040814]/85 shadow-[0_0_24px_rgba(234,199,126,0.6),inset_0_0_12px_rgba(234,199,126,0.25)] ring-1 ring-white/10 transition-all duration-300 hover:border-[#fef08a] hover:bg-[#071324]/90 hover:scale-110 hover:shadow-[0_0_36px_rgba(254,240,138,0.85),inset_0_0_16px_rgba(254,240,138,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d993] cursor-pointer"
        aria-label={ariaLabel}
      >
        {children}

        {/* Floating Tooltip Label positioned above the button (always visible on mobile touch screens) */}
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-100 md:opacity-0 pointer-events-none md:group-hover:opacity-100 transition-all duration-200 rounded-md bg-[#030712]/95 border border-[#cda250]/45 px-2.5 py-0.5 text-[10px] sm:text-xs font-brand tracking-widest uppercase text-[#f4d993] shadow-lg whitespace-nowrap md:group-hover:-translate-y-1">
          {label}
        </span>
      </button>
    </div>
  );
}
