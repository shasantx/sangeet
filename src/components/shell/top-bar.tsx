"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LiquidGlass } from "glasskit-liquid-glass";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Home,
  LogOut,
  Moon,
  Play,
  Plus,
  Search,
  Sun,
  User,
  X
} from "lucide-react";
import type { Track } from "@/types/music";
import { TrackArtwork } from "@/components/music/track-artwork";
import { SangeetLogo } from "@/components/ui/sangeet-logo";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore } from "@/store/ui-store";
import { usePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const syncSession = useAuthStore((s) => s.syncSession);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const openDownloadAppModal = useUIStore((s) => s.openDownloadAppModal);

  const { isWeb } = usePlatform();

  const recentSearches = useLibraryStore((s) => s.recentSearches);
  const addRecentSearch = useLibraryStore((s) => s.addRecentSearch);
  const clearRecentSearches = useLibraryStore((s) => s.clearRecentSearches);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const initialQuery = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setFocused(false);
    setActiveIndex(-1);
  }, []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  // Click-outside for Search: check BOTH the search bar AND the detached suggestions popover
  useEffect(() => {
    if (!focused) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        searchWrapRef.current?.contains(target) ||
        searchDropdownRef.current?.contains(target)
      ) {
        return;
      }
      closeSearch();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focused, closeSearch]);

  // Click-outside for Profile: check BOTH the trigger button AND the popover menu
  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        profileTriggerRef.current?.contains(target) ||
        profileMenuRef.current?.contains(target)
      ) {
        return;
      }
      closeProfile();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfile();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen, closeProfile]);

  // Close popovers cleanly on route change
  useEffect(() => {
    setProfileOpen(false);
    setFocused(false);
    setActiveIndex(-1);
  }, [pathname]);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    if (pathname === "/search") {
      setQuery(searchParams.get("q") ?? "");
    }
  }, [pathname, searchParams]);

  // Live debounced search suggestions
  useEffect(() => {
    setActiveIndex(-1);
    if (!focused || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data?.tracks)) {
            setSuggestions(data.tracks.slice(0, 5));
          }
        })
        .catch(() => {});
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, focused]);

  // Press "/" anywhere to focus search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isShowingSuggestions = query.trim().length >= 2 && suggestions.length > 0;
  const isShowingRecents = query.trim().length === 0 && recentSearches.length > 0;
  const showDropdown = focused && (isShowingSuggestions || isShowingRecents);
  const listLength = isShowingSuggestions
    ? suggestions.length
    : isShowingRecents
      ? recentSearches.length
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showDropdown && activeIndex >= 0 && activeIndex < listLength) {
      if (isShowingSuggestions) {
        const track = suggestions[activeIndex];
        addRecentSearch(query.trim());
        playTrack(track, suggestions);
        closeSearch();
        return;
      }
      if (isShowingRecents) {
        const term = recentSearches[activeIndex];
        setQuery(term);
        closeSearch();
        router.push(`/search?q=${encodeURIComponent(term)}`);
        return;
      }
    }
    const trimmed = query.trim();
    closeSearch();
    if (trimmed) {
      addRecentSearch(trimmed);
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const profileLabel =
    !user || user.mode === "guest" ? "Guest" : user.name;

  return (
    <header
      className={cn(
        "sangeet-glass-navbar fixed inset-x-0 top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 bg-gradient-to-b from-encore-shell/95 via-encore-shell/80 to-transparent px-2.5 select-none sm:px-4",
        theme === "dark" ? "stage-tone-dark" : "stage-tone-light"
      )}
    >
      {/* Left: Brand + History nav (borderless, floating outside glass pill) */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <Link
          href="/home"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-encore-text transition-opacity duration-150 hover:opacity-90 md:w-auto md:gap-2 md:px-2"
          title="Sangeet"
        >
          <SangeetLogo className="h-8 w-8 shadow-[0_2px_10px_rgba(0,0,0,0.28)]" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-encore-text md:inline">
            Sangeet
          </span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-encore-base/80 text-encore-text shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors duration-150 hover:bg-encore-elevated"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => router.forward()}
            aria-label="Go forward"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-encore-base/80 text-encore-text shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors duration-150 hover:bg-encore-elevated"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Center: Compact Liquid Glass Navigation & Search Capsule */}
      <div
        ref={searchWrapRef}
        className="min-w-0 flex-1 max-w-[540px]"
      >
        <LiquidGlass
          radius={999}
          bezelWidth={20}
          interactive
          renderMode="css"
          variant={theme === "dark" ? "dark" : "clear"}
          className="sangeet-topbar-glass h-11 sm:h-[52px]"
        >
          <div className="flex h-full w-full min-w-0 items-center gap-0.5 px-1 sm:gap-1 sm:p-1">
            <Link
              href="/home"
              aria-label="Home"
              aria-current={pathname === "/home" ? "page" : undefined}
              className={cn(
                "hidden h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 sm:flex",
                pathname === "/home"
                  ? "bg-encore-tinted text-encore-accent"
                  : "text-encore-subdued hover:bg-white/10 hover:text-encore-text"
              )}
            >
              <Home className="h-4 w-4" strokeWidth={1.75} />
            </Link>

            <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encore-subdued/80"
                strokeWidth={1.75}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onFocus={() => setFocused(true)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (!showDropdown || listLength === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev + 1) % listLength);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((prev) =>
                      prev <= 0 ? listLength - 1 : prev - 1
                    );
                  } else if (e.key === "Escape") {
                    closeSearch();
                    inputRef.current?.blur();
                  }
                }}
                placeholder="Search..."
                className={cn(
                  "h-10 w-full min-w-0 border-0 bg-transparent pl-9 text-sm text-encore-text placeholder:text-encore-muted outline-none dark:placeholder:text-encore-subdued/75 sm:h-11",
                  query ? "pr-10" : "pr-2.5 xl:pr-14"
                )}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSuggestions([]);
                    setActiveIndex(-1);
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-encore-muted transition-colors hover:text-encore-text"
                >
                  <X className="h-4 w-4" strokeWidth={1.7} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new Event("sangeet:open-command"))
                  }
                  title="Command palette (Ctrl+K)"
                  className="hidden xl:inline-flex absolute right-1.5 top-1/2 -translate-y-1/2 items-center rounded-md bg-encore-base/55 px-1.5 py-0.5 font-mono text-[10px] font-medium text-encore-muted transition-colors hover:text-encore-accent"
                >
                  Ctrl K
                </button>
              )}
            </form>

            <Link
              href="/explore"
              title="Explore genres & moods"
              aria-label="Explore"
              aria-current={pathname === "/explore" ? "page" : undefined}
              className={cn(
                "hidden h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 sm:flex",
                pathname === "/explore"
                  ? "bg-encore-tinted text-encore-accent"
                  : "text-encore-subdued hover:bg-white/10 hover:text-encore-text"
              )}
            >
              <Compass className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </LiquidGlass>
      </div>

      {/* Right: Web-only Get App, Mobile Explore, Theme Toggle, Profile Menu */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {isWeb && (
          <button
            type="button"
            onClick={() =>
              openDownloadAppModal(
                "Get 1-click offline downloads & local music scanning with Sangeet for Android and Windows."
              )
            }
            title="Download Android APK or Windows App"
            className="btn-cobalt hidden h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold lg:inline-flex"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Get App</span>
          </button>
        )}

        <Link
          href="/explore"
          title="Explore genres & moods"
          aria-label="Explore"
          aria-current={pathname === "/explore" ? "page" : undefined}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-xl shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-colors duration-150 sm:hidden",
            pathname === "/explore"
              ? "bg-encore-base/90 text-encore-accent ring-1 ring-encore-accent/40"
              : "bg-encore-base/80 text-encore-text hover:bg-encore-elevated"
          )}
        >
          <Compass className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark"
              ? "Switch to light theme"
              : "Switch to dark theme"
          }
          title={
            theme === "dark"
              ? "Switch to light theme (T)"
              : "Switch to dark theme (T)"
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-encore-base/80 text-encore-accent shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:bg-encore-elevated active:scale-90"
        >
          {theme === "dark" ? (
            <Sun
              className="h-4 w-4 transition-transform duration-300"
              strokeWidth={1.8}
            />
          ) : (
            <Moon
              className="h-4 w-4 transition-transform duration-300"
              strokeWidth={1.8}
            />
          )}
        </button>

        <button
          ref={profileTriggerRef}
          type="button"
          onClick={() => setProfileOpen((o) => !o)}
          aria-expanded={profileOpen}
          aria-label="Profile menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-encore-base/80 text-xs font-medium text-encore-text shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors duration-150 hover:bg-encore-elevated sm:w-auto sm:gap-2.5 sm:pl-1.5 sm:pr-4"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={profileLabel}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-encore-tinted text-encore-accent">
              <User className="h-4 w-4" strokeWidth={1.7} />
            </span>
          )}
          <span className="hidden max-w-[128px] truncate sm:inline">
            {profileLabel}
          </span>
        </button>
      </div>

      {/* Search Suggestions Popover (Liquid Glass frosted card) */}
      {showDropdown && (
        <div
          ref={searchDropdownRef}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-2.5 right-2.5 top-[68px] z-50 mx-auto max-w-[540px]"
        >
          <LiquidGlass
            radius={20}
            bezelWidth={18}
            interactive
            renderMode="css"
            variant={theme === "dark" ? "dark" : "clear"}
            className="sangeet-topbar-glass"
          >
            <div className="p-1.5">
              {isShowingSuggestions ? (
                <div className="space-y-0.5">
                  <p className="px-2.5 py-1.5 text-xs font-medium text-encore-muted">
                    Instant results
                  </p>
                  {suggestions.map((track, idx) => (
                    <button
                      key={track.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        addRecentSearch(query.trim());
                        playTrack(track, suggestions);
                        closeSearch();
                      }}
                      className={cn(
                        "flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors duration-150",
                        activeIndex === idx
                          ? "bg-white/10 dark:bg-white/10"
                          : "hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                      )}
                    >
                      <TrackArtwork
                        src={track.thumbnail}
                        trackId={track.id}
                        alt={track.title}
                        className="h-8 w-8 shrink-0 rounded-md"
                        iconClassName="h-3.5 w-3.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-encore-text">
                          {track.title}
                        </p>
                        <p className="truncate text-xs text-encore-muted">
                          {track.artist}
                        </p>
                      </div>
                      <Play
                        className="h-3.5 w-3.5 shrink-0 text-encore-accent"
                        strokeWidth={1.8}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1">
                    <span className="text-xs font-medium text-encore-muted">
                      Recent searches
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="min-h-[36px] rounded-[6px] px-2 text-xs text-encore-muted hover:text-encore-text"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((term, idx) => (
                    <button
                      key={term}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        setQuery(term);
                        closeSearch();
                        router.push(`/search?q=${encodeURIComponent(term)}`);
                      }}
                      className={cn(
                        "flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-xs text-encore-text transition-colors duration-150",
                        activeIndex === idx
                          ? "bg-slate-900/[0.08] dark:bg-white/10"
                          : "hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                      )}
                    >
                      <Clock
                        className="h-3.5 w-3.5 text-encore-muted"
                        strokeWidth={1.6}
                      />
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* Profile Menu Popover — Liquid Glass Card */}
      {profileOpen && (
        <div
          ref={profileMenuRef}
          className="absolute right-2.5 top-[68px] z-50 w-64 sm:right-4"
        >
          <LiquidGlass
            radius={22}
            bezelWidth={18}
            interactive
            renderMode="css"
            variant={theme === "dark" ? "dark" : "clear"}
            className="sangeet-topbar-glass"
          >
            <div className="p-2">
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-semibold text-encore-text">
                  {user?.name || "Guest listener"}
                </p>
                <p className="truncate text-xs text-encore-subdued">
                  {user?.email || `${user?.mode || "Guest"} mode`}
                </p>
              </div>
              <div className="my-1 h-px bg-encore-hairline" />
              <div className="space-y-0.5 py-1">
                <button
                  type="button"
                  onClick={() => {
                    closeProfile();
                    window.dispatchEvent(new Event("sangeet:create-playlist"));
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs font-semibold text-encore-accent transition-colors hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>Create playlist</span>
                </button>
                <Link
                  href="/stats"
                  onClick={closeProfile}
                  className="flex min-h-[44px] items-center rounded-xl px-2.5 text-xs font-medium text-encore-text transition-colors hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                >
                  Listening stats
                </Link>
                <Link
                  href="/settings"
                  onClick={closeProfile}
                  className="flex min-h-[44px] items-center rounded-xl px-2.5 text-xs text-encore-subdued transition-colors hover:bg-slate-900/[0.06] hover:text-encore-text dark:hover:bg-white/[0.08]"
                >
                  Settings &amp; Equalizer
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2.5 text-left text-xs text-encore-subdued transition-colors hover:bg-slate-900/[0.06] hover:text-encore-text dark:hover:bg-white/[0.08]"
                >
                  <span>Appearance</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-encore-tinted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-encore-accent">
                    {theme}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeProfile();
                    window.dispatchEvent(new Event("sangeet:open-shortcuts"));
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2.5 text-left text-xs text-encore-subdued transition-colors hover:bg-slate-900/[0.06] hover:text-encore-text dark:hover:bg-white/[0.08]"
                >
                  <span>Keyboard shortcuts</span>
                  <kbd className="font-mono text-[10px] text-encore-muted">?</kbd>
                </button>
                {isWeb && (
                  <Link
                    href="/"
                    onClick={closeProfile}
                    className="flex min-h-[44px] items-center rounded-xl px-2.5 text-xs text-encore-subdued transition-colors hover:bg-slate-900/[0.06] hover:text-encore-text dark:hover:bg-white/[0.08]"
                  >
                    Overview page
                  </Link>
                )}
              </div>
              <div className="my-1 h-px bg-encore-hairline" />
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    closeProfile();
                    await logout();
                    router.push("/auth");
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs font-medium text-encore-negative transition-colors hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth"
                  onClick={closeProfile}
                  className="flex min-h-[44px] items-center rounded-xl px-2.5 text-xs font-semibold text-encore-accent transition-colors hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                >
                  Sign in
                </Link>
              )}
            </div>
          </LiquidGlass>
        </div>
      )}
    </header>
  );
}
