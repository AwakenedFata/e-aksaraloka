"use client";

import {
  CinematicDiscoveryButton,
  DISCOVERY_ICON_CLASS,
} from "@/components/shared/ui/CinematicDiscoveryButton";

interface LatihanHubButtonProps {
  /** Whether the Hero sequence has reached its final hub frame (Frame 240). */
  readonly isHeroAtEnd?: boolean;
  /** Invoked when the user selects the Latihan hub menu button. */
  readonly onSelect?: () => void;
}

/**
 * Interactive discovery button for Menu Latihan positioned over the left-center
 * gothic window on Hero Frame 240, using the winding parchment glyph from icon-latihan.svg.
 */
export function LatihanHubButton({
  isHeroAtEnd = false,
  onSelect,
}: LatihanHubButtonProps) {
  return (
    <CinematicDiscoveryButton
      isReady={isHeroAtEnd}
      positionClassName="left-[32.7%] top-[41.8%]"
      label="Latihan"
      ariaLabel="Buka Menu Latihan dan Eksperimen Menulis"
      onSelect={onSelect}
    >
      <svg
        viewBox="21 20 60 57"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={DISCOVERY_ICON_CLASS}
        aria-hidden="true"
      >
        <path
          d="M31 27 H68 C75 27 76 37 68 40 H35 C25 40 25 54 36 54 H68 C78 54 78 70 67 70 H31"
          stroke="#EAC77E"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M34 28 V70 M66 28 Q60 33 66 40 M34 54 Q43 47 49 54"
          stroke="#F4D993"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </CinematicDiscoveryButton>
  );
}
