"use client";

interface LatihanStageProps {
  readonly containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Menu Latihan Exploration Sequence (frames 1-561)
 * Seamlessly connects three virtual segments from Hero Frame 240:
 * - Segment 1: latihan-frames (frames 1-185)
 * - Segment 2: hallway-frames (frames 186-373)
 * - Segment 3: studio-tulis-frames (frames 374-561)
 * Provides the continuous vertical scroll track for the journey into Studio Tulis.
 */
export function LatihanStage({ containerRef }: LatihanStageProps) {
  return (
    <section
      ref={containerRef}
      id="studio"
      aria-label="Eksplorasi Menu Latihan Menuju Studio Tulis"
      className="relative min-h-[460vh] w-full bg-transparent pointer-events-none"
    />
  );
}
