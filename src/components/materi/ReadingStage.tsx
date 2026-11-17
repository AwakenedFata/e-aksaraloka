"use client";

interface ReadingStageProps {
  readonly containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Stage 3: Reading Exploration Sequence (frames 1-537)
 * Continuously connects from Materi Frame 299.
 * Provides the scroll track for the first-person POV taking book from shelf
 * and opening the pages on the desk.
 */
export function ReadingStage({ containerRef }: ReadingStageProps) {
  return (
    <section
      ref={containerRef}
      id="reading"
      aria-label="Eksplorasi Membaca Buku Pembelajaran"
      className="relative min-h-[440vh] w-full bg-transparent pointer-events-none"
    />
  );
}
