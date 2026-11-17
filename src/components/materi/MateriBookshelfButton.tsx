"use client";

import {
  CinematicDiscoveryButton,
  DISCOVERY_ICON_CLASS,
} from "@/components/shared/ui/CinematicDiscoveryButton";

interface MateriBookshelfButtonProps {
  /**
   * Whether the Hero sequence has reached its final frame (Frame 240) and stopped.
   * The button remains completely hidden until Frame 240 is reached and settled.
   */
  readonly isHeroAtEnd?: boolean;

  /**
   * Callback fired after button click and fade-out animation completes
   * to transition the application into Materi mode.
   */
  readonly onEnterMateri?: () => void;
}

/**
 * Interactive glassmorphic discovery button situated directly on the left bookshelf
 * of the Grand Aksaraloka Library (Frame 240).
 */
export function MateriBookshelfButton({
  isHeroAtEnd = false,
  onEnterMateri,
}: MateriBookshelfButtonProps) {
  return (
    <CinematicDiscoveryButton
      isReady={isHeroAtEnd}
      positionClassName="left-[18%] top-[40%] md:left-[10%] md:top-[38.5%]"
      label="Materi"
      ariaLabel="Buka Modul Materi Pembelajaran Teks Narasi"
      onSelect={onEnterMateri}
    >
      <svg
        viewBox="20 22 60 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={DISCOVERY_ICON_CLASS}
        aria-hidden="true"
      >
        <path
          d="M50 33 C39 25 28 27 23 31 V68 C33 64 42 66 50 73 C58 66 67 64 77 68 V31 C72 27 61 25 50 33Z"
          stroke="#EAC77E"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d="M50 33 V72 M30 38 Q39 36 44 42 M70 38 Q61 36 56 42"
          stroke="#F4D993"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </CinematicDiscoveryButton>
  );
}
