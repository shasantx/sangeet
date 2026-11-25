"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/shell/top-bar";
import { LeftSidebar } from "@/components/shell/left-sidebar";
import { RightPanel } from "@/components/shell/right-panel";
import { NowPlayingBar } from "@/components/shell/now-playing-bar";
import { FloatingNav } from "@/components/shell/floating-nav";
import { AppDownloadModal } from "@/components/shell/app-download-modal";
import { DownloadProgressTray } from "@/components/shell/download-progress-tray";
import { CreatePlaylistModal } from "@/components/music/create-playlist-modal";
import { PlaybackEngine } from "@/components/player/playback-engine";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileNowPlayingSheet } from "@/components/player/mobile-now-playing-sheet";
import { FullscreenPlayer } from "@/components/player/fullscreen-player";
import { ShortcutsModal } from "@/components/shell/shortcuts-modal";
import { PWARegister } from "@/components/pwa/pwa-register";
import { Toaster } from "@/components/ui/toaster";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, pickHeroColor } from "@/lib/utils";

const STANDALONE_ROUTES = new Set(["/", "/auth"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const rightTab = useUIStore((s) => s.rightTab);
  const hasTrack = Boolean(currentTrack);

  const isStandalone = STANDALONE_ROUTES.has(pathname);
  const ambientColor = currentTrack
    ? pickHeroColor(currentTrack.id)
    : "#3b82f6";

  return (
    <>
      {isStandalone ? (
        children
      ) : (
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-encore-shell text-encore-text">
          {/* Signature Zentra Atmospheric Cobalt-Periwinkle Aurora Mesh */}
          <div
            aria-hidden="true"
            className="zentra-aurora-mesh pointer-events-none fixed inset-0 z-0"
          />

          {/* Floating Liquid Glass TopBar over scrolling content & cobalt aurora */}
          <Suspense
            fallback={
              <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-16" />
            }
          >
            <TopBar />
          </Suspense>

          {/* 3-panel Studio Desktop grid + mobile scroll canvas */}
          <div className="relative z-10 flex min-h-0 flex-1 gap-2 px-0 sm:px-2">
            {/* LeftSidebar offset below floating TopBar pill */}
            <div className="hidden h-full shrink-0 pt-[68px] md:flex">
              {hydrated ? (
                <LeftSidebar />
              ) : (
                <div className="h-full w-[280px] shrink-0 rounded-panel bg-encore-base/85" />
              )}
            </div>

            {/* Main spans full height BEHIND floating TopBar & FloatingNav so artwork refracts through Liquid Glass */}
            <main
              className={cn(
                "relative h-full min-w-0 flex-1 overflow-y-auto overscroll-contain bg-encore-base/70 sm:rounded-t-panel md:pb-2",
                hydrated && hasTrack ? "pb-44" : "pb-28"
              )}
            >
              {/* Subtle dynamic album-art ambient glow (GPU static, transitions only on track change) */}
              {hydrated && hasTrack && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-25 blur-3xl transition-colors duration-700"
                  style={{
                    background: `radial-gradient(ellipse 68% 82% at 50% 0%, ${ambientColor} 0%, transparent 75%)`
                  }}
                />
              )}
              <div className="relative z-10 min-h-full pt-[68px]">
                {children}
              </div>
            </main>

            {/* RightPanel: desktop/tablet (md+) only so mobile/Android never shows a stuck overlay */}
            {hydrated ? (
              rightTab ? (
                <div className="hidden md:contents xl:flex xl:h-full xl:shrink-0 xl:pt-[68px]">
                  <RightPanel />
                </div>
              ) : null
            ) : null}
          </div>

          <div className="relative z-20 shrink-0">
            {hydrated ? (
              <NowPlayingBar />
            ) : (
              <div className="hidden h-[72px] shrink-0 bg-encore-shell md:block" />
            )}
          </div>

          {/* Liquid Glass Floating TabBar on mobile (< md) */}
          <FloatingNav />

          {/* Web-only APK & Windows App Download Popup (auto-hidden on Android/Windows) */}
          <AppDownloadModal />
          <CreatePlaylistModal />
          <DownloadProgressTray />

          <CommandPalette />
          <MobileNowPlayingSheet />
          <FullscreenPlayer />
          <ShortcutsModal />
          <PWARegister />
          <Toaster />
        </div>
      )}

      {/* Mounted ONCE globally so navigating / -> /home NEVER destroys or stops playback */}
      <PlaybackEngine />
    </>
  );
}
