"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toggleAudioMuted } from "@/lib/learning/audioEngine";
import type { GrimoireChapterId } from "@/lib/learning/narrativeCurriculumData";

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly isActive?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Beranda", href: "#", isActive: true },
  { label: "Materi", href: "#materi" },
  { label: "Alur Narasi", href: "#alur" },
  { label: "Studio Tulis", href: "#studio" },
  { label: "Pustaka", href: "#pustaka" },
];

interface NavbarProps {
  readonly activeStage?: "hero" | "materi" | "reading" | "latihan";
  readonly isHeroAtEnd?: boolean;
  readonly isReverseScrolling?: boolean;
  readonly isScrolledPastStart?: boolean;
  readonly isHidden?: boolean;
  readonly onReturnToHero?: () => void;
  readonly onReturnToMateri?: () => void;
  readonly onNavigateToHub?: () => void;
  readonly onNavigateToTop?: () => void;
  readonly onOpenKitabChapter?: (chapter: GrimoireChapterId) => void;
  readonly onNavigateToStudioTulis?: () => void;
  readonly onOpenPetaModal?: () => void;
}

export function Navbar({
  activeStage = "hero",
  isHeroAtEnd = false,
  isReverseScrolling = false,
  isScrolledPastStart = false,
  isHidden = false,
  onReturnToHero,
  onReturnToMateri,
  onNavigateToHub,
  onNavigateToTop,
  onOpenKitabChapter,
  onNavigateToStudioTulis,
  onOpenPetaModal,
}: NavbarProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const handleBrandClick = (e: React.MouseEvent) => {
    if (activeStage === "reading" && onReturnToMateri) {
      e.preventDefault();
      onReturnToMateri();
    } else if ((activeStage === "materi" || activeStage === "latihan") && onReturnToHero) {
      e.preventDefault();
      onReturnToHero();
    } else if (activeStage === "hero" && onNavigateToTop) {
      e.preventDefault();
      onNavigateToTop();
    }
  };

  const handleMateriClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activeStage === "hero" && !isHeroAtEnd && onNavigateToHub) {
      onNavigateToHub();
    } else if (onOpenKitabChapter) {
      onOpenKitabChapter("alur");
    }
  };

  const handleAlurClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenKitabChapter) {
      onOpenKitabChapter("alur");
    }
  };

  const handleStudioClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateToStudioTulis) {
      onNavigateToStudioTulis();
    } else if (activeStage === "hero" && onNavigateToHub) {
      onNavigateToHub();
    }
  };

  const handlePustakaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenPetaModal) {
      onOpenPetaModal();
    }
  };

  const handleToggleAudio = () => {
    const nextMuted = toggleAudioMuted();
    setMuted(nextMuted);
  };

  // Solid atmospheric gradient instead of full-width backdrop-blur avoids per-frame GPU blur resampling over the canvas.
  const isSolidNavbar =
    isScrolled ||
    isScrolledPastStart ||
    activeStage === "materi" ||
    activeStage === "reading" ||
    activeStage === "latihan" ||
    isHeroAtEnd ||
    isReverseScrolling;

  return (
    <header
      aria-hidden={isHidden}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        activeStage === "latihan" ? "py-2.5 sm:py-3" : "py-4 sm:py-4.5"
      } ${
        isHidden
          ? "-translate-y-full opacity-0 pointer-events-none"
          : "translate-y-0 opacity-100"
      } ${
        isSolidNavbar
          ? "bg-gradient-to-b from-[#020617]/92 via-[#020617]/78 to-[#020617]/60 shadow-lg shadow-black/25"
          : "bg-gradient-to-b from-black/45 via-black/15 to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl 2xl:max-w-[1536px] items-center justify-between px-6 sm:px-8 lg:px-12 2xl:px-16">
        {/* Brand Logo with 4-Point Compass Star */}
        <Link
          href="/"
          onClick={handleBrandClick}
          className="group flex items-center gap-3 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Aksaraloka Beranda"
        >
          {/* Compass Star Glyph matching the reference AURORA logo */}
          <div className="flex h-7 w-7 items-center justify-center text-white transition-transform duration-300 group-hover:scale-110 group-hover:text-[#f4d993]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </div>

          <span className="font-brand text-lg tracking-[0.3em] font-semibold text-white uppercase no-underline transition-colors group-hover:text-[#f4d993]">
            AKSARALOKA
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav aria-label="Navigasi Utama" className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive =
              activeStage === "reading" || activeStage === "materi"
                ? item.label === "Materi"
                : activeStage === "latihan"
                ? item.label === "Studio Tulis"
                : item.label === "Beranda";

            const clickHandler =
              item.label === "Beranda"
                ? handleBrandClick
                : item.label === "Materi"
                ? handleMateriClick
                : item.label === "Alur Narasi"
                ? handleAlurClick
                : item.label === "Studio Tulis"
                ? handleStudioClick
                : item.label === "Pustaka"
                ? handlePustakaClick
                : undefined;

            return (
              <Link
                key={item.label}
                href={item.href}
                scroll={false}
                data-scroll-duration={item.href === "#materi" ? "4" : undefined}
                onClick={clickHandler}
                className={`relative py-1 text-sm tracking-wide no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-stone-300 font-medium hover:text-white"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Utility Buttons (Audio Ambience Toggle + White Pill Button) */}
        <div className="hidden md:flex items-center gap-3.5">
          {/* Dial / Audio Ambience Toggle Button */}
          <button
            type="button"
            onClick={handleToggleAudio}
            title={muted ? "Aktifkan Efek Suara Interaktif" : "Bungkam Efek Suara Interaktif"}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 focus-visible:outline-2 focus-visible:outline-white cursor-pointer ${
              muted
                ? "border-rose-400/40 bg-rose-950/50 text-rose-200 hover:border-rose-300"
                : "border-white/20 bg-[#020617]/65 text-stone-300 hover:border-white/50 hover:bg-[#071324]/80 hover:text-white"
            }`}
            aria-label={muted ? "Aktifkan Efek Suara Interaktif" : "Bungkam Efek Suara Interaktif"}
            aria-pressed={!muted}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-4.5 w-4.5"
              aria-hidden="true"
            >
              {muted ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </>
              )}
            </svg>
          </button>

          {/* White Pill Action Button with Arrow in Circle (hidden when already inside Studio Tulis) */}
          {activeStage !== "latihan" && (
            <Link
              href="#studio"
              scroll={false}
              onClick={handleStudioClick}
              className="group flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-xs font-semibold tracking-wider text-black no-underline transition-all duration-300 hover:bg-[#f4d993] hover:shadow-lg hover:shadow-white/10 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="uppercase">Mulai Menulis</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="h-3 w-3 text-black"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-stone-200 hover:text-white hover:border-white/40 focus-visible:outline-2 focus-visible:outline-white"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-[#020617]/95 px-6 pt-4 pb-6 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-2 duration-200"
        >
          <nav aria-label="Navigasi Seluler" className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                activeStage === "reading" || activeStage === "materi"
                  ? item.label === "Materi"
                  : activeStage === "latihan"
                  ? item.label === "Studio Tulis"
                  : item.label === "Beranda";

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  scroll={false}
                  data-scroll-duration={item.href === "#materi" ? "4" : undefined}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    if (item.label === "Beranda") {
                      handleBrandClick(e);
                    } else if (item.label === "Materi") {
                      handleMateriClick(e);
                    } else if (item.label === "Alur Narasi") {
                      handleAlurClick(e);
                    } else if (item.label === "Studio Tulis") {
                      handleStudioClick(e);
                    } else if (item.label === "Pustaka") {
                      handlePustakaClick(e);
                    }
                  }}
                  className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-base no-underline transition-colors ${
                    isActive
                      ? "bg-white/10 text-white font-semibold"
                      : "text-stone-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link
                href="#studio"
                scroll={false}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  handleStudioClick(e);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-wider text-black no-underline"
              >
                <span>Mulai Menulis</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
