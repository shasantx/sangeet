"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { RightPanel } from "./right-panel";
import { MobileNavigation } from "./mobile-navigation";
import { MobileSidebar } from "./mobile-sidebar";
import { BottomPlayer } from "@/components/player/bottom-player";
import { MobileMiniPlayer } from "@/components/player/mobile-mini-player";
import { SiteAnnouncement } from "@/components/site/site-announcement";
import { SiteFooter } from "@/components/site/site-footer";
import { usePlayerStore } from "@/store/player-store";

const MOBILE_TABS = [
  {
    href: "/home",
    label: "Home",
    match: (path: string) => path === "/home" || path.startsWith("/home/"),
  },
  {
    href: "/search",
    label: "Search",
    match: (path: string) => path.startsWith("/search"),
  },
  {
    href: "/explore",
    label: "Explore",
    match: (path: string) =>
      ["/explore", "/genre", "/artist", "/album", "/new-releases", "/made-for-you"].some(
        (route) => path.startsWith(route),
      ),
  },
  {
    href: "/library",
    label: "Library",
    match: (path: string) =>
      ["/library", "/liked", "/recently-played", "/playlist", "/profile", "/settings"].some(
        (route) => path.startsWith(route),
      ),
  },
];

function shouldSkipTabSwipe(target: EventTarget | null, boundary: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('[data-no-tab-swipe], [role="slider"], input, textarea, select')) {
    return true;
  }

  let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  while (el && el !== boundary) {
    if (el.scrollWidth > el.clientWidth + 6) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") {
        return true;
      }
    }
    el = el.parentElement;
  }

  return false;
}

