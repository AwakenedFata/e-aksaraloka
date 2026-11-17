"use client";

interface MateriStageProps {
  readonly containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Stage 2: Materi Exploration Sequence (frames 1-299)
 * Seamlessly extends from Hero Frame 240.
 * Provides the vertical scrollable track for the cinematic sequence.
 * All overlays on the final frame have been removed, leaving only the canvas background,
 * Navbar, and Ruang Pustaka back button visible.
 */
export function MateriStage({
  containerRef,
}: MateriStageProps) {
  return (
    <section
      ref={containerRef}
      id="materi"
      aria-label="Modul Pembelajaran Teks Narasi"
      className="relative min-h-[320vh] w-full bg-transparent pointer-events-none"
    />
  );
}
