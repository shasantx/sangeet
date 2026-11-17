"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      if (overflowX === "auto" || overflowX === "scroll") {
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
  const [swipeHint, setSwipeHint] = useState<SwipeHintState>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    swipeRef.current = null;
    setSwipeHint(null);
  }, [pathname]);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (activeTabIndex === -1 || typeof window === "undefined" || window.innerWidth >= 768) {
      return;
    }
    if (e.touches.length !== 1) return;
    if (shouldSkipTabSwipe(e.target, e.currentTarget)) return;

    const touch = e.touches[0];
    if (!touch) return;
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || activeTabIndex === -1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;

    if (!swipe.locked && Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
      swipeRef.current = null;
      setSwipeHint((prev) => (prev ? null : prev));
      return;
    }

    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.45;
    if (isHorizontal && Math.abs(dx) > 24) {
      swipe.locked = true;
      const nextIndex = dx < 0 ? activeTabIndex + 1 : activeTabIndex - 1;
      if (nextIndex >= 0 && nextIndex < MOBILE_TABS.length) {
        const targetTab = MOBILE_TABS[nextIndex];
        const direction: "prev" | "next" = dx < 0 ? "next" : "prev";
        const ready = Math.abs(dx) > 54;
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
    const swipe = swipeRef.current;
    swipeRef.current = null;
    setSwipeHint(null);

    if (!swipe || activeTabIndex === -1) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;

    if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.45) {
      const nextIndex = dx < 0 ? activeTabIndex + 1 : activeTabIndex - 1;
      if (nextIndex >= 0 && nextIndex < MOBILE_TABS.length) {
        router.push(MOBILE_TABS[nextIndex].href);
      }
    }
  };

  const handleTouchCancel = () => {
    swipeRef.current = null;
    setSwipeHint(null);
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
    <div className="min-h-dvh">
      <Sidebar />
      <div
        className={cn(
          "min-h-dvh transition-[padding] duration-200 ease-out",
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
              "md:hidden pointer-events-none fixed top-[74px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-card border border-white/15 px-4 py-1.5 text-xs font-semibold text-foreground shadow-xl transition-opacity duration-150",
              swipeHint.ready ? "opacity-100 ring-1 ring-primary/40" : "opacity-80",
            )}
          >
            {swipeHint.direction === "prev"
              ? `← ${swipeHint.label}`
              : `${swipeHint.label} →`}
          </div>
        )}
        <main
          className="min-h-[calc(100dvh-70px)]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
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
