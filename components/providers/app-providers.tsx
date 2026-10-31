"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/components/player/player-provider";
import { QueuePanel } from "@/components/player/queue-panel";
import { AddToPlaylistDialog } from "@/components/playlists/add-to-playlist-dialog";
import { CreatePlaylistDialog } from "@/components/playlists/create-playlist-dialog";
import { AuthModal } from "@/components/auth/auth-modal";
import { GoogleSessionSync } from "@/components/auth/google-session-sync";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "./toaster";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <PlayerProvider>
        <AppShell>{children}</AppShell>
        <QueuePanel />
        <AddToPlaylistDialog />
        <CreatePlaylistDialog />
        <AuthModal />
        <GoogleSessionSync />
        <Toaster />
      </PlayerProvider>
    </TooltipProvider>
  );
}
