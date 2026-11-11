"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const hasTrack = Boolean(currentTrackId);
  const reduceMotion = useReducedMotion();
  const immersive = pathname === "/premium" || pathname === "/now-playing" || pathname === "/auth" || pathname === "/login";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <main className="min-h-dvh bg-[#090c0a] text-white">{children}</main>;
  }

  if (pathname === "/") return <>{children}</>;

  if (immersive) {
    return (
      <main className="min-h-dvh">
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.div>
        {pathname !== "/premium" && pathname !== "/now-playing" && pathname !== "/auth" && <MobileSidebar />}
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div
        className={cn(
          "min-h-dvh transition-[padding] duration-300 ease-out",
          sidebarCollapsed ? "md:pl-[80px]" : "md:pl-[240px]",
          rightPanelOpen && "xl:pr-[340px]",
        )}
      >
        <TopBar />
        <SiteAnnouncement />
        <main
          className={cn(
            "min-h-[calc(100dvh-70px)]",
            hasTrack
              ? "pb-[calc(130px+env(safe-area-inset-bottom))] md:pb-[104px]"
              : "pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-[28px]"
          )}
        >
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
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
