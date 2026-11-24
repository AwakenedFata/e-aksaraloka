"use client";

interface MateriCurriculumSectionProps {
  readonly materiProgress?: number;
}

export function MateriCurriculumSection({
  materiProgress = 0,
}: MateriCurriculumSectionProps) {
  // Fade in smoothly as the camera approaches the study desk at the end of the sequence (progress > 0.85)
  const isRevealed = materiProgress >= 0.82;
  const revealProgress = Math.min(1, Math.max(0, (materiProgress - 0.82) / 0.18));

  const contentStyle: React.CSSProperties = {
    opacity: isRevealed ? revealProgress : 0,
    transform: `translate3d(0, ${(1 - revealProgress) * 30}px, 0)`,
    pointerEvents: isRevealed && revealProgress > 0.8 ? "auto" : "none",
    transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
  };

  return (
    <div
      style={contentStyle}
      className="relative z-30 mx-auto max-w-6xl px-6 py-20 sm:px-8 lg:px-12"
    >
      {/* Header Eyebrow & Title */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#cda250]/40 bg-[#071324]/80 px-4 py-1.5 backdrop-blur-md shadow-lg shadow-black/40">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f4d993] animate-pulse" />
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-[#f4d993] uppercase">
            MODUL PEMBELAJARAN KELAS VII
          </span>
        </div>

        <h2 className="mt-5 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
          Struktur Teks Narasi Fantasi
        </h2>

        <p className="mt-4 text-sm sm:text-base lg:text-lg text-stone-300 leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Setiap karya fiksi fantasi dibangun oleh tiga pilar utama yang menghidupkan alur cerita dan memikat pembaca.
        </p>
      </div>

      {/* 3 Pillars Grid: Orientasi, Komplikasi, Resolusi */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {/* Card 1: Orientasi */}
        <div className="group relative rounded-2xl border border-white/15 bg-[#030712]/75 p-6 sm:p-7 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 transition-all duration-300 hover:border-[#cda250]/60 hover:bg-[#071324]/90 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#f4d993] tracking-widest uppercase">
              Bagian 01
            </span>
            <span className="h-2 w-2 rounded-full bg-[#cda250]" />
          </div>

          <h3 className="mt-4 font-serif text-xl sm:text-2xl font-semibold text-white group-hover:text-[#f4d993] transition-colors">
            Orientasi
          </h3>

          <p className="mt-3 text-xs sm:text-sm text-stone-300 leading-relaxed">
            Tahap awal mengenalkan tokoh, watak, latar tempat ajaib, latar waktu, dan suasana semesta fantasi tempat kisah bermula.
          </p>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#f4d993]/90 font-medium">
            Kunci: Deskripsi Indrawi latar magis
          </div>
        </div>

        {/* Card 2: Komplikasi */}
        <div className="group relative rounded-2xl border border-white/15 bg-[#030712]/75 p-6 sm:p-7 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 transition-all duration-300 hover:border-[#cda250]/60 hover:bg-[#071324]/90 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#f4d993] tracking-widest uppercase">
              Bagian 02
            </span>
            <span className="h-2 w-2 rounded-full bg-[#cda250]" />
          </div>

          <h3 className="mt-4 font-serif text-xl sm:text-2xl font-semibold text-white group-hover:text-[#f4d993] transition-colors">
            Komplikasi
          </h3>

          <p className="mt-3 text-xs sm:text-sm text-stone-300 leading-relaxed">
            Munculnya peristiwa pemicu konflik, tantangan berbahaya, kutukan, atau rintangan yang harus diatasi oleh tokoh utama.
          </p>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#f4d993]/90 font-medium">
            Kunci: Hubungan sebab-akibat alur
          </div>
        </div>

        {/* Card 3: Resolusi */}
        <div className="group relative rounded-2xl border border-white/15 bg-[#030712]/75 p-6 sm:p-7 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 transition-all duration-300 hover:border-[#cda250]/60 hover:bg-[#071324]/90 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#f4d993] tracking-widest uppercase">
              Bagian 03
            </span>
            <span className="h-2 w-2 rounded-full bg-[#cda250]" />
          </div>

          <h3 className="mt-4 font-serif text-xl sm:text-2xl font-semibold text-white group-hover:text-[#f4d993] transition-colors">
            Resolusi
          </h3>

          <p className="mt-3 text-xs sm:text-sm text-stone-300 leading-relaxed">
            Penyelesaian masalah dan akhir dari petualangan. Menunjukkan bagaimana tokoh berubah setelah melewati rintangan besar.
          </p>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#f4d993]/90 font-medium">
            Kunci: Pesan moral & penutup kisah
          </div>
        </div>
      </div>
    </div>
  );
}