type SwipeHintState = {
  label: string;
  direction: "prev" | "next";
  ready: boolean;
} | null;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const hasTrack = Boolean(currentTrackId);
  const immersive =
    pathname === "/premium" ||
    pathname === "/now-playing" ||
    pathname === "/auth" ||
    pathname === "/login";

  const activeTabIndex = MOBILE_TABS.findIndex((tab) => tab.match(pathname));
  const swipeRef = useRef<{ startX: number; startY: number; locked: boolean } | null>(null);
  const scrollTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollDraggedRef = useRef(false);
  const lastDragEndedAtRef = useRef(0);
  const dragResetTimerRef = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState<SwipeHintState>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    swipeRef.current = null;
    scrollTouchStartRef.current = null;
    setSwipeHint(null);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current);
        dragResetTimerRef.current = null;
      }
    };
  }, []);

  const scheduleDragReset = () => {
    lastDragEndedAtRef.current = Date.now();
    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
    }
    dragResetTimerRef.current = window.setTimeout(() => {
      scrollDraggedRef.current = false;
      dragResetTimerRef.current = null;
    }, 160);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) {
      scrollTouchStartRef.current = null;
      swipeRef.current = null;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
    scrollTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    scrollDraggedRef.current = false;

    if (activeTabIndex === -1 || typeof window === "undefined" || window.innerWidth >= 768) {
      swipeRef.current = null;
      return;
    }
    if (shouldSkipTabSwipe(e.target, e.currentTarget)) {
      swipeRef.current = null;
      return;
    }

    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) {
      swipeRef.current = null;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const scrollStart = scrollTouchStartRef.current;
    if (scrollStart && !scrollDraggedRef.current) {
      const scrollDx = touch.clientX - scrollStart.x;
      const scrollDy = touch.clientY - scrollStart.y;
      if (Math.abs(scrollDx) > 10 || Math.abs(scrollDy) > 10) {
        scrollDraggedRef.current = true;
      }
    }

    const swipe = swipeRef.current;
    if (!swipe || activeTabIndex === -1) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;

    if (!swipe.locked && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
      swipeRef.current = null;
      setSwipeHint((prev) => (prev ? null : prev));
      return;
    }

    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.6;
    if (isHorizontal && Math.abs(dx) > 28) {
      swipe.locked = true;
      const nextIndex = dx < 0 ? activeTabIndex + 1 : activeTabIndex - 1;
      if (nextIndex >= 0 && nextIndex < MOBILE_TABS.length) {
        const targetTab = MOBILE_TABS[nextIndex];
        const direction: "prev" | "next" = dx < 0 ? "next" : "prev";
        const ready = Math.abs(dx) > 64;
        setSwipeHint((prev) =>
          prev &&
          prev.label === targetTab.label &&
          prev.direction === direction &&
          prev.ready === ready
            ? prev
            : { label: targetTab.label, direction, ready },
        );
      } else {
        setSwipeHint((prev) => (prev ? null : prev));
      }
    } else if (!swipe.locked) {
      setSwipeHint((prev) => (prev ? null : prev));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const endTouch = e.changedTouches[0];
    if (scrollTouchStartRef.current && endTouch && !scrollDraggedRef.current) {
      const endDx = endTouch.clientX - scrollTouchStartRef.current.x;
      const endDy = endTouch.clientY - scrollTouchStartRef.current.y;
      if (Math.abs(endDx) > 10 || Math.abs(endDy) > 10) {
        scrollDraggedRef.current = true;
      }
    }
    scrollTouchStartRef.current = null;
    if (scrollDraggedRef.current) {
      scheduleDragReset();
    }

    const swipe = swipeRef.current;
    swipeRef.current = null;
    setSwipeHint(null);

    if (!swipe || activeTabIndex === -1 || !endTouch) return;

    const dx = endTouch.clientX - swipe.startX;
    const dy = endTouch.clientY - swipe.startY;

    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      const nextIndex = dx < 0 ? activeTabIndex + 1 : activeTabIndex - 1;
      if (nextIndex >= 0 && nextIndex < MOBILE_TABS.length) {
        router.push(MOBILE_TABS[nextIndex].href);
      }
    }
  };

  const handleTouchCancel = () => {
    scrollTouchStartRef.current = null;
    if (scrollDraggedRef.current) {
      scheduleDragReset();
    }
    swipeRef.current = null;
    setSwipeHint(null);
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (scrollDraggedRef.current || Date.now() - lastDragEndedAtRef.current < 160) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <main className="min-h-dvh bg-[#080909] text-white">{children}</main>;
  }

  if (pathname === "/") return <>{children}</>;

  if (immersive) {
    return (
      <main className="min-h-dvh">
        {children}
        {pathname !== "/premium" && pathname !== "/now-playing" && pathname !== "/auth" && (
          <MobileSidebar />
        )}
      </main>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip">
      <Sidebar />
      <div
        className={cn(
          "min-h-dvh w-full max-w-full min-w-0 overflow-x-clip transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "md:pl-[80px]" : "md:pl-[240px]",
          rightPanelOpen && "xl:pr-[340px]",
          hasTrack
            ? "pb-[calc(156px+env(safe-area-inset-bottom))] md:pb-[108px]"
            : "pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-[32px]",
        )}
      >
        <TopBar />
        <SiteAnnouncement />
        {swipeHint && (
          <div
            aria-live="polite"
            className={cn(
              "md:hidden pointer-events-none fixed top-[74px] left-1/2 z-50 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-elevated/95 border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xl backdrop-blur-md transition-all duration-150 ease-out",
              swipeHint.ready
                ? "opacity-100 scale-100 ring-1 ring-primary/50"
                : "opacity-80 scale-95",
            )}
          >
            {swipeHint.direction === "prev" && (
              <ChevronLeft className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
            <span>{swipeHint.label}</span>
            {swipeHint.direction === "next" && (
              <ChevronRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
          </div>
        )}
        <main
          className="min-h-[calc(100dvh-70px)]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClickCapture={handleClickCapture}
        >
          {children}
        </main>
        <SiteFooter />
      </div>
      <RightPanel />
      <BottomPlayer />
      <MobileMiniPlayer />
      <MobileNavigation />
      <MobileSidebar />
    </div>
  );
}
