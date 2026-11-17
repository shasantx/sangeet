"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderPlus,
  FolderUp,
  HardDrive,
  Laptop,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  addAndroidEventListener,
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
  registerScannedDesktopTracks,
  removeLocalAudio,
  restoreLocalAudio,
  scanDesktopAudioLibrary,
} from "@/lib/local-audio";
import { isDesktopNativeApp } from "@/lib/offline-audio";
import type { Track } from "@/lib/types";
import { cn, formatDuration, pluralize } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import { Equalizer } from "@/components/music/equalizer";

const AUDIO_ACCEPT = ".mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.wma,.webm,audio/*";

interface FileHandleLike {
  kind: "file";
  getFile: () => Promise<File>;
}

interface DirectoryHandleLike {
  kind: "directory";
  values: () => AsyncIterable<FileHandleLike | DirectoryHandleLike>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
}

async function collectFilesFromDirectory(dir: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === "file") {
      files.push(await entry.getFile());
    } else if (entry.kind === "directory") {
      const nested = await collectFilesFromDirectory(entry);
      files.push(...nested);
    }
  }
  return files;
}

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
  const [isNativeDesktop, setIsNativeDesktop] = useState(false);
  const [desktopFolders, setDesktopFolders] = useState<string[]>([]);
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

  const runDesktopScan = useCallback(async () => {
    setIsBusy(true);
    try {
      const res = await scanDesktopAudioLibrary();
      setDesktopFolders(res.folders);
      setTracks(res.tracks);
      setHasScanned(true);
    } catch {
      toast.error("Could not scan music folders", "Check folder permissions and try again.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleDesktopPickFolder = useCallback(async () => {
    if (!window.sangeetDesktop?.pickMusicFolder) return;
    setIsBusy(true);
    try {
      const res = await window.sangeetDesktop.pickMusicFolder();
      setDesktopFolders(Array.isArray(res?.folders) ? res.folders : []);
      setTracks(registerScannedDesktopTracks(Array.isArray(res?.tracks) ? res.tracks : []));
      setHasScanned(true);
    } catch {
      toast.error("Could not open folder", "Try again or choose another music folder.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleDesktopRemoveFolder = useCallback(async (folder: string) => {
    if (!window.sangeetDesktop?.removeMusicFolder) return;
    setIsBusy(true);
    try {
      const res = await window.sangeetDesktop.removeMusicFolder(folder);
      setDesktopFolders(Array.isArray(res?.folders) ? res.folders : []);
      setTracks(registerScannedDesktopTracks(Array.isArray(res?.tracks) ? res.tracks : []));
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    const nativeAndroid = isAndroidNativeApp();
    const nativeDesktop = isDesktopNativeApp();
    setIsNativeAndroid(nativeAndroid);
    setIsNativeDesktop(nativeDesktop);

    if (nativeAndroid) {
      if (androidHasAudioPermission()) {
        runAndroidScan();
      }
      return;
    }

    if (nativeDesktop) {
      void runDesktopScan();
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
  }, [runAndroidScan, runDesktopScan]);

  useEffect(() => {
    if (!isNativeAndroid || typeof window === "undefined") return;

    const unsubscribe = addAndroidEventListener((type, payload) => {
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
    });

    const handleResume = () => {
      if (awaitingPermissionRef.current && androidHasAudioPermission()) {
        awaitingPermissionRef.current = false;
        runAndroidScan();
      }
    };
    window.addEventListener("focus", handleResume);

    return () => {
      window.removeEventListener("focus", handleResume);
      unsubscribe();
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

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsBusy(true);
    try {
      const { added, skipped } = await importLocalAudio(files);
      if (added.length > 0) {
        setTracks((prev) => [...prev, ...added]);
        toast.success(
          `Imported ${pluralize(added.length, "audio file")}`,
          skipped > 0
            ? `${pluralize(skipped, "file")} skipped (unsupported format or over 100 MB).`
            : "Saved privately on this device for offline playback.",
        );
      } else if (skipped > 0) {
        toast.info(
          "No audio files imported",
          `${pluralize(skipped, "file")} skipped. Choose MP3, M4A, AAC, WAV, FLAC, OGG, OPUS, WMA, or WEBM files under 100 MB.`,
        );
      }
    } catch {
      toast.error(
        "Could not import local audio",
        "Check browser storage permissions and available disk space.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleWebImport = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await importFiles(Array.from(fileList));
  };

  const handleFolderImport = async () => {
    const picker =
      typeof window !== "undefined"
        ? (window as DirectoryPickerWindow).showDirectoryPicker
        : undefined;

    if (typeof picker === "function") {
      try {
        const dirHandle = await picker({ mode: "read" });
        setIsBusy(true);
        const collected = await collectFilesFromDirectory(dirHandle);
        if (collected.length === 0) {
          setIsBusy(false);
          toast.info("Folder is empty", "No files were found in the selected folder.");
          return;
        }
        await importFiles(collected);
        return;
      } catch (error) {
        setIsBusy(false);
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // Fall back to standard webkitdirectory input if showDirectoryPicker fails.
      }
    }

    folderInputRef.current?.click();
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[.08] bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              {isNativeAndroid ? (
                <Smartphone className="h-5 w-5" />
              ) : isNativeDesktop ? (
                <Laptop className="h-5 w-5" />
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
                    : isNativeDesktop
                      ? "Automatically reads MP3, FLAC, M4A, WAV & OGG songs from your Windows Music folders."
                      : "Import MP3, M4A, FLAC, WAV, AAC, OGG, or OPUS files from your computer."}
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
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
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
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-elevated px-4 text-xs font-medium text-foreground transition hover:border-white/[.2] disabled:opacity-40"
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
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-elevated px-4 text-xs font-medium text-foreground transition hover:border-white/[.22] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
                {hasScanned ? "Rescan device audio" : "Scan device audio"}
              </button>
            ) : isNativeDesktop ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void runDesktopScan()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-elevated px-4 text-xs font-medium text-foreground transition hover:border-white/[.22] disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
                  Rescan PC music
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleDesktopPickFolder()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.12] bg-transparent px-4 text-xs font-medium text-foreground transition hover:border-white/[.2] hover:bg-elevated disabled:opacity-50"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Add music folder
                </button>
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT}
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
                  accept={AUDIO_ACCEPT}
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
                  onClick={() => void handleFolderImport()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.1] bg-transparent px-4 text-xs font-medium text-muted-foreground transition hover:border-white/[.2] hover:bg-white/[.05] hover:text-foreground disabled:opacity-50"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                  Import folder
                </button>
              </>
            )}
          </div>
        </div>

        {isNativeDesktop && desktopFolders.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {desktopFolders.map((folder) => (
              <span
                key={folder}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[.09] bg-elevated px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <span className="truncate">{folder}</span>
                {desktopFolders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDesktopRemoveFolder(folder)}
                    aria-label={`Remove folder ${folder}`}
                    className="rounded-full p-0.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

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
                  : isNativeDesktop
                    ? hasScanned
                      ? "No audio files found in your Music folders"
                      : "Scanning your PC Music library..."
                    : "No local audio files imported yet"}
            </p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {tracks.length > 0 && normalizedQuery
                ? "Try clearing the search box to see all local files."
                : isNativeAndroid
                  ? "Sangeet reads audio metadata directly from your Android MediaStore."
                  : isNativeDesktop
                    ? "Click “Add music folder” to include additional folders containing MP3, FLAC, M4A, or WAV songs."
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
                    isCurrent && "bg-primary/[0.08]",
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
                      <Equalizer playing className="text-primary" />
                    ) : isCurrent ? (
                      <Play className="h-3.5 w-3.5 fill-current text-primary" />
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
                        isCurrent ? "text-primary" : "text-foreground",
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

                  {!isNativeAndroid && !isNativeDesktop && (
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
