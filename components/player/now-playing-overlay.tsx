"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { NowPlayingView } from "./now-playing-view";

export function NowPlayingOverlay() {
  const nowPlayingOpen = useUIStore((state) => state.nowPlayingOpen);
  const closeNowPlaying = useUIStore((state) => state.closeNowPlaying);

  const [rendered, setRendered] = useState(nowPlayingOpen);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    if (nowPlayingOpen) {
      setRendered(true);
      setDragY(0);
      setIsDragging(false);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setEntered(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }

    setEntered(false);
    setIsDragging(false);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setDragY(0);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [nowPlayingOpen]);

  // Lock background document scroll while the overlay is open
  useEffect(() => {
    if (!nowPlayingOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorY = "contain";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overscrollBehaviorY = prevOverscroll;
    };
  }, [nowPlayingOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!nowPlayingOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNowPlaying();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nowPlayingOpen, closeNowPlaying]);

  if (!rendered) return null;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!nowPlayingOpen || e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("input, [role='slider'], [data-no-overlay-drag='true'], [data-overlay-scroll-lock='true']")
    ) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      active: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const touch = e.touches[0];
    if (!drag || !touch || !nowPlayingOpen) return;

    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;

    if (!drag.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        dragRef.current = null;
        return;
      }
      if (dy > 8 && dy > Math.abs(dx) * 1.2) {
        drag.active = true;
        setIsDragging(true);
      }
    }

    if (drag.active) {
      setDragY(Math.max(0, dy));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.active) return;

    const touch = e.changedTouches[0];
    const dy = touch ? Math.max(0, touch.clientY - drag.startY) : dragY;
    const elapsedMs = Math.max(1, Date.now() - drag.startTime);
    const velocity = dy / elapsedMs;

    setIsDragging(false);

    if (dy > 110 || (dy > 40 && velocity > 0.5)) {
      closeNowPlaying();
    } else {
      setDragY(0);
    }
  };

  const handleTouchCancel = () => {
    dragRef.current = null;
    setIsDragging(false);
    setDragY(0);
  };

  const backdropOpacity = entered ? Math.max(0, 1 - dragY / 500) : 0;
  const backdropStyle: CSSProperties = {
    opacity: backdropOpacity,
    transition: isDragging ? "none" : "opacity 260ms ease-out",
  };

  const sheetStyle: CSSProperties = {
    transform: entered ? `translate3d(0, ${dragY}px, 0)` : "translate3d(0, 100%, 0)",
    transition: isDragging
      ? "none"
      : entered
        ? "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      className="fixed inset-0 z-[60] overflow-hidden"
    >
      {/* Live-screen dimming backdrop */}
      <div
        aria-hidden="true"
        onClick={closeNowPlaying}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={backdropStyle}
      />

      {/* Sliding Now Playing sheet */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="relative h-dvh w-full overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.75)]"
        style={sheetStyle}
      >
        <NowPlayingView onDismiss={closeNowPlaying} isOverlay />
      </div>
    </div>
  );
}
