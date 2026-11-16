"use client";

import {
  CinematicDiscoveryButton,
  DISCOVERY_ICON_CLASS,
} from "@/components/shared/ui/CinematicDiscoveryButton";

interface MateriReadButtonProps {
  /**
   * Whether the Materi sequence has reached its final frame (Frame 299) and settled.
   * The button remains completely hidden until Frame 299 is reached and stopped.
   */
  readonly isMateriAtEnd?: boolean;

  /**
   * Callback fired after button click and fade-out animation completes
   * to transition the application into Reading mode (Choosing + Opening Book).
   */
  readonly onEnterReading?: () => void;
}

/**
 * Interactive discovery button situated on the central bookshelf at Materi Frame 299.
 * Initiates the first-person POV sequence of reaching for the book and opening its pages.
 */
export function MateriReadButton({
  isMateriAtEnd = false,
  onEnterReading,
}: MateriReadButtonProps) {
  return (
    <CinematicDiscoveryButton
      isReady={isMateriAtEnd}
      positionClassName="left-[50%] top-[48%]"
      label="Baca Buku"
      ariaLabel="Ambil dan Buka Buku Materi Pembelajaran"
      onSelect={onEnterReading}
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
