"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ParchmentSelectOption {
  readonly value: string;
  readonly label: string;
}

interface ParchmentSelectProps {
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly options: readonly ParchmentSelectOption[];
  readonly onChange: (value: string) => void;
  readonly size?: "sm" | "md";
  readonly className?: string;
  readonly triggerClassName?: string;
}

interface FloatingDropdownRect {
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly bottomOffset: number;
  readonly openUpward: boolean;
  readonly maxHeight: number;
}

/**
 * Custom floating parchment dropdown that portals above book spreads without shifting
 * underlying layout elements or letting OS native <select> popups bloat on mobile.
 */
export function ParchmentSelect({
  id,
  ariaLabel,
  value,
  placeholder = "-- Pilih --",
  options,
  onChange,
  size = "md",
  className = "",
  triggerClassName = "",
}: ParchmentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingRect, setFloatingRect] = useState<FloatingDropdownRect | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLUListElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const triggerTextSizeClass =
    size === "sm" ? "text-xs md:text-[10px]" : "text-[13px] md:text-[11.5px]";
  const optionTextSizeClass =
    size === "sm"
      ? "font-serif text-xs md:text-[10.5px]"
      : "font-sans text-[12.5px] md:text-[11px]";

  const measureFloatingRect = useCallback((): FloatingDropdownRect | null => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return null;

    const rect = root.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.visualViewport?.height ?? window.innerHeight;
    const width = Math.max(120, Math.min(rect.width, viewportW - 16));
    const left = Math.max(8, Math.min(rect.left, viewportW - width - 8));

    const spaceBelow = Math.max(0, viewportH - rect.bottom - 12);
    const spaceAbove = Math.max(0, rect.top - 12);
    const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      96,
      Math.min(220, openUpward ? spaceAbove : spaceBelow)
    );

    return {
      left,
      width,
      top: rect.bottom + 4,
      bottomOffset: viewportH - rect.top + 4,
      openUpward,
      maxHeight,
    };
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const nextRect = measureFloatingRect();
    setFloatingRect(nextRect);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const syncPosition = () => {
      setFloatingRect(measureFloatingRect());
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      const inTrigger = rootRef.current?.contains(target) ?? false;
      const inPanel = panelRef.current?.contains(target) ?? false;
      if (!inTrigger && !inPanel) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("resize", syncPosition, { passive: true });
    window.addEventListener("scroll", syncPosition, {
      passive: true,
      capture: true,
    });
    window.visualViewport?.addEventListener("resize", syncPosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, { capture: true });
      window.visualViewport?.removeEventListener("resize", syncPosition);
    };
  }, [isOpen, measureFloatingRect]);

  const floatingMenu =
    isOpen && floatingRect && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            data-lenis-prevent
            aria-label={ariaLabel ?? placeholder}
            style={{
              position: "fixed",
              left: `${floatingRect.left}px`,
              width: `${floatingRect.width}px`,
              maxHeight: `${floatingRect.maxHeight}px`,
              ...(floatingRect.openUpward
                ? { bottom: `${floatingRect.bottomOffset}px` }
                : { top: `${floatingRect.top}px` }),
            }}
            className="parchment-scroll z-[80] overflow-y-auto overscroll-contain rounded-xl border border-[#5c3d1e]/60 bg-[#f7ebd0] shadow-[0_14px_30px_rgba(24,14,5,0.48)] divide-y divide-[#5c3d1e]/18"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 md:py-1 text-left ${optionTextSizeClass} leading-snug transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#cda250]/35 font-bold text-[#1e1106]"
                        : "text-[#2b1a0c] hover:bg-[#5c3d1e]/12"
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-words">{opt.label}</span>
                    {isSelected && (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5 shrink-0 text-[#5c3d1e]"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={`parchment-pen-input flex w-full min-h-[34px] md:min-h-0 items-center justify-between gap-2 px-1.5 py-1 md:py-0.5 text-left ${triggerTextSizeClass} font-semibold leading-snug text-[#241407] cursor-pointer ${triggerClassName}`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selectedOption ? "text-[#241407]" : "text-[#5c3d1e]/75 italic"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-3.5 w-3.5 shrink-0 text-[#5c3d1e] transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {floatingMenu}
    </div>
  );
}
