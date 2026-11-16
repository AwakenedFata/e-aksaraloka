"use client";

import React from "react";
import type { PageDisplacementSpec } from "@/lib/ui/bookHomography";

interface BookPageDisplacementDefsProps {
  readonly prefix: string;
  readonly leftWidth: number;
  readonly rightWidth: number;
  readonly pageHeight: number;
  readonly leftDisp: PageDisplacementSpec;
  readonly rightDisp: PageDisplacementSpec;
  /** Enables subtle paper-fiber ink porosity and capillary micro-softening for sunlit 3D desk spreads. */
  readonly inkAbsorption?: boolean;
}

interface SinglePageDisplacementFilterProps {
  readonly prefix: string;
  readonly side: "left" | "right";
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly disp: PageDisplacementSpec;
  readonly inkAbsorption: boolean;
}

function SinglePageDisplacementFilter({
  prefix,
  side,
  pageWidth,
  pageHeight,
  disp,
  inkAbsorption,
}: SinglePageDisplacementFilterProps) {
  const pad = Math.ceil(disp.filterScale + 4);
  const token = `${prefix}-${side}`;
  const curvedResult = `${token}-curved`;
  const fiberResult = `${token}-fibers`;
  const fiberAlphaResult = `${token}-fiber-alpha`;
  const porousResult = `${token}-porous`;

  return (
    <filter
      id={`${prefix}-curve-${side}`}
      filterUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
      x={-pad}
      y={-pad}
      width={pageWidth + pad * 2}
      height={pageHeight + pad * 2}
    >
      <feFlood floodColor="rgb(128,128,128)" result={`${token}-neutral`} />
      <feImage
        href={disp.dataUri}
        x={0}
        y={0}
        width={pageWidth}
        height={pageHeight}
        preserveAspectRatio="none"
        result={`${token}-img`}
      />
      <feComposite
        in={`${token}-img`}
        in2={`${token}-neutral`}
        operator="over"
        result={`${token}-map`}
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2={`${token}-map`}
        scale={disp.filterScale}
        xChannelSelector="R"
        yChannelSelector="G"
        result={inkAbsorption ? curvedResult : undefined}
      />
      {inkAbsorption && (
        <>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.52 0.62"
            numOctaves={2}
            seed={side === "left" ? 11 : 23}
            result={fiberResult}
          />
          <feColorMatrix
            in={fiberResult}
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.42 0 0 0 0.68"
            result={fiberAlphaResult}
          />
          <feComposite
            in={curvedResult}
            in2={fiberAlphaResult}
            operator="in"
            result={porousResult}
          />
          <feGaussianBlur in={porousResult} stdDeviation="0.2" />
        </>
      )}
    </filter>
  );
}

/**
 * Shared hidden SVG <filter> definitions providing C1 surface curvature in strict sRGB
 * color space and neutral #808080 outer padding via feFlood + feComposite so displaced
 * pages never clone border or footer pixels outside container bounds.
 */
export function BookPageDisplacementDefs({
  prefix,
  leftWidth,
  rightWidth,
  pageHeight,
  leftDisp,
  rightDisp,
  inkAbsorption = false,
}: BookPageDisplacementDefsProps) {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="pointer-events-none absolute overflow-hidden"
    >
      <defs>
        <SinglePageDisplacementFilter
          prefix={prefix}
          side="left"
          pageWidth={leftWidth}
          pageHeight={pageHeight}
          disp={leftDisp}
          inkAbsorption={inkAbsorption}
        />
        <SinglePageDisplacementFilter
          prefix={prefix}
          side="right"
          pageWidth={rightWidth}
          pageHeight={pageHeight}
          disp={rightDisp}
          inkAbsorption={inkAbsorption}
        />
      </defs>
    </svg>
  );
}

/**
 * Shared hidden SVG filter definitions used to give inked headings,
 * hand-drawn SVG diagrams, and hairline ink dividers an organic
 * contour following parchment fibers without blurring small body copy.
 */
export function ParchmentInkFilters() {
  return (
    <svg
      className="pointer-events-none fixed h-0 w-0 overflow-hidden"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="parchment-contour-warp"
          x="-2%"
          y="-4%"
          width="104%"
          height="108%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.016 0.032"
            numOctaves="2"
            seed="7"
            result="paperNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="paperNoise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Shared lighting overlay across the center book binding crease and outer paper edges
 * so rendered ink and inputs naturally share the physical shading of single-page.webp.
 * Edges feather cleanly to transparent on all four sides to avoid hard rectangular cuts.
 */
export function ParchmentSpineShadowOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-[2.5%] left-[6.6%] right-[6.6%] z-20"
      style={{
        background: `linear-gradient(
          90deg,
          rgba(30, 17, 6, 0.0) 0%,
          rgba(30, 17, 6, 0.08) 1.5%,
          rgba(30, 17, 6, 0.0) 6.5%,
          rgba(30, 17, 6, 0.0) 43.0%,
          rgba(24, 13, 4, 0.14) 47.8%,
          rgba(16, 9, 3, 0.22) 49.05%,
          rgba(24, 13, 4, 0.14) 50.3%,
          rgba(30, 17, 6, 0.0) 55.0%,
          rgba(30, 17, 6, 0.0) 93.5%,
          rgba(30, 17, 6, 0.08) 98.5%,
          rgba(30, 17, 6, 0.0) 100%
        )`,
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)",
        mixBlendMode: "multiply",
      }}
    />
  );
}
