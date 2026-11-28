"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crown, Link2, LogOut, RefreshCw, Users } from "lucide-react";
import { useJamStore } from "@/store/jam-store";
import { usePlayerStore } from "@/store/player-store";
import { useAuthStore } from "@/store/auth-store";
import { useToastStore } from "@/store/toast-store";
import { isJamConfigured, normaliseJamCode } from "@/lib/jam-session";
import { TrackArtwork } from "@/components/music/track-artwork";
import { cn } from "@/lib/utils";

const card = "rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]";

function JamContent() {
  const params = useSearchParams();
  const jam = useJamStore();
  const user = useAuthStore((s) => s.user);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const showToast = useToastStore((s) => s.showToast);
  const [code, setCode] = useState(() => normaliseJamCode(params.get("code") ?? ""));
  const configured = isJamConfigured();
  const inJam = jam.status === "live" || jam.status === "connecting";

  useEffect(() => {
    if (!jam.displayName && user?.name) jam.setDisplayName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const shareUrl =
    typeof window !== "undefined" && jam.code ? `${window.location.origin}/jam?code=${jam.code}` : "";

  const share = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join my Dhun Jam", text: `Jam code ${jam.code}`, url: shareUrl });
        return;
      }
    } catch {
      return; // user closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Jam link copied", "success");
    } catch {
      showToast(`Jam code: ${jam.code}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-10 pt-4 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-encore-text">Jam</h1>
        <p className="mt-1 text-sm text-encore-subdued">
          Listen together in real time. Everyone hears the same song at the same moment.
        </p>
      </header>

      {!configured && (
        <section className={card}>
          <p className="text-sm font-medium text-encore-text">Jam isn&apos;t switched on yet</p>
          <p className="mt-1 text-xs text-encore-subdued">
            The app owner needs to add a Supabase project (NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY) to enable Jam.
          </p>
        </section>
      )}

      {configured && !inJam && (
        <>
          {jam.message && (
            <p className="rounded-xl bg-encore-tinted px-4 py-3 text-sm text-encore-text">{jam.message}</p>
          )}

          <section className={cn(card, "space-y-3")}>
            <label className="block text-xs font-medium text-encore-subdued" htmlFor="jam-name">
              Your name in the Jam
            </label>
            <input
              id="jam-name"
              value={jam.displayName}
              onChange={(e) => jam.setDisplayName(e.target.value)}
              placeholder="e.g. Sangit"
              maxLength={32}
              className="h-11 w-full rounded-xl bg-encore-base px-3.5 text-sm text-encore-text outline-none ring-encore-accent/40 placeholder:text-encore-muted focus:ring-2"
            />
          </section>

          <section className={cn(card, "space-y-3")}>
            <h2 className="text-base font-semibold text-encore-text">Start a Jam</h2>
            <p className="text-xs text-encore-subdued">
              You control the music. Friends join with a code or link and can add songs to the queue.
            </p>
            <button
              type="button"
              onClick={() => void jam.startJam()}
              className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold"
            >
              <Users className="h-4 w-4" strokeWidth={1.8} />
              Start a Jam
            </button>
          </section>

          <section className={cn(card, "space-y-3")}>
            <h2 className="text-base font-semibold text-encore-text">Join a Jam</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void jam.joinJam(code);
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(normaliseJamCode(e.target.value))}
                placeholder="ABC123"
                inputMode="text"
                autoCapitalize="characters"
                aria-label="Jam code"
                className="h-11 w-full min-w-0 rounded-xl bg-encore-base px-3.5 font-mono text-base tracking-[0.3em] text-encore-text outline-none ring-encore-accent/40 placeholder:tracking-[0.3em] placeholder:text-encore-muted focus:ring-2"
              />
              <button
                type="submit"
                disabled={code.length !== 6}
                className="h-11 shrink-0 rounded-full bg-encore-base px-5 text-sm font-semibold text-encore-text transition-colors hover:bg-encore-elevated-highlight disabled:opacity-40"
              >
                Join
              </button>
            </form>
          </section>
        </>
      )}

      {configured && inJam && (
        <>
          <section className={cn(card, "text-center")}>
            <p className="text-xs font-medium text-encore-subdued">
              {jam.status === "connecting"
                ? "Connecting…"
                : jam.role === "host"
                  ? "You're hosting · share this code"
                  : `In ${jam.hostName ?? "the host"}'s Jam`}
            </p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.35em] text-encore-text">{jam.code}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void share()}
                className="btn-cobalt inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              >
                <Link2 className="h-4 w-4" strokeWidth={1.8} />
                Share link
              </button>
              {jam.role === "guest" && (
                <button
                  type="button"
                  onClick={() => jam.resync()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-encore-base px-5 text-sm font-medium text-encore-text hover:bg-encore-elevated-highlight"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
                  Sync
                </button>
              )}
              <button
                type="button"
                onClick={() => void jam.leaveJam()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-encore-base px-5 text-sm font-medium text-encore-negative hover:bg-encore-elevated-highlight"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.8} />
                {jam.role === "host" ? "End Jam" : "Leave"}
              </button>
            </div>
          </section>

          {currentTrack && (
            <section className={cn(card, "flex items-center gap-3")}>
              <TrackArtwork
                src={currentTrack.thumbnail}
                trackId={currentTrack.id}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs text-encore-subdued">Playing for everyone</p>
                <p className="truncate text-sm font-semibold text-encore-text">{currentTrack.title}</p>
                <p className="truncate text-xs text-encore-subdued">{currentTrack.artist}</p>
              </div>
            </section>
          )}

          {jam.role === "host" && (
            <section className={cn(card, "flex items-center justify-between gap-4")}>
              <div>
                <p className="text-sm font-medium text-encore-text">Guests can control playback</p>
                <p className="text-xs text-encore-subdued">
                  Let guests play, pause, skip and seek. Adding songs is always allowed.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={jam.allowGuestControl}
                aria-label="Guests can control playback"
                onClick={() => jam.setAllowGuestControl(!jam.allowGuestControl)}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150",
                  jam.allowGuestControl ? "bg-encore-accent" : "bg-encore-highlight"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-150",
                    jam.allowGuestControl ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </section>
          )}

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-encore-text">
              Listening now · {jam.members.length}
            </h2>
            <ul className="space-y-2">
              {jam.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-encore-base text-xs font-semibold text-encore-text">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-encore-text">{m.name}</span>
                  {m.role === "host" && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-encore-mint">
                      <Crown className="h-3.5 w-3.5" strokeWidth={1.8} /> Host
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {jam.role === "guest" && !jam.allowGuestControl && (
              <p className="mt-3 text-[11px] text-encore-muted">
                The host controls playback. Songs you add to your queue are sent to the host&apos;s queue.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function JamPage() {
  return (
    <Suspense fallback={null}>
      <JamContent />
    </Suspense>
  );
}
