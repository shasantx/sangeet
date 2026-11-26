"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  Clock,
  ListMusic,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X
} from "lucide-react";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { useToastStore } from "@/store/toast-store";
import { TrackRow } from "@/components/music/track-row";
import { TrackArtwork } from "@/components/music/track-artwork";
import { ArtworkMosaic } from "@/components/music/artwork-mosaic";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/music";

type SortMode = "custom" | "title" | "artist" | "duration";

export default function PlaylistPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const findSectionRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const playlist = useLibraryStore((s) =>
    s.playlists.find((p) => p.id === id)
  );
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore(
    (s) => s.removeTrackFromPlaylist
  );
  const reorderPlaylistTrack = useLibraryStore((s) => s.reorderPlaylistTrack);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playShuffled = usePlayerStore((s) => s.playShuffled);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const showToast = useToastStore((s) => s.showToast);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = findQuery.trim();
    if (trimmed.length < 2) {
      setFindResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data?.tracks)) {
            setFindResults(data.tracks.slice(0, 8));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [findQuery]);

  const suggestedTracks = useMemo(() => {
    const existingIds = new Set((playlist?.tracks ?? []).map((t) => t.id));
    const combined = [...likedTracks, ...recentlyPlayed];
    const seen = new Set<string>();
    const unique: Track[] = [];
    for (const track of combined) {
      if (!existingIds.has(track.id) && !seen.has(track.id)) {
        seen.add(track.id);
        unique.push(track);
      }
      if (unique.length >= 6) break;
    }
    return unique;
  }, [playlist?.tracks, likedTracks, recentlyPlayed]);

  const displayedTracks = useMemo(() => {
    const raw = playlist?.tracks ?? [];
    const q = filterQuery.trim().toLowerCase();
    const filtered = q
      ? raw.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album ?? "").toLowerCase().includes(q)
        )
      : [...raw];

    if (sortMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "artist") {
      filtered.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortMode === "duration") {
      filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return filtered;
  }, [playlist?.tracks, filterQuery, sortMode]);

  if (!playlist) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <p className="text-lg font-bold text-encore-text">Playlist not found</p>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="btn-cobalt mt-4 inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold transition active:scale-[0.98]"
        >
          Go Home
        </button>
      </div>
    );
  }

  const cover = playlist.cover || playlist.tracks[0]?.thumbnail;
  const canDragReorder = sortMode === "custom" && filterQuery.trim() === "";
  const isPlaylistPlaying =
    isPlaying &&
    Boolean(currentTrack) &&
    playlist.tracks.some((t) => t.id === currentTrack?.id);

  const startEdit = () => {
    setNameDraft(playlist.name);
    setDescDraft(playlist.description || "");
    setEditing(true);
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    renamePlaylist(playlist.id, trimmed, descDraft.trim());
    setEditing(false);
    showToast("Playlist updated", "success");
  };

  const focusSongFinder = () => {
    findSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    window.setTimeout(() => {
      findInputRef.current?.focus({ preventScroll: true });
    }, 260);
  };

  const handlePrimaryPlay = () => {
    if (displayedTracks.length === 0) return;
    if (isPlaylistPlaying) {
      togglePlay();
    } else {
      playTrack(displayedTracks[0], displayedTracks);
    }
  };

  const isSearchingSongs = findQuery.trim().length >= 2;
  const finderTracks = isSearchingSongs ? findResults : suggestedTracks;

  return (
    <div className="min-h-full overflow-x-hidden pb-12">
      <div
        className="flex flex-col gap-5 p-4 pt-6 sm:flex-row sm:items-end sm:gap-6 sm:p-6 sm:pt-10"
        style={{
          background:
            "var(--background-base)"
        }}
      >
        <ArtworkMosaic
          tracks={playlist.tracks}
          cover={cover}
          alt={playlist.name}
          icon={<ListMusic className="h-12 w-12 text-white" strokeWidth={1.5} />}
          className="h-40 w-40 shrink-0 rounded-[14px] sm:h-48 sm:w-48"
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-encore-muted">Playlist</p>

          {editing ? (
            <form onSubmit={saveEdit} className="mt-2 max-w-lg space-y-2.5">
              <input
                type="text"
                autoFocus
                required
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Playlist name"
                className="w-full rounded-xl bg-encore-elevated px-3.5 py-2 text-xl font-bold text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55 sm:text-2xl"
              />
              <input
                type="text"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-xl bg-encore-elevated px-3.5 py-2 text-sm text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!nameDraft.trim()}
                  className="btn-cobalt inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-encore-elevated px-4 text-xs font-semibold text-encore-text transition hover:bg-encore-elevated-highlight"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="mt-1.5 truncate text-3xl font-medium tracking-[-0.02em] text-encore-text sm:text-5xl">
                {playlist.name}
              </h1>
              {playlist.description && (
                <p className="mt-2 text-sm text-encore-subdued">
                  {playlist.description}
                </p>
              )}
              <p className="mt-3 font-mono text-xs tabular-nums text-encore-muted">
                {playlist.tracks.length}{" "}
                {playlist.tracks.length === 1 ? "track" : "tracks"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Controls + In-Playlist Filter & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            disabled={displayedTracks.length === 0}
            onClick={handlePrimaryPlay}
            className="btn-cobalt flex h-12 w-12 items-center justify-center rounded-full transition hover:scale-105 disabled:opacity-40 sm:h-14 sm:w-14"
            aria-label={isPlaylistPlaying ? "Pause playlist" : "Play playlist"}
          >
            {isPlaylistPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            disabled={displayedTracks.length === 0}
            onClick={() => playShuffled(displayedTracks)}
            title="Shuffle play"
            aria-label="Shuffle play"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-encore-elevated/75 text-encore-subdued transition hover:bg-encore-elevated-highlight hover:text-encore-text disabled:opacity-40"
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={focusSongFinder}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-encore-tinted px-4 text-xs font-semibold text-encore-accent transition hover:bg-encore-tinted-highlight"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add songs
          </button>

          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-encore-elevated/75 px-4 text-xs font-semibold text-encore-text transition hover:bg-encore-elevated-highlight"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-encore-elevated/75 px-4 text-xs font-semibold text-encore-subdued transition hover:bg-encore-elevated-highlight hover:text-encore-negative"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        {playlist.tracks.length > 1 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-encore-muted" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter songs..."
                className="h-11 w-full rounded-full bg-encore-elevated/75 pl-9 pr-3 text-xs text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55 sm:w-52"
              />
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-encore-muted" />
              <select
                aria-label="Sort playlist tracks"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-11 rounded-full bg-encore-elevated/75 pl-8 pr-4 text-xs font-semibold text-encore-text outline-none transition focus:ring-2 focus:ring-encore-accent/55"
              >
                <option value="custom">Custom order</option>
                <option value="title">Title (A–Z)</option>
                <option value="artist">Artist (A–Z)</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tracklist */}
      <div className="px-4 sm:px-6">
        {playlist.tracks.length === 0 ? (
          <div className="rounded-2xl bg-encore-elevated/75 p-10 text-center">
            <p className="text-base font-bold text-encore-text">
              This playlist is empty
            </p>
            <p className="mt-1 text-sm text-encore-subdued">
              Search below, tap a suggestion, or click the{" "}
              <span className="font-bold text-encore-text">•••</span> menu on any
              track to add songs here.
            </p>
            <button
              type="button"
              onClick={focusSongFinder}
              className="btn-cobalt mt-5 inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add songs
            </button>
          </div>
        ) : displayedTracks.length === 0 ? (
          <p className="py-10 text-center text-sm text-encore-subdued">
            No songs in this playlist match &ldquo;{filterQuery}&rdquo;.
          </p>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-xl bg-encore-elevated/45 px-2 py-2 text-xs font-medium uppercase tracking-wider text-encore-subdued sm:grid-cols-[28px_1fr_minmax(0,0.6fr)_110px] sm:gap-3 sm:px-3">
              <span className="text-center">#</span>
              <span>Title</span>
              <span className="hidden sm:block">Album</span>
              <span className="flex justify-end pr-2">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="space-y-0.5">
              {displayedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  contextQueue={displayedTracks}
                  onRemove={() => removeTrackFromPlaylist(playlist.id, track.id)}
                  draggable={canDragReorder}
                  isDragOver={dragOverIndex === idx && dragIndex !== idx}
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    if (!canDragReorder) return;
                    e.preventDefault();
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (
                      canDragReorder &&
                      dragIndex !== null &&
                      dragIndex !== idx
                    ) {
                      reorderPlaylistTrack(playlist.id, dragIndex, idx);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Inline "Let's find something for your playlist" finder */}
        <div
          ref={findSectionRef}
          className="mt-10 rounded-2xl bg-encore-elevated/60 p-5 sm:p-6"
        >
          <h2 className="text-lg font-bold text-encore-text">
            Let&apos;s find something for your playlist
          </h2>
          <div className="relative mt-3 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encore-muted" />
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Search for songs to add..."
              className="h-11 w-full rounded-full bg-encore-base pl-10 pr-10 text-sm text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55"
            />
            {searching ? (
              <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-encore-accent" />
            ) : (
              findQuery && (
                <button
                  type="button"
                  onClick={() => setFindQuery("")}
                  aria-label="Clear song search"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-encore-muted transition hover:text-encore-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>

          {!isSearchingSongs && suggestedTracks.length > 0 && (
            <p className="mt-5 text-xs font-semibold text-encore-subdued">
              Suggested from your library
            </p>
          )}

          {finderTracks.length > 0 ? (
            <div className="mt-3 space-y-1">
              {finderTracks.map((track) => {
                const alreadyIn = playlist.tracks.some((t) => t.id === track.id);
                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between gap-3 rounded-xl p-2 transition-colors hover:bg-encore-elevated-highlight/80"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TrackArtwork
                        src={track.thumbnail}
                        trackId={track.id}
                        alt={track.title}
                        className="h-10 w-10 shrink-0 rounded-lg"
                        iconClassName="h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-encore-text">
                          {track.title}
                        </p>
                        <p className="truncate text-xs text-encore-subdued">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyIn}
                      onClick={() => {
                        addTrackToPlaylist(playlist.id, track);
                        showToast(`Added "${track.title}"`, "success");
                      }}
                      className={cn(
                        "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98]",
                        alreadyIn
                          ? "bg-encore-tinted text-encore-accent opacity-80"
                          : "btn-cobalt"
                      )}
                    >
                      {alreadyIn ? (
                        <>
                          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            isSearchingSongs &&
            !searching && (
              <p className="mt-4 text-xs text-encore-subdued">
                No tracks found for &ldquo;{findQuery.trim()}&rdquo;.
              </p>
            )
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete playlist?"
        description={`"${playlist.name}" and its tracklist will be permanently removed from your library.`}
        confirmLabel="Delete playlist"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deletePlaylist(playlist.id);
          showToast("Playlist deleted");
          router.push("/library");
        }}
      />
    </div>
  );
}
