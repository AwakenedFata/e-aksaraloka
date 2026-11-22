"use client";

import { HeroContent } from "./HeroContent";

interface HeroSectionProps {
  readonly containerRef?: React.RefObject<HTMLElement | null>;
  readonly heroOverlayRef?: React.RefObject<HTMLDivElement | null>;
  readonly currentStep?: 1 | 2 | 3;
  readonly isHeroContentVisible?: boolean;
  readonly isHeroInteractive?: boolean;
  readonly isHeroAtEnd?: boolean;
  readonly isMateriUnlocked?: boolean;
  readonly onNavigateToHub?: () => void;
}

export function HeroSection({
  containerRef,
  heroOverlayRef,
  currentStep = 1,
  isHeroContentVisible = true,
  isHeroInteractive = true,
  isHeroAtEnd = false,
  isMateriUnlocked = false,
  onNavigateToHub,
}: HeroSectionProps) {
  return (
    <section
      ref={containerRef}
      aria-labelledby="hero-heading"
      className="relative h-[300vh] w-full bg-transparent"
    >
      {/* Pinned Viewport (Stays sticky during the hero scroll distance; uses 100dvh so mobile URL/nav bars never sink the bottom card) */}
      <div
        ref={heroOverlayRef}
        className={`sticky top-0 h-dvh w-full overflow-hidden bg-transparent transition-opacity duration-300 ${
          isMateriUnlocked ? "pointer-events-none invisible opacity-0" : "opacity-100"
        }`}
      >
        {/* Foreground Content: Editorial Reference Layout — strictly suppressed when past frame 50 or at hub */}
        {!isMateriUnlocked && !isHeroAtEnd && isHeroContentVisible && (
          <HeroContent
            currentStep={currentStep}
            isHeroInteractive={isHeroInteractive}
            onNavigateToHub={onNavigateToHub}
          />
        )}
      </div>
    </section>
  );
}
