"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListMusic, Loader2, Plus, Search, X } from "lucide-react";
import type { Track } from "@/types/music";
import { useLibraryStore } from "@/store/library-store";
import { useToastStore } from "@/store/toast-store";
import { TrackArtwork } from "@/components/music/track-artwork";
import { ArtworkMosaic } from "@/components/music/artwork-mosaic";
import { cn } from "@/lib/utils";

/**
 * Interactive Spotify/Apple Music-style Create Playlist dialog.
 * Triggered anywhere via `window.dispatchEvent(new Event("sangeet:create-playlist"))`.
 * Requires naming the playlist and lets users optionally add songs right away.
 */
export function CreatePlaylistModal() {
  const router = useRouter();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const showToast = useToastStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setName("");
      setDescription("");
      setNameTouched(false);
      setSelectedTracks([]);
      setSearchQuery("");
      setSearchResults([]);
      setOpen(true);
    };
    window.addEventListener("sangeet:create-playlist", onOpen);
    return () => window.removeEventListener("sangeet:create-playlist", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
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
            setSearchResults(data.tracks.slice(0, 8));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, open]);

  const suggestedTracks = useMemo(() => {
    const combined = [...likedTracks, ...recentlyPlayed];
    const seen = new Set<string>();
    const unique: Track[] = [];
    for (const t of combined) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
      if (unique.length >= 8) break;
    }
    return unique;
  }, [likedTracks, recentlyPlayed]);

  if (!open) return null;

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= 1;
  const visiblePickerTracks =
    searchQuery.trim().length >= 2 ? searchResults : suggestedTracks;

  const toggleTrackSelection = (track: Track) => {
    setSelectedTracks((prev) =>
      prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [...prev, track]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (!isNameValid) {
      nameInputRef.current?.focus();
      return;
    }
    const created = createPlaylist(trimmedName, description.trim());
    for (const track of selectedTracks) {
      addTrackToPlaylist(created.id, track);
    }
    setOpen(false);
    showToast(
      selectedTracks.length > 0
        ? `Created "${created.name}" with ${selectedTracks.length} song${selectedTracks.length === 1 ? "" : "s"}`
        : `Created "${created.name}"`,
      "success"
    );
    router.push(`/playlist/${created.id}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-playlist-title"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="studio-enter flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-encore-base/95 shadow-[0_28px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <div>
            <h2
              id="create-playlist-title"
              className="text-lg font-bold tracking-tight text-encore-text"
            >
              Create playlist
            </h2>
            <p className="mt-0.5 text-xs text-encore-subdued">
              Give your playlist a name and add songs right away
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close create playlist dialog"
            className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued transition-colors hover:bg-encore-elevated hover:text-encore-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-4">
            {/* Cover preview + Name & Description */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ArtworkMosaic
                tracks={selectedTracks}
                alt={trimmedName || "New playlist"}
                icon={<ListMusic className="h-8 w-8 text-white" strokeWidth={1.5} />}
                className="mx-auto h-28 w-28 shrink-0 rounded-2xl sm:mx-0"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label
                    htmlFor="playlist-name-input"
                    className="mb-1.5 block text-xs font-semibold text-encore-subdued"
                  >
                    Playlist name <span className="text-encore-accent">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    id="playlist-name-input"
                    type="text"
                    maxLength={80}
                    required
                    value={name}
                    onBlur={() => setNameTouched(true)}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Late Night Drives"
                    className={cn(
                      "h-11 w-full rounded-xl bg-encore-elevated px-3.5 text-sm font-medium text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2",
                      nameTouched && !isNameValid
                        ? "ring-2 ring-encore-negative/70 focus:ring-encore-negative/70"
                        : "focus:ring-encore-accent/55"
                    )}
                  />
                  {nameTouched && !isNameValid && (
                    <p className="mt-1 text-[11px] font-medium text-encore-negative">
                      Please enter a name for your playlist.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="playlist-desc-input"
                    className="mb-1.5 block text-xs font-medium text-encore-subdued"
                  >
                    Description (optional)
                  </label>
                  <input
                    id="playlist-desc-input"
                    type="text"
                    maxLength={160}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a mood, vibe, or note..."
                    className="h-10 w-full rounded-xl bg-encore-elevated px-3.5 text-xs text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55"
                  />
                </div>
              </div>
            </div>

            {/* Quick Add Songs section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-encore-text">
                  Add songs
                </span>
                {selectedTracks.length > 0 && (
                  <span className="rounded-full bg-encore-tinted px-2.5 py-0.5 font-mono text-[11px] font-semibold text-encore-accent">
                    {selectedTracks.length} selected
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encore-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search songs to add..."
                  className="h-10 w-full rounded-full bg-encore-elevated pl-10 pr-9 text-xs text-encore-text placeholder:text-encore-muted outline-none transition focus:ring-2 focus:ring-encore-accent/55"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-encore-accent" />
                )}
                {!searching && searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear song search"
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-encore-muted hover:text-encore-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {visiblePickerTracks.length > 0 ? (
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {visiblePickerTracks.map((track) => {
                    const picked = selectedTracks.some((t) => t.id === track.id);
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => toggleTrackSelection(track)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors",
                          picked
                            ? "bg-encore-tinted/80"
                            : "hover:bg-encore-elevated"
                        )}
                      >
                        <TrackArtwork
                          src={track.thumbnail}
                          trackId={track.id}
                          alt={track.title}
                          className="h-9 w-9 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-encore-text">
                            {track.title}
                          </p>
                          <p className="truncate text-[11px] text-encore-subdued">
                            {track.artist}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                            picked
                              ? "btn-cobalt text-white"
                              : "bg-encore-elevated-highlight text-encore-subdued"
                          )}
                        >
                          {picked ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                          ) : (
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-encore-elevated/55 px-3 py-4 text-center text-xs text-encore-subdued">
                  {searchQuery.trim().length >= 2 && !searching
                    ? "No matching tracks found."
                    : "Search above to add tracks now, or add songs later inside the playlist."}
                </p>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 bg-encore-elevated/50 px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-full bg-encore-elevated px-5 text-xs font-semibold text-encore-subdued transition-colors hover:bg-encore-elevated-highlight hover:text-encore-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isNameValid}
              className="btn-cobalt h-11 rounded-full px-6 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {selectedTracks.length > 0
                ? `Create (${selectedTracks.length})`
                : "Create playlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
