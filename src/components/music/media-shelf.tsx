"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaShelfProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scrollable shelf with smooth desktop Left/Right navigation arrows
 * that automatically appear only when overflow is scrollable.
 */
export function MediaShelf({ children, className }: MediaShelfProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState, children]);

  const scrollByAmount = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(240, Math.round(el.clientWidth * 0.78)) * direction;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="group/shelf relative">
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-1)}
          aria-label="Scroll left"
          className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black md:flex md:opacity-0 md:group-hover/shelf:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        className={cn(
          "flex gap-3 overflow-x-auto pb-2 scroll-smooth sm:gap-4",
          className
        )}
      >
        {children}
      </div>

      {canRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(1)}
          aria-label="Scroll right"
          className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black md:flex md:opacity-0 md:group-hover/shelf:opacity-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
