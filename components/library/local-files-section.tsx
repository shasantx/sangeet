"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderUp,
  HardDrive,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import {
  androidHasAudioPermission,
  androidRequestAudioPermission,
  androidScanLocalAudio,
  isAndroidNativeApp,
} from "@/lib/android-bridge";
import { getAlbum, getArtist } from "@/lib/catalog";
import { removeDynamicLocalTrack } from "@/lib/dynamic-tracks";
import {
  importLocalAudio,
  registerScannedAndroidTracks,
  removeLocalAudio,
  restoreLocalAudio,
} from "@/lib/local-audio";
import type { Track } from "@/lib/types";
import { cn, formatDuration, pluralize } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { Equalizer } from "@/components/music/equalizer";

interface LocalFilesSectionProps {
  searchQuery?: string;
  onCountChange?: (count: number) => void;
  className?: string;
}

export function LocalFilesSection({
  searchQuery = "",
  onCountChange,
  className,
}: LocalFilesSectionProps) {
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const awaitingPermissionRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playShuffled = usePlayerStore((state) => state.playShuffled);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const runAndroidScan = useCallback(() => {
    setIsBusy(true);
    setPermissionMessage(null);
    try {
      const scanned = androidScanLocalAudio();
      const registered = registerScannedAndroidTracks(scanned);
      setTracks(registered);
      setHasScanned(true);
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    const native = isAndroidNativeApp();
    setIsNativeAndroid(native);

    if (native) {
      if (androidHasAudioPermission()) {
        runAndroidScan();
      }
      return;
    }

    let cancelled = false;
    restoreLocalAudio()
      .then((restored) => {
        if (!cancelled) {
          setTracks(restored);
        }
      })
      .catch(() => {
        // IndexedDB unavailable (e.g. private browsing); leave list empty.
      });

    return () => {
      cancelled = true;
    };
  }, [runAndroidScan]);

  useEffect(() => {
    if (!isNativeAndroid || typeof window === "undefined") return;

    const prevHandler = window.__sangeetAndroidEvent;
    const wrappedHandler = (type: string, payload?: string) => {
      prevHandler?.(type, payload);
      if (type === "audio_permission") {
        awaitingPermissionRef.current = false;
        const granted =
          payload === "granted" ||
          payload === "true" ||
          androidHasAudioPermission();
        if (granted) {
          runAndroidScan();
        } else {
          setIsBusy(false);
          setPermissionMessage(
            "Audio permission was denied. Allow access in Android settings to scan your device.",
          );
        }
      }
    };

    window.__sangeetAndroidEvent = wrappedHandler;

    const handleResume = () => {
      if (awaitingPermissionRef.current && androidHasAudioPermission()) {
        awaitingPermissionRef.current = false;
        runAndroidScan();
      }
    };
    window.addEventListener("focus", handleResume);

    return () => {
      window.removeEventListener("focus", handleResume);
      if (window.__sangeetAndroidEvent === wrappedHandler) {
        if (prevHandler) window.__sangeetAndroidEvent = prevHandler;
        else delete window.__sangeetAndroidEvent;
      }
    };
  }, [isNativeAndroid, runAndroidScan]);

  useEffect(() => {
    onCountChange?.(tracks.length);
  }, [tracks.length, onCountChange]);

  const handleAndroidScanClick = () => {
    setPermissionMessage(null);
    if (androidHasAudioPermission()) {
      runAndroidScan();
      return;
    }
    awaitingPermissionRef.current = true;
    setIsBusy(true);
    androidRequestAudioPermission();
  };

  const handleWebImport = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsBusy(true);
    try {
      const imported = await importLocalAudio(Array.from(fileList));
      if (imported.length > 0) {
        setTracks((prev) => [...prev, ...imported]);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveTrack = async (id: string) => {
    await removeLocalAudio(id).catch(() => {});
    removeDynamicLocalTrack(id);
    setTracks((prev) => prev.filter((track) => track.id !== id));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTracks = useMemo(() => {
    if (!normalizedQuery) return tracks;
    return tracks.filter((track) => {
      const artistName = getArtist(track.artistId)?.name ?? "";
      const albumTitle = getAlbum(track.albumId)?.title ?? "";
      return (
        track.title.toLowerCase().includes(normalizedQuery) ||
        artistName.toLowerCase().includes(normalizedQuery) ||
        albumTitle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tracks, normalizedQuery]);

  const trackIds = useMemo(
    () => filteredTracks.map((track) => track.id),
    [filteredTracks],
  );
  const isCollectionActive = Boolean(
    currentTrackId && trackIds.includes(currentTrackId),
  );

  return (
    <section className={cn("mt-9", className)}>
      <div className="relative overflow-hidden rounded-2xl border border-white/[.07] bg-gradient-to-b from-white/[.045] to-white/[.015] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#1ED760] ring-1 ring-[#1ED760]/25">
              {isNativeAndroid ? (
                <Smartphone className="h-5 w-5" />
              ) : (
                <HardDrive className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="eyebrow mb-1">On this device</p>
              <h2 className="font-display text-xl font-medium tracking-[-0.03em] sm:text-2xl">
                Local Files
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {tracks.length > 0
                  ? `${pluralize(tracks.length, "song")} ready to play offline`
                  : isNativeAndroid
                    ? "Scan your Android MediaStore library to play audio stored on your phone."
                    : "Import MP3, FLAC, WAV, AAC, or OGG files from your computer."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {tracks.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={trackIds.length === 0}
                  onClick={() => {
                    if (isCollectionActive) togglePlay();
                    else if (trackIds[0]) playTrack(trackIds[0], trackIds, "Local Files");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1ED760] px-5 text-xs font-bold text-black shadow-[0_12px_28px_-14px_rgba(30,215,96,.8)] transition hover:scale-[1.02] hover:bg-[#46E982] active:scale-[0.98] disabled:opacity-40"
                >
                  {isCollectionActive && isPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                  )}
                  Play all
                </button>
                <button
                  type="button"
                  disabled={trackIds.length === 0}
                  onClick={() => playShuffled(trackIds, "Local Files")}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-white/[.03] px-4 text-xs font-medium text-foreground transition hover:border-white/[.2] hover:bg-white/[.07] disabled:opacity-40"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </button>
              </>
            )}

            {isNativeAndroid ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleAndroidScanClick}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-white/[.05] px-4 text-xs font-medium text-foreground transition hover:border-white/[.22] hover:bg-white/[.09] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
                {hasScanned ? "Rescan device audio" : "Scan device audio"}
              </button>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleWebImport(event.target.files);
                    event.target.value = "";
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  {...({ webkitdirectory: "" } as Record<string, string>)}
                  className="hidden"
                  onChange={(event) => {
                    void handleWebImport(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-white/[.05] px-4 text-xs font-medium text-foreground transition hover:border-white/[.22] hover:bg-white/[.09] disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import audio files
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.1] bg-transparent px-4 text-xs font-medium text-muted-foreground transition hover:border-white/[.2] hover:bg-white/[.05] hover:text-foreground disabled:opacity-50"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                  Import folder
                </button>
              </>
            )}
          </div>
        </div>

        {permissionMessage && (
          <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
            {permissionMessage}
          </p>
        )}

        {filteredTracks.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[.08] bg-black/20 px-4 py-10 text-center">
            <Music2 className="mb-3 h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              {tracks.length > 0 && normalizedQuery
                ? "No local tracks match your filter"
                : isNativeAndroid
                  ? hasScanned
                    ? "No audio files found on this device"
                    : "Tap “Scan device audio” to load your music"
                  : "No local audio files imported yet"}
            </p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {tracks.length > 0 && normalizedQuery
                ? "Try clearing the search box to see all local files."
                : isNativeAndroid
                  ? "Sangeet reads audio metadata directly from your Android MediaStore."
                  : "Imported files are saved privately in this browser using IndexedDB."}
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-white/[.045] rounded-xl border border-white/[.05] bg-black/20">
            {filteredTracks.map((track, index) => {
              const artistName = getArtist(track.artistId)?.name ?? "On this device";
              const albumTitle = getAlbum(track.albumId)?.title;
              const isCurrent = currentTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[.045] sm:px-4",
                    isCurrent && "bg-[#1ED760]/[0.07]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) togglePlay();
                      else playTrack(track.id, trackIds, "Local Files");
                    }}
                    aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs text-muted-foreground transition hover:bg-white/[.08] hover:text-foreground"
                  >
                    {isCurrent && isPlaying ? (
                      <Equalizer playing className="text-[#1ED760]" />
                    ) : isCurrent ? (
                      <Play className="h-3.5 w-3.5 fill-current text-[#1ED760]" />
                    ) : (
                      <>
                        <span className="tabular-nums group-hover:hidden">
                          {index + 1}
                        </span>
                        <Play className="hidden h-3.5 w-3.5 fill-current text-foreground group-hover:block" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) togglePlay();
                      else playTrack(track.id, trackIds, "Local Files");
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        isCurrent ? "text-[#1ED760]" : "text-foreground",
                      )}
                    >
                      {track.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {albumTitle ? `${artistName} · ${albumTitle}` : artistName}
                    </p>
                  </button>

                  {track.duration > 0 && (
                    <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                      {formatDuration(track.duration)}
                    </span>
                  )}

                  {!isNativeAndroid && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTrack(track.id)}
                      aria-label={`Remove ${track.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 opacity-100 transition hover:bg-white/[.08] hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
