"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";
import { artists, getArtist } from "@/lib/catalog";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";

interface SessionPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
}

const errorMessages: Record<string, string> = {
  not_configured: "Google sign in needs OAuth credentials. See AUTH_SETUP.md.",
  provider_unavailable: "Google sign in is temporarily unavailable. Try again shortly.",
  cancelled: "Google sign in was cancelled.",
  state: "Google sign in could not be verified. Please try again.",
  response: "Google returned an incomplete sign in response.",
  verification: "Google could not verify this account. Please try again.",
  signups_closed: "New accounts are temporarily paused. Please try again later.",
  configuration: "Google sign in is not configured for this deployment.",
};

export function GoogleSessionSync() {
  const initialized = useRef(false);
  const setGoogleSession = useAuthStore((state) => state.setGoogleSession);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const query = new URLSearchParams(window.location.search);
    const outcome = query.get("google");
    const reason = query.get("reason");

    if (outcome) {
      query.delete("google");
      query.delete("reason");
      const cleanUrl = `${window.location.pathname}${query.size ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    }
    if (outcome === "error") {
      toast.error("Google sign in failed", errorMessages[reason ?? ""] ?? "Please try again.");
      return;
    }

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403) return { session: null };
        if (!response.ok) return undefined;
        return (await response.json()) as { session: SessionPayload | null };
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload?.session) {
          const current = useAuthStore.getState().session;
          if (current?.provider === "google") useAuthStore.getState().signOut();
          return;
        }
        setGoogleSession(payload.session);
        if (outcome === "success") {
          let selectedArtistIds: string[] = [];
          try {
            const saved = window.sessionStorage.getItem("sangeet-signup-artists-v1");
            window.sessionStorage.removeItem("sangeet-signup-artists-v1");
            const parsed: unknown = saved ? JSON.parse(saved) : [];
            if (Array.isArray(parsed)) {
              const validIds = new Set(artists.map((artist) => artist.id));
              selectedArtistIds = Array.from(new Set(parsed.filter((id): id is string => typeof id === "string" && (validIds.has(id) || Boolean(getArtist(id)))))).slice(0, 5);
            }
          } catch {
            selectedArtistIds = [];
          }
          if (selectedArtistIds.length) {
            useAppStore.getState().setPreferredArtists(selectedArtistIds);
            const library = useLibraryStore.getState();
            selectedArtistIds.forEach((id) => {
              if (!library.followedArtistIds.includes(id)) library.toggleFollowArtist(id);
            });
            toast.success(`Welcome, ${payload.session.name}!`, "Your artist picks are shaping your new releases.");
          } else {
            toast.success(`Welcome, ${payload.session.name}!`, "Signed in with Google.");
          }
          if (window.location.pathname === "/auth" || window.location.pathname === "/") window.location.replace("/home");
        }
      })
      .catch(() => {
        if (outcome === "success") toast.error("Could not finish sign in", "Refresh the page and try again.");
      });
  }, [setGoogleSession]);

  return null;
}
