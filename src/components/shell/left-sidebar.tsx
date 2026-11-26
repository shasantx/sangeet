"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Disc3,
  HardDrive,
  Heart,
  History,
  Library,
  ListMusic,
  Plus,
  Search,
  UserRound,
  X
} from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { ArtworkMosaic } from "@/components/music/artwork-mosaic";
import { cn } from "@/lib/utils";

type FilterType = "all" | "playlists" | "artists" | "albums";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 280;
const RESIZE_STEP = 16;
const RESIZE_LARGE_STEP = 32;

export function LeftSidebar() {
  const pathname = usePathname();

  const leftCollapsed = useUIStore((s) => s.leftCollapsed);
  const leftWidth = useUIStore((s) => s.leftWidth);
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar);
  const setLeftWidth = useUIStore((s) => s.setLeftWidth);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const playlists = useLibraryStore((s) => s.playlists);
  const savedArtists = useLibraryStore((s) => s.savedArtists);
  const savedAlbums = useLibraryStore((s) => s.savedAlbums);

  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null
  );

  const handleCreatePlaylist = () => {
    window.dispatchEvent(new Event("sangeet:create-playlist"));
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, startWidth: leftWidth };
    setIsResizing(true);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    setLeftWidth(drag.startWidth + (e.clientX - drag.startX));
  };

  const handleResizePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
    setIsResizing(false);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? RESIZE_LARGE_STEP : RESIZE_STEP;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setLeftWidth(leftWidth + step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setLeftWidth(leftWidth - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      setLeftWidth(MIN_SIDEBAR_WIDTH);
    } else if (e.key === "End") {
      e.preventDefault();
      setLeftWidth(MAX_SIDEBAR_WIDTH);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setLeftWidth(DEFAULT_SIDEBAR_WIDTH);
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredPlaylists = playlists.filter(
    (p) => !q || p.name.toLowerCase().includes(q)
  );
  const filteredArtists = savedArtists.filter(
    (a) => !q || a.name.toLowerCase().includes(q)
  );
  const filteredAlbums = savedAlbums.filter(
    (a) =>
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.artist.toLowerCase().includes(q)
  );

  const libraryLinks = [
    {
      href: "/liked",
      label: "Liked songs",
      icon: Heart,
      count: likedTracks.length
    },
    {
      href: "/offline",
      label: "Offline & local",
      icon: HardDrive,
      count: null
    },
    {
      href: "/recently-played",
      label: "Recently played",
      icon: History,
      count: recentlyPlayed.length > 0 ? recentlyPlayed.length : null
    }
  ];

  return (
    <aside
      id="library-sidebar"
      aria-label="Library"
      style={{ width: leftCollapsed ? 68 : leftWidth }}
      className="relative hidden h-full shrink-0 flex-col rounded-panel bg-encore-base/90 shadow-[0_8px_28px_rgba(0,0,0,0.22)] select-none dark:shadow-[0_8px_28px_rgba(0,0,0,0.35)] md:flex"
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between pb-1.5 pt-2",
          leftCollapsed ? "justify-center px-2" : "px-3"
        )}
      >
        <button
          type="button"
          onClick={toggleLeftSidebar}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg px-2 text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text",
            leftCollapsed && "justify-center px-0"
          )}
          title={leftCollapsed ? "Expand library" : "Collapse library"}
          aria-expanded={!leftCollapsed}
          aria-label={leftCollapsed ? "Expand library" : "Collapse library"}
        >
          <Library className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {!leftCollapsed && (
            <span className="text-sm font-medium text-encore-text">
              Library
            </span>
          )}
        </button>

        {!leftCollapsed && (
          <button
            type="button"
            onClick={handleCreatePlaylist}
            title="Create playlist"
            aria-label="Create playlist"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-encore-subdued transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Filter Chips + Library Search */}
      {!leftCollapsed && (
        <div className="space-y-2 px-3 pb-2">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {(["playlists", "artists", "albums"] as const).map((chip) => {
              const active = filter === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFilter(active ? "all" : chip)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-[44px] shrink-0 rounded-lg px-3.5 text-xs font-medium capitalize transition-colors duration-150",
                    active
                      ? "bg-encore-accent text-encore-on-accent"
                      : "bg-encore-elevated text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
                  )}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {showSearch ? (
            <div className="flex h-11 items-center gap-2 rounded-lg bg-encore-elevated pl-3 pr-1">
              <Search
                className="h-4 w-4 shrink-0 text-encore-muted"
                strokeWidth={1.5}
              />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => {
                  if (!searchTerm) setShowSearch(false);
                }}
                placeholder="Filter library"
                aria-label="Filter library"
                className="h-full w-full bg-transparent text-sm text-encore-text placeholder:text-encore-muted outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear library filter"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-encore-muted hover:text-encore-text"
                >
                  <X className="h-4 w-4" strokeWidth={1.6} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              aria-label="Filter library"
              className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-xs text-encore-muted transition-colors duration-150 hover:bg-encore-elevated hover:text-encore-text"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
              <span>Filter library</span>
            </button>
          )}
        </div>
      )}

      {/* Library Destinations & Collection */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          {libraryLinks
            .filter(
              (item) =>
                (filter === "all" ||
                  (item.href === "/liked" && filter === "playlists")) &&
                (!q || item.label.toLowerCase().includes(q))
            )
            .map(({ href, label, icon: Icon, count }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
                    leftCollapsed && "justify-center px-0",
                    active
                      ? "bg-encore-elevated-highlight font-medium text-encore-text shadow-[inset_0_1px_0_rgba(247,210,122,0.14)]"
                      : "text-encore-subdued hover:bg-encore-elevated hover:text-encore-text"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-encore-accent" : "text-encore-muted"
                    )}
                    strokeWidth={1.5}
                  />
                  {!leftCollapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {count !== null && (
                        <span className="font-mono text-xs tabular-nums text-encore-muted">
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
        </div>

        {!leftCollapsed &&
          (filteredPlaylists.length > 0 ||
            filteredArtists.length > 0 ||
            filteredAlbums.length > 0) && (
            <p className="mb-2 mt-6 px-2.5 text-xs font-medium text-encore-muted">
              Collection
            </p>
          )}

        <div className={cn("space-y-1", leftCollapsed && "mt-3")}>
          {(filter === "all" || filter === "playlists") &&
            filteredPlaylists.map((pl) => {
              const active = pathname === `/playlist/${pl.id}`;
              return (
                <Link
                  key={pl.id}
                  href={`/playlist/${pl.id}`}
                  className={cn(
                    "flex min-h-[48px] items-center gap-2.5 rounded-lg p-1.5 transition-colors duration-150",
                    leftCollapsed && "justify-center",
                    active
                      ? "bg-encore-elevated-highlight shadow-[inset_0_1px_0_rgba(247,210,122,0.14)]"
                      : "hover:bg-encore-elevated"
                  )}
                  title={pl.name}
                >
                  <ArtworkMosaic
                    tracks={pl.tracks}
                    cover={pl.cover}
                    alt={pl.name}
                    icon={<ListMusic className="h-4 w-4 text-white" strokeWidth={1.5} />}
                    className="h-9 w-9 shrink-0 rounded-md"
                  />
                  {!leftCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-encore-text">
                        {pl.name}
                      </p>
                      <p className="truncate font-mono text-xs tabular-nums text-encore-muted">
                        {pl.tracks.length}{" "}
                        {pl.tracks.length === 1 ? "track" : "tracks"}
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}

          {(filter === "all" || filter === "artists") &&
            filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${encodeURIComponent(artist.id)}?name=${encodeURIComponent(artist.name)}`}
                className={cn(
                  "flex min-h-[48px] items-center gap-2.5 rounded-lg p-1.5 transition-colors duration-150 hover:bg-encore-elevated",
                  leftCollapsed && "justify-center"
                )}
                title={artist.name}
              >
                {artist.thumbnail ? (
                  <img
                    src={artist.thumbnail}
                    alt={artist.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-encore-elevated text-encore-muted">
                    <UserRound className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                )}
                {!leftCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-encore-text">
                      {artist.name}
                    </p>
                    <p className="truncate text-xs text-encore-muted">Artist</p>
                  </div>
                )}
              </Link>
            ))}

          {(filter === "all" || filter === "albums") &&
            filteredAlbums.map((album) => (
              <Link
                key={album.id}
                href={`/album/${encodeURIComponent(album.id)}?title=${encodeURIComponent(album.title)}`}
                className={cn(
                  "flex min-h-[48px] items-center gap-2.5 rounded-lg p-1.5 transition-colors duration-150 hover:bg-encore-elevated",
                  leftCollapsed && "justify-center"
                )}
                title={album.title}
              >
                {album.thumbnail ? (
                  <img
                    src={album.thumbnail}
                    alt={album.title}
                    className="h-9 w-9 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-encore-elevated text-encore-muted">
                    <Disc3 className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                )}
                {!leftCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-encore-text">
                      {album.title}
                    </p>
                    <p className="truncate text-xs text-encore-muted">
                      {album.artist}
                    </p>
                  </div>
                )}
              </Link>
            ))}
        </div>
      </div>

      {/* Accessible pointer + keyboard resize handle */}
      {!leftCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize library sidebar"
          aria-controls="library-sidebar"
          aria-valuenow={leftWidth}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          tabIndex={0}
          title="Drag or use Left/Right arrows to resize library sidebar (Enter to reset)"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerEnd}
          onPointerCancel={handleResizePointerEnd}
          onKeyDown={handleResizeKeyDown}
          onDoubleClick={() => setLeftWidth(DEFAULT_SIDEBAR_WIDTH)}
          className="group absolute bottom-2 -right-2 top-2 z-20 flex w-4 touch-none cursor-col-resize items-center justify-center focus-visible:outline-none"
        >
          <span
            className={cn(
              "h-full w-1 rounded-full transition-colors duration-150",
              isResizing
                ? "bg-encore-accent"
                : "bg-transparent group-hover:bg-encore-accent/40 group-focus-visible:bg-encore-accent group-focus-visible:ring-2 group-focus-visible:ring-encore-accent/40"
            )}
          />
        </div>
      )}
    </aside>
  );
}
