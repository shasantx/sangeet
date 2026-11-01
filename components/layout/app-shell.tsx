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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const reduceMotion = useReducedMotion();
  const immersive = pathname === "/premium";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  if (pathname === "/admin") {
    return <main className="min-h-dvh bg-[#090c0a] text-white">{children}</main>;
  }

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
        {pathname !== "/premium" && <MobileSidebar />}
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
        <main className="min-h-[calc(100dvh-70px)] pb-[calc(146px+env(safe-area-inset-bottom))] md:pb-[108px]">
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      <RightPanel />
      <BottomPlayer />
      <MobileMiniPlayer />
      <MobileNavigation />
      <MobileSidebar />
    </div>
  );
}
