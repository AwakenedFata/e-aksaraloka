"use client";

import { useEffect } from "react";

export interface FeatureNoticeData {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

interface FeatureNoticeModalProps {
  readonly notice: FeatureNoticeData | null;
  readonly onClose: () => void;
}

/**
 * Shared obsidian-and-gold preview dialog used by hub menus whose full feature
 * scenes or modules are not mounted yet. Supports Escape key and backdrop close.
 */
export function FeatureNoticeModal({
  notice,
  onClose,
}: FeatureNoticeModalProps) {
  useEffect(() => {
    if (!notice) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notice, onClose]);

  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-notice-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#cda250]/50 bg-[#030712]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-semibold tracking-[0.22em] text-[#f4d993] uppercase">
          {notice.eyebrow}
        </p>
        <h2
          id="feature-notice-title"
          className="mt-2 font-serif text-2xl font-medium text-white"
        >
          {notice.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {notice.description}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#cda250]/60 bg-[#071324] px-5 py-2 text-xs font-brand tracking-widest uppercase text-[#f4d993] transition-colors hover:border-[#fef08a] hover:bg-[#0f1f38] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d993]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
