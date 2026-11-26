"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlassTabBar, type GlassTabItem } from "glasskit-liquid-glass";
import { ArrowRight, Home, Library, ListMusic, Menu, Search, X } from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

const SEARCH_PREFIXES = ["/search", "/explore"];
const LIBRARY_PREFIXES = [
  "/library",
  "/liked",
  "/offline",
  "/recently-played",
  "/playlist",
  "/album",
  "/artist"
];
const PLAYBACK_PREFIXES = ["/queue", "/lyrics"];
const MORE_PREFIXES = [
  "/more",
  "/made-for-you",
  "/new-releases",
  "/settings",
  "/stats",
  "/privacy",
  "/terms"
];

const TAB_ROUTES = [
  {
    id: "home",
    href: "/home",
    label: "Home",
    icon: Home,
    match: (p: string) =>
      p === "/home" || SEARCH_PREFIXES.some((pre) => p.startsWith(pre))
  },
  {
    id: "library",
    href: "/library",
    label: "Library",
    icon: Library,
    match: (p: string) => LIBRARY_PREFIXES.some((pre) => p.startsWith(pre))
  },
  {
    id: "queue",
    href: "/queue",
    label: "Queue",
    icon: ListMusic,
    match: (p: string) => PLAYBACK_PREFIXES.some((pre) => p.startsWith(pre))
  },
  {
    id: "more",
    href: "/more",
    label: "More",
    icon: Menu,
    match: (p: string) => MORE_PREFIXES.some((pre) => p.startsWith(pre))
  }
] as const;

export function FloatingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useUIStore((s) => s.theme);
  const addRecentSearch = useLibraryStore((s) => s.addRecentSearch);
  const navWrapRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const activeIndex = useMemo(() => {
    const idx = TAB_ROUTES.findIndex((t) => t.match(pathname));
    return idx >= 0 ? idx : 0;
  }, [pathname]);

  const items: GlassTabItem[] = useMemo(
    () =>
      TAB_ROUTES.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      })),
    []
  );

  // Keep local isSearching synced with GlassTabBar's internal expanded search state
  useEffect(() => {
    const root = navWrapRef.current;
    if (!root) return;

    const syncState = () => {
      const expanded = Boolean(root.querySelector(".ios-tabbar-row.is-searching"));
      setIsSearching(expanded);
    };

    syncState();
    const observer = new MutationObserver(syncState);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
      childList: true
    });

    return () => observer.disconnect();
  }, []);

  // Broadcast search state so mobile mini-player can yield cleanly above soft keyboard
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("sangeet:nav-search-state", {
        detail: { searching: isSearching }
      })
    );
  }, [isSearching]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("sangeet:nav-search-state", {
          detail: { searching: false }
        })
      );
    };
  }, []);

  const collapseExpandedSearch = useCallback(() => {
    const root = navWrapRef.current;
    if (!root) return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && root.contains(activeEl)) {
      activeEl.blur();
    }
    const closeBtn = root.querySelector<HTMLButtonElement>(
      '.ios-tabbar-search-btn[aria-label="Close search"]'
    );
    closeBtn?.click();
  }, []);

  const submitSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed) {
        addRecentSearch(trimmed);
      }
      collapseExpandedSearch();
      router.push(
        trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search"
      );
    },
    [addRecentSearch, collapseExpandedSearch, router]
  );

  // Close expanded search cleanly when tapping outside the floating nav
  useEffect(() => {
    if (!isSearching) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && navWrapRef.current && !navWrapRef.current.contains(target)) {
        collapseExpandedSearch();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isSearching, collapseExpandedSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.tagName !== "INPUT") return;
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearch(searchQuery);
    } else if (e.key === "Escape") {
      e.preventDefault();
      collapseExpandedSearch();
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (isSearching && target?.closest(".ios-search-icon")) {
      e.preventDefault();
      submitSearch(searchQuery);
    }
  };

  return (
    <div
      className={cn(
        "sangeet-glass-navbar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2.5 pb-[max(12px,env(safe-area-inset-bottom))] transition-all duration-200 sm:px-3 md:hidden",
        theme === "dark" ? "stage-tone-dark" : "stage-tone-light",
        isSearching &&
          "sangeet-nav-searching bg-gradient-to-t from-encore-shell via-encore-shell/95 to-transparent pt-3"
      )}
      aria-label="Primary navigation"
      onKeyDown={handleKeyDown}
      onClickCapture={handleClickCapture}
    >
      <div
        ref={navWrapRef}
        className="pointer-events-auto flex w-full max-w-[430px] min-w-0 items-center justify-center gap-2"
      >
        <div
          className={cn(
            "min-w-0 flex-1",
            isSearching &&
              "[&_.lg-backdrop]:!bg-none [&_.lg-backdrop]:!bg-encore-base/95 [&_.lg-backdrop]:!backdrop-blur-2xl [&_.ios-search-expanded]:rounded-full [&_.ios-search-expanded]:bg-encore-base/95 [&_.ios-search-expanded]:shadow-[0_12px_32px_rgba(0,0,0,0.5)] [&_.ios-tabbar-search-btn]:bg-encore-base/95"
          )}
        >
          <GlassTabBar
            items={items}
            activeIndex={activeIndex}
            onChange={(index) => {
              const dest = TAB_ROUTES[index];
              if (dest) router.push(dest.href);
            }}
            searchable
            searchPlaceholder="Search songs, artists..."
            searchValue={searchQuery}
            onSearchChange={(q) => setSearchQuery(q)}
            searchIcon={<Search className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            closeIcon={<X className="h-4 w-4" strokeWidth={2} />}
            variant={theme === "dark" ? "dark" : "clear"}
            ariaLabel="Primary navigation"
          />
        </div>

        {isSearching && (
          <button
            type="button"
            onClick={() => submitSearch(searchQuery)}
            aria-label="Submit search"
            title="Search"
            className="btn-cobalt flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full max-[360px]:h-[50px] max-[360px]:w-[50px]"
          >
            <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
