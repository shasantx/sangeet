"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Compass,
  HardDrive,
  Heart,
  History,
  Home,
  LayoutGrid,
  ListMusic,
  Mic2,
  Moon,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  X
} from "lucide-react";
import type { Track } from "@/types/music";
import { TrackArtwork } from "@/components/music/track-artwork";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";

interface PaletteItem {
  id: string;
  section: "songs" | "actions" | "pages" | "playlists";
  label: string;
  sublabel?: string;
  thumbnail?: string;
  trackId?: string;
  icon?: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const sponsorBlockEnabled = usePlayerStore((s) => s.sponsorBlockEnabled);
  const setSponsorBlockEnabled = usePlayerStore(
    (s) => s.setSponsorBlockEnabled
  );
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const playlists = useLibraryStore((s) => s.playlists);
  const addRecentSearch = useLibraryStore((s) => s.addRecentSearch);
  const showToast = useToastStore((s) => s.showToast);

  // Global Ctrl+K / Cmd+K shortcut + custom event listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onCustomOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("sangeet:open-command", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("sangeet:open-command", onCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced live YouTube Music search
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const id = window.setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data?.tracks)) {
            setResults(data.tracks.slice(0, 6));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const navigate = (href: string) => {
      setOpen(false);
      router.push(href);
    };

    const list: PaletteItem[] = [];

    // 1. Live song matches
    for (const track of results) {
      list.push({
        id: `song-${track.id}`,
        section: "songs",
        label: track.title,
        sublabel: track.artist,
        thumbnail: track.thumbnail,
        trackId: track.id,
        run: () => {
          addRecentSearch(query.trim());
          playTrack(track, results);
          showToast(`Playing "${track.title}"`, "success");
          setOpen(false);
        }
      });
    }

    // 2. Quick Actions
    const rawActions: PaletteItem[] = [
      {
        id: "act-create-playlist",
        section: "actions",
        label: "Create new playlist",
        icon: Plus,
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event("sangeet:create-playlist"));
        }
      },
      {
        id: "act-sb",
        section: "actions",
        label: `SponsorBlock: ${sponsorBlockEnabled ? "ON" : "OFF"}`,
        icon: ShieldCheck,
        run: () => {
          setSponsorBlockEnabled(!sponsorBlockEnabled);
          showToast(
            !sponsorBlockEnabled
              ? "SponsorBlock auto-skip ON"
              : "SponsorBlock auto-skip OFF",
            "success"
          );
          setOpen(false);
        }
      },
      {
        id: "act-theme",
        section: "actions",
        label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Theme`,
        icon: Settings,
        run: () => {
          toggleTheme();
          showToast(
            `Switched to ${theme === "dark" ? "light" : "dark"} theme`,
            "success"
          );
          setOpen(false);
        }
      },
      {
        id: "act-sleep",
        section: "actions",
        label: "Sleep Timer (30 min)",
        icon: Moon,
        run: () => {
          setSleepTimer(30);
          showToast("Sleep timer set for 30 minutes", "success");
          setOpen(false);
        }
      }
    ];
    list.push(
      ...rawActions.filter((a) => !q || a.label.toLowerCase().includes(q))
    );

    // 3. Pages
    const rawPages: PaletteItem[] = [
      { id: "pg-home", section: "pages", label: "Home", icon: Home, run: () => navigate("/home") },
      { id: "pg-more", section: "pages", label: "More & All Features", icon: LayoutGrid, run: () => navigate("/more") },
      { id: "pg-offline", section: "pages", label: "Downloads & Offline Audio", icon: HardDrive, run: () => navigate("/offline") },
      { id: "pg-explore", section: "pages", label: "Explore Genres & Moods", icon: Compass, run: () => navigate("/explore") },
      { id: "pg-liked", section: "pages", label: "Liked Songs", icon: Heart, run: () => navigate("/liked") },
      { id: "pg-queue", section: "pages", label: "Playback Queue", icon: ListMusic, run: () => navigate("/queue") },
      { id: "pg-stats", section: "pages", label: "Listening Stats (Wrapped)", icon: BarChart3, run: () => navigate("/stats") },
      { id: "pg-lyrics", section: "pages", label: "Full-Screen Lyrics", icon: Mic2, run: () => navigate("/lyrics") },
      { id: "pg-recent", section: "pages", label: "Recently Played", icon: History, run: () => navigate("/recently-played") },
      { id: "pg-settings", section: "pages", label: "Settings & 5-Band EQ", icon: Settings, run: () => navigate("/settings") }
    ];
    list.push(
      ...rawPages.filter((p) => !q || p.label.toLowerCase().includes(q))
    );

    // 4. User Playlists
    const plItems: PaletteItem[] = playlists
      .filter((pl) => !q || pl.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((pl) => ({
        id: `pl-${pl.id}`,
        section: "playlists",
        label: pl.name,
        sublabel: `${pl.tracks.length} songs`,
        icon: ListMusic,
        run: () => navigate(`/playlist/${pl.id}`)
      }));
    list.push(...plItems);

    return list;
  }, [
    results,
    query,
    playlists,
    sponsorBlockEnabled,
    router,
    addRecentSearch,
    playTrack,
    showToast,
    setSponsorBlockEnabled,
    setSleepTimer,
    theme,
    toggleTheme
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  if (!open) return null;

  const songItems = items.filter((i) => i.section === "songs");
  const actionItems = items.filter((i) => i.section === "actions");
  const pageItems = items.filter((i) => i.section === "pages");
  const playlistItems = items.filter((i) => i.section === "playlists");

  const indexOfItem = (id: string) => items.findIndex((x) => x.id === id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-3 pt-14 sm:px-4 sm:pt-20"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[20px] bg-encore-base shadow-[var(--shadow-elevated)]"
      >
        {/* Input */}
        <div className="flex items-center gap-3 bg-encore-elevated/45 px-4 py-3.5">
          <Search
            className="h-4 w-4 shrink-0 text-encore-muted"
            strokeWidth={1.6}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (items.length > 0) {
                  setActiveIndex((prev) => (prev + 1) % items.length);
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (items.length > 0) {
                  setActiveIndex((prev) =>
                    prev <= 0 ? items.length - 1 : prev - 1
                  );
                }
              } else if (e.key === "Enter") {
                e.preventDefault();
                const picked = items[activeIndex];
                if (picked) {
                  picked.run();
                } else if (query.trim()) {
                  addRecentSearch(query.trim());
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                }
              }
            }}
            placeholder="Search songs, pages, or commands"
            className="w-full bg-transparent text-sm text-encore-text placeholder:text-encore-muted outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
            className="rounded-[6px] p-1 text-encore-muted hover:text-encore-text"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[65dvh] space-y-4 overflow-y-auto p-3">
          {/* Instant Live Song Results */}
          {query.trim().length >= 2 && (
            <div>
              <p className="mb-1.5 px-2 text-xs font-medium text-encore-muted">
                {searching ? "Searching YouTube Music" : "Instant songs"}
              </p>
              {songItems.length > 0 ? (
                <div className="space-y-0.5">
                  {songItems.map((item) => {
                    const idx = indexOfItem(item.id);
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={item.run}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                          active
                            ? "bg-encore-elevated-highlight"
                            : "hover:bg-encore-elevated"
                        )}
                      >
                        <TrackArtwork
                          src={item.thumbnail}
                          trackId={item.trackId}
                          alt={item.label}
                          className="h-10 w-10 shrink-0 rounded-lg"
                          iconClassName="h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-encore-text">
                            {item.label}
                          </p>
                          <p className="truncate text-xs text-encore-subdued">
                            {item.sublabel}
                          </p>
                        </div>
                        <Play className="h-4 w-4 shrink-0 text-encore-accent" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                !searching && (
                  <p className="px-2 py-2 text-xs text-encore-subdued">
                    Press Enter to run full search for &ldquo;{query}&rdquo;.
                  </p>
                )
              )}
            </div>
          )}

          {/* Quick Actions */}
          {actionItems.length > 0 && (
            <div>
              <p className="mb-1.5 px-2 text-xs font-medium text-encore-muted">
                Quick actions
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {actionItems.map((item) => {
                  const idx = indexOfItem(item.id);
                  const active = idx === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.run}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-xs font-medium text-encore-text transition-colors duration-150",
                        active
                          ? "bg-encore-elevated-highlight"
                          : "hover:bg-encore-elevated"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 text-encore-muted" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pages */}
          {pageItems.length > 0 && (
            <div>
              <p className="mb-1.5 px-2 text-xs font-medium text-encore-muted">
                Navigate
              </p>
              <div className="space-y-0.5">
                {pageItems.map((item) => {
                  const idx = indexOfItem(item.id);
                  const active = idx === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-xs font-medium text-encore-text transition-colors duration-150",
                        active
                          ? "bg-encore-elevated-highlight"
                          : "hover:bg-encore-elevated"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 text-encore-muted" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Playlists */}
          {playlistItems.length > 0 && (
            <div>
              <p className="mb-1.5 px-2 text-xs font-medium text-encore-muted">
                Playlists
              </p>
              <div className="space-y-0.5">
                {playlistItems.map((item) => {
                  const idx = indexOfItem(item.id);
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-xs font-medium text-encore-text transition-colors duration-150",
                        active
                          ? "bg-encore-elevated-highlight"
                          : "hover:bg-encore-elevated"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <ListMusic className="h-4 w-4 shrink-0 text-encore-muted" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-encore-muted">
                        {item.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between bg-encore-elevated/45 px-4 py-2.5 text-xs text-encore-muted">
          <span>↑↓ navigate • Enter select • Esc close</span>
          <kbd className="font-mono text-[11px]">Ctrl K</kbd>
        </div>
      </div>
    </div>
  );
}
