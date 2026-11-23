"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface TeacherTooltipProps {
  readonly content: string;
  readonly label?: string;
  readonly align?: "left" | "center" | "right";
  readonly position?: "top" | "bottom";
}

interface TooltipCoords {
  readonly left: number;
  readonly top: number;
  readonly placedTop: boolean;
}

const TOOLTIP_WIDTH = 264;
const VIEWPORT_MARGIN = 12;

/**
 * Viewport-clamped accessible hover + click/tap tooltip.
 * Uses `fixed` coordinates derived from the trigger button so tooltips inside
 * `overflow-x-auto` tables or `overflow-hidden` modals are NEVER clipped or cut off.
 */
export function TeacherTooltip({
  content,
  label = "Penjelasan singkat",
  align = "center",
  position = "bottom",
}: TeacherTooltipProps) {
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const open = coords !== null;

  const computeCoords = useCallback((): TooltipCoords | null => {
    const btn = buttonRef.current;
    if (!btn || typeof window === "undefined") return null;

    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const effectiveWidth = Math.min(TOOLTIP_WIDTH, vw - VIEWPORT_MARGIN * 2);

    let desiredLeft: number;
    if (align === "left") {
      desiredLeft = rect.left;
    } else if (align === "right") {
      desiredLeft = rect.right - effectiveWidth;
    } else {
      desiredLeft = rect.left + rect.width / 2 - effectiveWidth / 2;
    }

    const clampedLeft = Math.max(
      VIEWPORT_MARGIN,
      Math.min(desiredLeft, vw - effectiveWidth - VIEWPORT_MARGIN)
    );

    const spaceBelow = vh - rect.bottom;
    const shouldPlaceTop =
      position === "top" ? rect.top > 130 : spaceBelow < 140 && rect.top > 130;

    return {
      left: clampedLeft,
      top: shouldPlaceTop ? rect.top - 8 : rect.bottom + 8,
      placedTop: shouldPlaceTop,
    };
  }, [align, position]);

  const openTooltip = useCallback(() => {
    setCoords(computeCoords());
  }, [computeCoords]);

  const closeTooltip = useCallback(() => {
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setCoords(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCoords(null);
      }
    };
    const handleViewportChange = () => {
      setCoords(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            closeTooltip();
          } else {
            openTooltip();
          }
        }}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#cda250]/55 bg-[#0d182d] text-[10px] font-bold text-[#f4d993] hover:border-[#f4d993] hover:bg-[#162645] focus-visible:outline-2 focus-visible:outline-[#f4d993] cursor-pointer transition-colors"
      >
        ?
      </button>

      {coords && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            left: `${coords.left}px`,
            top: `${coords.top}px`,
            width: `${TOOLTIP_WIDTH}px`,
            maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
            transform: coords.placedTop ? "translateY(-100%)" : undefined,
          }}
          className="pointer-events-none fixed z-[70] rounded-xl border border-[#cda250]/65 bg-[#0c162b] px-3.5 py-2.5 text-left text-xs font-normal normal-case tracking-normal leading-relaxed text-stone-100 shadow-[0_16px_42px_rgba(0,0,0,0.9)]"
        >
          {content}
        </span>
      )}
    </span>
  );
}

interface CoachMarkBadgeProps {
  readonly stepNumber: number;
  readonly totalSteps: number;
  readonly text: string;
}

/**
 * Floating golden coach-mark pill shown on the highlighted section during the
 * interactive teacher walkthrough.
 */
export function CoachMarkBadge({
  stepNumber,
  totalSteps,
  text,
}: CoachMarkBadgeProps) {
  return (
    <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-[#f4d993] bg-[#f4d993] px-3 py-1 text-[11px] font-bold text-[#030712] shadow-lg shadow-[#cda250]/30">
      <span className="rounded-full bg-[#030712] px-2 py-0.5 text-[10px] text-[#f4d993]">
        Langkah {stepNumber}/{totalSteps}
      </span>
      <span>{text}</span>
    </div>
  );
}
