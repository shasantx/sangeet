"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { artists, getArtist } from "@/lib/catalog";
import { registerYouTubeSearchResults, type YouTubeSearchResult } from "@/lib/dynamic-tracks";
import type { Artist } from "@/lib/types";
import { Artwork } from "@/components/music/artwork";
import { useSiteConfigStore } from "@/store/site-config-store";
import { SangeetMark } from "@/components/brand/sangeet-mark";

const SIGNUP_ARTISTS_KEY = "sangeet-signup-artists-v1";
const artistLanguages = ["All", "Nepali", "Hindi", "Punjabi", "English", "Other"] as const;

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a7 7 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthModal() {
  const isOpen = useAuthStore((state) => state.authModalOpen);
  const activeTab = useAuthStore((state) => state.authModalTab);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [artistLanguage, setArtistLanguage] = useState<(typeof artistLanguages)[number]>("All");
  const [liveArtists, setLiveArtists] = useState<Artist[]>([]);
  const [searchingArtists, setSearchingArtists] = useState(false);
  const signupEnabled = useSiteConfigStore((state) => state.config.signup_enabled);
  const visibleArtists = useMemo(() => {
    const query = artistQuery.trim().toLocaleLowerCase();
    return artists.filter((artist) => {
      const matchesLanguage = artistLanguage === "All"
        || (artistLanguage === "Other"
          ? !artist.languages?.some((language) => ["Nepali", "Hindi", "Punjabi", "English"].includes(language))
          : artist.languages?.includes(artistLanguage)
            || (artistLanguage === "English" && (artist.location === "Global" || artist.languages?.includes("English"))));
      const searchable = [artist.name, artist.shortBio, artist.location, ...(artist.genreIds ?? []), ...(artist.languages ?? []), ...(artist.aliases ?? [])].join(" ").toLocaleLowerCase();
      return matchesLanguage && (!query || searchable.includes(query));
    });
  }, [artistLanguage, artistQuery]);
  useEffect(() => {
    const query = artistQuery.trim();
    if (!isOpen || query.length < 2) {
      setLiveArtists([]);
      setSearchingArtists(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLiveArtists([]);
      setSearchingArtists(true);
      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { results?: YouTubeSearchResult[] };
        const dynamicTracks = registerYouTubeSearchResults(payload.results ?? []);
        const localNames = new Set(artists.map((artist) => artist.name.toLocaleLowerCase()));
        const unique = new Map<string, Artist>();
        dynamicTracks.forEach((track) => {
          const artist = getArtist(track.artistId);
          if (artist && !localNames.has(artist.name.toLocaleLowerCase())) unique.set(artist.id, artist);
        });
        if (!controller.signal.aborted) setLiveArtists(Array.from(unique.values()).slice(0, 8));
      } catch {
        if (!controller.signal.aborted) setLiveArtists([]);
      } finally {
        if (!controller.signal.aborted) setSearchingArtists(false);
      }
    }, 420);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [artistQuery, isOpen]);

  const handleGoogleSignIn = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    if (activeTab === "signup") {
      if (!selectedArtists.length) return;
      try {
        window.sessionStorage.setItem(SIGNUP_ARTISTS_KEY, JSON.stringify(selectedArtists));
      } catch {
        // Continue to Google even if the browser blocks temporary storage.
      }
    }
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const toggleArtist = (artistId: string) => setSelectedArtists((current) => {
    if (current.includes(artistId)) return current.filter((id) => id !== artistId);
    return current.length >= 5 ? current : [...current, artistId];
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-white/[.08] bg-[#14130f] p-0 text-white shadow-2xl sm:max-w-[480px]">
        <div className="p-5 text-center sm:p-8">
          <SangeetMark size={48} className="mx-auto mb-4" />
          <p className="eyebrow mb-2">Sangeet account</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {activeTab === "signup" ? "Start with your favorites" : "Welcome back"}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/55">
            {activeTab === "signup" ? signupEnabled ? "Choose up to five artists. We’ll use your picks to shape your first recommendations." : "New account registration is paused by the Sangeet team. Existing listeners can still sign in." : "Sign in securely with Google to connect your listener profile."}
          </p>
          {activeTab === "signup" && signupEnabled && (
            <div className="mt-5 text-left">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white/80">Choose artists</span><span className="text-[10px] text-white/45">{selectedArtists.length}/5 selected</span></div>
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 focus-within:border-primary/60">
                <Search className="h-4 w-4 shrink-0 text-white/40" />
                <input value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="Search artists, genres or languages" aria-label="Search artists" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35" />
              </label>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filter artists by language">
                {artistLanguages.map((language) => <button key={language} type="button" onClick={() => setArtistLanguage(language)} aria-pressed={artistLanguage === language} className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${artistLanguage === language ? "bg-primary text-black" : "bg-white/[.06] text-white/55 hover:bg-white/10"}`}>{language}</button>)}
              </div>
              <div className="mt-2 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1">
                {visibleArtists.map((artist) => {
                  const selected = selectedArtists.includes(artist.id);
                  return <button key={artist.id} type="button" onClick={() => toggleArtist(artist.id)} aria-pressed={selected} className={`group relative min-w-0 rounded-xl p-1.5 text-center transition ${selected ? "bg-primary/15 ring-1 ring-primary" : "bg-white/[.035] hover:bg-white/[.07]"}`}>
                    <span className="relative block"><Artwork src={artist.image} alt={`${artist.name} portrait`} className="aspect-square w-full rounded-lg" /><span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${selected ? "bg-primary text-black" : "bg-black/60 text-transparent"}`}><Check className="h-3 w-3" /></span></span>
                    <span className="mt-1 block truncate text-[10px] font-medium text-white/75">{artist.name}</span>
                  </button>;
                })}
              </div>
              {artistQuery.trim().length >= 2 && (searchingArtists || liveArtists.length > 0) && <div className="mt-3">
                <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/45">{searchingArtists ? "Finding more artists…" : "More artists from your search"}{searchingArtists && <LoaderCircle className="h-3 w-3 animate-spin text-primary" aria-hidden="true" />}</p>
                <div className="grid grid-cols-2 gap-2">
                  {liveArtists.map((artist) => {
                    const selected = selectedArtists.includes(artist.id);
                    return <button key={artist.id} type="button" onClick={() => toggleArtist(artist.id)} aria-pressed={selected} className={`flex min-w-0 items-center gap-2 rounded-xl p-2 text-left transition ${selected ? "bg-primary/15 ring-1 ring-primary" : "bg-white/[.035] hover:bg-white/[.07]"}`}>
                      <Artwork src={artist.image} alt={`${artist.name} artwork`} className="h-9 w-9 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{artist.name}</span><Check className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : "text-transparent"}`} />
                    </button>;
                  })}
                </div>
              </div>}
              {visibleArtists.length === 0 && <p className="py-5 text-center text-xs text-white/45">No artists found. Try another spelling or language.</p>}
              <p className="mt-2 flex items-center gap-1 text-[10px] text-white/40"><Sparkles className="h-3 w-3 text-primary" />You can follow more artists any time.</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={activeTab === "signup" && (!signupEnabled || selectedArtists.length === 0)}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-semibold text-[#202124] transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#14130f]"
          >
            <GoogleMark /> {activeTab === "signup" && !signupEnabled ? "Sign up is paused" : "Continue with Google"}
          </button>
          <div className="my-6 border-t border-white/[.08]" />
          <p className="text-xs leading-relaxed text-white/45">
            Passwords and password resets are managed by Google. Browse freely, then sign in to listen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
