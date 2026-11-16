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
 * Aceternity-Style Theater Stage Spotlight (Downward Beam)
 * Specifically configured for vertical followspot projection onto scene elements.
 */
export function TheaterSpotlight({
  className = "",
  fill = "#fef08a",
}: SpotlightProps) {
  const filterId = `theater-filter-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      className={`pointer-events-none absolute select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 600"
      fill="none"
    >
      <g filter={`url(#${filterId})`}>
        {/* Soft Volumetric Downward Cone */}
        <polygon
          points="180,10 220,10 360,540 40,540"
          fill={fill}
          fillOpacity="0.18"
        />
        {/* Intense Core Followspot Beam */}
        <polygon
          points="190,10 210,10 300,540 100,540"
          fill={fill}
          fillOpacity="0.28"
        />
        {/* Illuminated Floor / Stair Pool */}
        <ellipse
          cx="200"
          cy="540"
          rx="140"
          ry="35"
          fill={fill}
          fillOpacity="0.22"
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="-50"
          y="-50"
          width="500"
          height="700"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="32" result="theaterBlur" />
        </filter>
      </defs>
    </svg>
  );
}
