"use client";

import { useEffect, useRef, useMemo, createContext, useContext } from "react";
import Lenis from "lenis";

export interface LenisContextValue {
  scrollTo: (
    target: HTMLElement | string | number,
    options?: Parameters<Lenis["scrollTo"]>[1]
  ) => void;
  resize: () => void;
  stop: () => void;
  start: () => void;
  getInstance: () => Lenis | null;
}

const LenisContext = createContext<LenisContextValue>({
  scrollTo: () => {},
  resize: () => {},
  stop: () => {},
  start: () => {},
  getInstance: () => null,
});

/**
 * Access the active Lenis smooth scroll controls
 */
export function useLenis(): LenisContextValue {
  return useContext(LenisContext);
}

interface SmoothScrollProviderProps {
  readonly children: React.ReactNode;
}

/**
 * High-performance smooth scrolling provider using Lenis.
 * Interpolates native scroll events into buttery 60/120 FPS motion,
 * preventing sudden mouse-wheel jumps and harmonizing scroll image sequences.
 * Automatically respects prefers-reduced-motion.
 */
export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);

  const contextValue = useMemo<LenisContextValue>(
    () => ({
      scrollTo: (target, options) => {
        lenisRef.current?.scrollTo(target as HTMLElement, options);
      },
      resize: () => {
        lenisRef.current?.resize();
      },
      stop: () => {
        lenisRef.current?.stop();
      },
      start: () => {
        lenisRef.current?.start();
      },
      getInstance: () => lenisRef.current,
    }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect user's reduced-motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.2,
    });

    lenisRef.current = lenis;

    let animationFrameId: number;

    const raf = (time: number) => {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    };

    animationFrameId = requestAnimationFrame(raf);

    // Smooth scroll for hash/anchor links (e.g. #materi, #alur, #)
    // Runs in bubble phase after React handlers so custom stage navigation takes precedence.
    const handleAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Back to top (#)
      if (href === "#") {
        e.preventDefault();
        lenis.scrollTo(0, {
          duration: 3,
          easing: (t: number) => (1 - Math.cos(Math.PI * t)) / 2,
        });
        return;
      }

      if (href.startsWith("#") && href.length > 1) {
        const targetElement = document.querySelector(href);
        if (targetElement) {
          e.preventDefault();

          const customDurationAttr = target.getAttribute("data-scroll-duration");
          const isMateriTarget = href === "#materi" || href.startsWith("#materi");

          const targetDuration = customDurationAttr
            ? parseFloat(customDurationAttr) || 4.0
            : isMateriTarget
            ? 4.0
            : 1.2;

          const easingFunc = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

          lenis.scrollTo(targetElement as HTMLElement, {
            offset: 0,
            duration: targetDuration,
            easing: easingFunc,
          });
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisContext.Provider value={contextValue}>
      {children}
    </LenisContext.Provider>
  );
}
