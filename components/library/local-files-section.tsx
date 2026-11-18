"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderPlus,
  FolderSearch,
  HardDrive,
  Laptop,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import {
  type LocalScannedTrack,
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
const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma|aiff|alac|caf|webm|3gp|mp4)$/i;

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

function isAudioCandidate(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    file.type === "application/ogg" ||
    file.type === "video/ogg" ||
    AUDIO_EXT_RE.test(file.name)
  );
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim().toLowerCase();
}

function readAndroidScannedTracks(): LocalScannedTrack[] {
  const fromBridge = androidScanLocalAudio();
  if (fromBridge.length > 0) return fromBridge;
  if (typeof window === "undefined" || !window.SangeetAndroid?.scanLocalAudio) {
    return [];
  }
  try {
    const raw = window.SangeetAndroid.scanLocalAudio();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized: LocalScannedTrack[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const id = record.id;
      const uri = record.uri;
      const validId =
        typeof id === "string"
          ? id.length > 0
          : typeof id === "number" && Number.isFinite(id);
      if (!validId || typeof uri !== "string" || !uri) continue;
      normalized.push({
        id: String(id),
        title: typeof record.title === "string" ? record.title : "Untitled audio",
        artist: typeof record.artist === "string" ? record.artist : "",
        album: typeof record.album === "string" ? record.album : "",
        duration:
          typeof record.duration === "number" && Number.isFinite(record.duration)
            ? record.duration
            : 0,
        uri,
      });
    }
    return normalized;
  } catch {
    return [];
  }
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
  const [androidGranted, setAndroidGranted] = useState(false);
  const [desktopFolders, setDesktopFolders] = useState<string[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const awaitingPermissionRef = useRef(false);
  const androidGrantedRef = useRef(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playShuffled = usePlayerStore((state) => state.playShuffled);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const runAndroidScan = useCallback((showFeedback = false) => {
    setIsBusy(true);
    setPermissionMessage(null);
    androidGrantedRef.current = true;
    setAndroidGranted(true);
    try {
      const scanned = readAndroidScannedTracks();
      const registered = registerScannedAndroidTracks(scanned);
      setTracks(registered);
      setHasScanned(true);
      if (showFeedback) {
        if (registered.length > 0) {
          toast.success(
            `Found ${pluralize(registered.length, "song")}`,
            "Loaded from your phone's audio library for offline playback.",
          );
        } else {
          toast.info(
            "No audio files found on this device",
            "Add MP3, M4A, FLAC, WAV, or OGG files to your Music or Downloads folder and scan again.",
          );
        }
      }
    } catch {
      toast.error(
        "Could not scan phone audio",
        "Check audio permission in Android settings and try again.",
      );
    } finally {
      setIsBusy(false);
    }
  }, []);

  const runDesktopScan = useCallback(async (showFeedback = false) => {
    setIsBusy(true);
    try {
      const res = await scanDesktopAudioLibrary();
      setDesktopFolders(res.folders);
      setTracks(res.tracks);
      setHasScanned(true);
      if (showFeedback) {
        if (res.tracks.length > 0) {
          toast.success(
            `Found ${pluralize(res.tracks.length, "song")}`,
            "Ready to play from your PC music folders.",
          );
        } else {
          toast.info(
            "No audio files found",
            "Add a music folder containing MP3, FLAC, M4A, WAV, or OGG songs.",
          );
        }
      }
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
      const registered = registerScannedDesktopTracks(Array.isArray(res?.tracks) ? res.tracks : []);
      setTracks(registered);
      setHasScanned(true);
      toast.success(
        `Scanned ${pluralize(registered.length, "song")}`,
        "Your PC music library is up to date.",
      );
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
      const granted = androidHasAudioPermission();
      androidGrantedRef.current = granted;
      setAndroidGranted(granted);
      if (granted) {
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
        androidGrantedRef.current = granted;
        setAndroidGranted(granted);
        if (granted) {
          runAndroidScan(true);
        } else {
          setIsBusy(false);
          setPermissionMessage(
            "Audio permission was denied. Allow access in Android settings to scan your device.",
          );
        }
      }
    });

    const handleResume = () => {
      if (document.visibilityState === "hidden") return;
      if (
        androidHasAudioPermission() &&
        (awaitingPermissionRef.current || !androidGrantedRef.current)
      ) {
        const shouldFeedback = awaitingPermissionRef.current;
        awaitingPermissionRef.current = false;
        runAndroidScan(shouldFeedback);
      }
    };
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
      unsubscribe();
    };
  }, [isNativeAndroid, runAndroidScan]);

  useEffect(() => {
    onCountChange?.(tracks.length);
  }, [tracks.length, onCountChange]);

  const handleAndroidScanClick = () => {
    if (isBusy) return;
    setPermissionMessage(null);
    if (androidHasAudioPermission()) {
      runAndroidScan(true);
      return;
    }
    if (!window.SangeetAndroid?.requestAudioPermission) {
      setPermissionMessage("Android audio scanner is unavailable in this build.");
      return;
    }
    awaitingPermissionRef.current = true;
    setIsBusy(true);
    androidRequestAudioPermission();
  };

  const scanWebAudioFiles = async (files: File[]) => {
    const audioFiles = files.filter(isAudioCandidate);
    if (audioFiles.length === 0) {
      toast.info(
        "No audio files found",
        "Choose a folder containing MP3, M4A, FLAC, WAV, AAC, OGG, or OPUS tracks.",
      );
      return;
    }

    const existingTitles = new Set(tracks.map((track) => track.title.trim().toLowerCase()));
    const freshFiles = audioFiles.filter(
      (file) => !existingTitles.has(stripExtension(file.name)),
    );

    if (freshFiles.length === 0) {
      setHasScanned(true);
      toast.info("Music folder up to date", "All audio files in this folder are already listed.");
      return;
    }

    setIsBusy(true);
    try {
      const { added, skipped } = await importLocalAudio(freshFiles);
      setHasScanned(true);
      if (added.length > 0) {
        setTracks((prev) => [...prev, ...added]);
        toast.success(
          `Found ${pluralize(added.length, "song")}`,
          skipped > 0
            ? `${pluralize(skipped, "file")} skipped (unsupported format or too large).`
            : "Saved locally in this browser for instant playback.",
        );
      } else if (skipped > 0) {
        toast.info(
          "No supported audio found",
          `${pluralize(skipped, "file")} skipped in the selected folder.`,
        );
      }
    } catch {
      toast.error(
        "Could not scan music folder",
        "Check browser storage permissions and available disk space.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleWebFolderScan = async () => {
    const picker =
      typeof window !== "undefined"
        ? (window as DirectoryPickerWindow).showDirectoryPicker
        : undefined;

    if (typeof picker === "function") {
      try {
        const dirHandle = await picker({ mode: "read" });
        setIsBusy(true);
        const collected = await collectFilesFromDirectory(dirHandle);
        setIsBusy(false);
        await scanWebAudioFiles(collected);
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
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
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
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-xl font-medium tracking-[-0.03em] text-foreground sm:text-2xl">
                  Local Music
                </h2>
                {tracks.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-0.5 font-sans text-[11px] font-medium tabular-nums text-muted-foreground">
                    {pluralize(tracks.length, "song")}
                  </span>
                )}
              </div>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                {tracks.length > 0
                  ? `${pluralize(tracks.length, "song")} scanned and ready to play offline`
                  : isNativeAndroid
                    ? "Automatically scans audio stored on your phone via Android MediaStore."
                    : isNativeDesktop
                      ? "Automatically scans MP3, FLAC, M4A, WAV, and OGG songs from your Windows Music folders."
                      : "Scan a music folder on your device to list and play all local audio automatically."}
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
                    else if (trackIds[0]) playTrack(trackIds[0], trackIds, "Local Music");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 font-sans text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
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
                  onClick={() => playShuffled(trackIds, "Local Music")}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-elevated px-4 font-sans text-xs font-medium text-foreground transition hover:border-foreground/20 disabled:opacity-40"
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
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-4 font-sans text-xs font-semibold transition disabled:opacity-50",
                  !androidGranted && tracks.length === 0
                    ? "bg-primary text-primary-foreground hover:brightness-110"
                    : "border border-border bg-elevated text-foreground hover:border-foreground/20",
                )}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
                {androidGranted || hasScanned ? "Rescan phone audio" : "Scan phone audio"}
              </button>
            ) : isNativeDesktop ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void runDesktopScan(true)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full px-4 font-sans text-xs font-semibold transition disabled:opacity-50",
                    tracks.length === 0
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border bg-elevated text-foreground hover:border-foreground/20",
                  )}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
                  Rescan music library
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleDesktopPickFolder()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-elevated px-4 font-sans text-xs font-medium text-foreground transition hover:border-foreground/20 disabled:opacity-50"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Add music folder
                </button>
              </>
            ) : (
              <>
                <input
                  ref={folderInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT}
                  multiple
                  {...({ webkitdirectory: "" } as Record<string, string>)}
                  className="hidden"
                  onChange={(event) => {
                    void scanWebAudioFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleWebFolderScan()}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full px-4 font-sans text-xs font-semibold transition disabled:opacity-50",
                    tracks.length === 0
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border bg-elevated text-foreground hover:border-foreground/20",
                  )}
                >
                  <FolderSearch className={cn("h-3.5 w-3.5", isBusy && "animate-pulse")} />
                  Scan music folder
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
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1 font-sans text-[11px] text-muted-foreground"
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
          <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 font-sans text-xs text-amber-200">
            {permissionMessage}
          </p>
        )}

        {filteredTracks.length === 0 ? (
          <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-elevated text-muted-foreground">
              <Music2 className="h-5 w-5" />
            </div>
            <p className="font-sans text-sm font-medium text-foreground">
              {tracks.length > 0 && normalizedQuery
                ? "No local songs match your filter"
                : isNativeAndroid
                  ? hasScanned
                    ? "No audio files found on this device"
                    : "Tap “Scan phone audio” to load your music"
                  : isNativeDesktop
                    ? hasScanned
                      ? "No audio files found in your Music folders"
                      : "Scanning your PC Music library..."
                    : "No scanned music folder yet"}
            </p>
            <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground">
              {tracks.length > 0 && normalizedQuery
                ? "Try clearing the search box to see all scanned songs."
                : isNativeAndroid
                  ? "Sangeet reads audio metadata directly from your Android MediaStore."
                  : isNativeDesktop
                    ? "Click “Add music folder” to include additional folders containing MP3, FLAC, M4A, or WAV songs."
                    : "Choose a folder to automatically scan and list all audio files inside it."}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
            {filteredTracks.map((track, index) => {
              const artistName = getArtist(track.artistId)?.name ?? "On this device";
              const albumTitle = getAlbum(track.albumId)?.title;
              const isCurrent = currentTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={cn(
                    "group flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-white/[0.04] sm:px-4",
                    isCurrent && "bg-primary/[0.08]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) togglePlay();
                      else playTrack(track.id, trackIds, "Local Music");
                    }}
                    aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                    className="flex h-8 w-7 shrink-0 items-center justify-center rounded-full font-sans text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {isCurrent && isPlaying ? (
                      <Equalizer playing className="text-primary" />
                    ) : isCurrent ? (
                      <Play className="h-3.5 w-3.5 fill-current text-primary" />
                    ) : (
                      <>
                        <span className="font-sans text-xs font-medium tabular-nums group-hover:hidden">
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
                      else playTrack(track.id, trackIds, "Local Music");
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-elevated text-muted-foreground transition",
                        isCurrent && "border-primary/30 bg-primary/15 text-primary",
                      )}
                    >
                      <Music2 className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-sans text-sm font-medium",
                          isCurrent ? "text-primary" : "text-foreground",
                        )}
                      >
                        {track.title}
                      </span>
                      <span className="mt-0.5 block truncate font-sans text-xs text-muted-foreground">
                        {albumTitle ? `${artistName} · ${albumTitle}` : artistName}
                      </span>
                    </span>
                  </button>

                  {track.duration > 0 && (
                    <span className="shrink-0 font-sans text-xs tabular-nums text-muted-foreground">
                      {formatDuration(track.duration)}
                    </span>
                  )}

                  {!isNativeAndroid && !isNativeDesktop && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTrack(track.id)}
                      aria-label={`Remove ${track.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 opacity-100 transition hover:bg-white/[0.08] hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
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
