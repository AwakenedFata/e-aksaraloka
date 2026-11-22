"use client";

import React, { useId } from "react";

interface SpotlightProps {
  readonly className?: string;
  readonly fill?: string;
}

/**
 * Aceternity UI — Spotlight Component
 *
 * Renders a high-fidelity atmospheric Gaussian-blurred spotlight beam
 * mimicking stage and architectural theater followspots.
 */
export function Spotlight({ className = "", fill = "#f4d993" }: SpotlightProps) {
  const filterId = `spotlight-filter-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      className={`animate-spotlight pointer-events-none absolute z-[1] opacity-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter={`url(#${filterId})`}>
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill}
          fillOpacity="0.25"
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * GPU-composited Theater Stage Spotlight (Downward Beam)
 * Replaces heavy SVG <feGaussianBlur stdDeviation="32"> with pure CSS gradients
 * so 3 simultaneous Hub followspots cost ~0ms on mobile GPUs.
 */
export function TheaterSpotlight({
  className = "",
  fill = "#fef08a",
}: SpotlightProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none ${className}`}
    >
      <div
        className="h-full w-full"
        style={{
          background: `radial-gradient(ellipse 46% 62% at 50% 34%, ${fill}36 0%, ${fill}1a 42%, transparent 74%), radial-gradient(ellipse 52% 16% at 50% 88%, ${fill}2c 0%, transparent 72%)`,
          clipPath: "polygon(43% 0%, 57% 0%, 96% 96%, 4% 96%)",
        }}
      />
    </div>
  );
}
