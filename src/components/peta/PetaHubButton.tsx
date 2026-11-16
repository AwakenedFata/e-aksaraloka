"use client";

import {
  CinematicDiscoveryButton,
  DISCOVERY_ICON_CLASS,
} from "@/components/shared/ui/CinematicDiscoveryButton";
import type { FeatureNoticeData } from "@/components/shared/ui/FeatureNoticeModal";

export const PETA_NOTICE: FeatureNoticeData = {
  eyebrow: "HUB MENU · PETA",
  title: "Peta Pembelajaran & Quest",
  description:
    "Tombol Peta sudah aktif pada area Hub. Tampilan progres materi dan quest interaktif sedang disiapkan untuk dihubungkan ke titik ini.",
};

interface PetaHubButtonProps {
  /** Whether the Hero sequence has reached its final hub frame (Frame 240). */
  readonly isHeroAtEnd?: boolean;
  /** Invoked when the user selects the Peta hub menu button. */
  readonly onSelect?: () => void;
}

/**
 * Interactive discovery button for Menu Peta positioned above the golden armillary
 * sphere on Hero Frame 240, using the compass star glyph from icon-peta.svg.
 */
export function PetaHubButton({
  isHeroAtEnd = false,
  onSelect,
}: PetaHubButtonProps) {
  return (
    <CinematicDiscoveryButton
      isReady={isHeroAtEnd}
      positionClassName="left-[69.7%] top-[46%]"
      label="Peta"
      ariaLabel="Buka Peta Pembelajaran dan Progres Quest"
      fadeOutOnClick={false}
      onSelect={onSelect}
    >
      <svg
        viewBox="13 13 74 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={DISCOVERY_ICON_CLASS}
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="25" stroke="#F4D993" strokeWidth="1.9" />
        <circle cx="50" cy="50" r="8" stroke="#EAC77E" strokeWidth="2.4" />
        <path
          d="M50 18 L56 44 L82 50 L56 56 L50 82 L44 56 L18 50 L44 44Z"
          stroke="#EAC77E"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      </svg>
    </CinematicDiscoveryButton>
  );
}
