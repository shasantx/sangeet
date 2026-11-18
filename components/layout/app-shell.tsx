"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const hasTrack = Boolean(currentTrackId);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const immersive =
    pathname === "/premium" ||
    pathname === "/now-playing" ||
    pathname === "/auth" ||
    pathname === "/login";
  const usesAppScroll = pathname !== "/" && !isAdmin && !immersive;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("app-shell-scroll-locked", usesAppScroll);
    return () => document.body.classList.remove("app-shell-scroll-locked");
  }, [usesAppScroll]);

  if (isAdmin) {
    return <main className="min-h-dvh bg-[#080909] text-white">{children}</main>;
  }

  if (pathname === "/") return <>{children}</>;

  if (immersive) {
    return (
      <main className="min-h-dvh w-full max-w-full overflow-x-clip">
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
        ref={scrollContainerRef}
        className={cn(
          "app-shell-scroll flex flex-col min-h-dvh w-full max-w-full min-w-0 overflow-x-clip transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "md:pl-[80px]" : "md:pl-[240px]",
          rightPanelOpen && "xl:pr-[340px]",
          hasTrack
            ? "pb-[calc(var(--app-shell-pb-track,156px)+env(safe-area-inset-bottom))] md:pb-[92px]"
            : "pb-[calc(var(--app-shell-pb-idle,92px)+env(safe-area-inset-bottom))] md:pb-0",
        )}
      >
        <TopBar />
        <SiteAnnouncement />
        <main className="flex-1">{children}</main>
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
