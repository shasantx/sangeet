"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileAudio,
  FolderSearch,
  HardDrive,
  Laptop,
  ListPlus,
  Loader2,
  Music2,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  X
} from "lucide-react";
import {
  offlineMetaToTrack,
  scannedDeviceTrackToTrack,
  useOfflineStore
} from "@/store/offline-store";
import { usePlayerStore } from "@/store/player-store";
import { useToastStore } from "@/store/toast-store";
import { usePlatform } from "@/lib/platform";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SiteFooter } from "@/components/shell/site-footer";
import { TrackArtwork } from "@/components/music/track-artwork";
import { formatBytes } from "@/lib/offline-db";

interface ReleaseMeta {
  available: boolean;
  sizeBytes?: number;
}

function OfflinePageContent() {
  const { isWeb, isAndroid, isWindows } = usePlatform();

  const items = useOfflineStore((s) => s.items);
  const nativeItems = useOfflineStore((s) => s.nativeItems);
  const scannedTracks = useOfflineStore((s) => s.scannedTracks);
  const scanningDevice = useOfflineStore((s) => s.scanningDevice);
  const audioPermissionStatus = useOfflineStore((s) => s.audioPermissionStatus);
  const downloads = useOfflineStore((s) => s.downloads);
  const loading = useOfflineStore((s) => s.loading);
  const error = useOfflineStore((s) => s.error);
  const refresh = useOfflineStore((s) => s.refresh);
  const importLocalFiles = useOfflineStore((s) => s.importLocalFiles);
  const scanDeviceAudio = useOfflineStore((s) => s.scanDeviceAudio);
  const exportOfflineTrack = useOfflineStore((s) => s.exportOfflineTrack);
  const cancelDownload = useOfflineStore((s) => s.cancelDownload);
  const retryDownload = useOfflineStore((s) => s.retryDownload);
  const removeItem = useOfflineStore((s) => s.removeItem);
  const removeNativeItem = useOfflineStore((s) => s.removeNativeItem);
  const clearAll = useOfflineStore((s) => s.clearAll);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const showToast = useToastStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [apkMeta, setApkMeta] = useState<ReleaseMeta | null>(null);
  const [winMeta, setWinMeta] = useState<ReleaseMeta | null>(null);

  useEffect(() => {
    void refresh();
    if (!isWeb) return;
    let cancelled = false;
    fetch("/api/download/android?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setApkMeta(d);
      })
      .catch(() => {});
    fetch("/api/download/windows?meta=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setWinMeta(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refresh, isWeb]);

  const handleScanDevice = async () => {
    const res = await scanDeviceAudio();
    if (res.status === "permission_requested") {
      showToast("Please allow audio media permission to scan your music.");
    } else if (res.status === "scanned") {
      showToast(
        res.count > 0
          ? `Found ${res.count} music tracks (ringtones & recordings excluded)`
          : "No music files found on device",
        res.count > 0 ? "success" : "default"
      );
    } else if (res.status === "unsupported") {
      fileInputRef.current?.click();
    } else {
      showToast("Could not scan device music", "error");
    }
  };

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const { added, failed, skippedNonMusic } = await importLocalFiles(files);
    if (added > 0) {
      showToast(
        `Added ${added} music track${added === 1 ? "" : "s"}${skippedNonMusic > 0 ? ` (${skippedNonMusic} non-music skipped)` : ""}`,
        "success"
      );
    } else if (skippedNonMusic > 0) {
      showToast(
        `Skipped ${skippedNonMusic} ringtone/recording/short clip(s)`
      );
    }
    if (failed > 0) {
      showToast(`${failed} unsupported file(s) skipped`, "error");
    }
    e.target.value = "";
  };

  // Web experience: streaming & playlists only — promote native Android/Windows apps for downloads & local scan
  if (isWeb) {
    return (
      <div className="studio-enter mx-auto max-w-3xl overflow-x-hidden space-y-6 p-4 pb-12 sm:p-6">
        <div className="rounded-2xl border-b border-encore-hairline bg-encore-elevated p-6 shadow-[var(--shadow-elevated)] dark:shadow-[var(--shadow-elevated)] sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-encore-tinted px-3 py-1 text-xs font-semibold text-encore-accent">
            <HardDrive className="h-3.5 w-3.5" />
            Native Offline Features
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-encore-text sm:text-3xl">
            1-Click Offline Downloads &amp; Device Scan
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-encore-subdued">
            The Dhun Web Player is built for instant streaming, playlists,
            queue, and synced lyrics. Download the native Android or Windows app
            for instant 1-click music downloads and automatic local device music
            scanning (with ringtones &amp; recordings filtered out).
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/api/download/android"
              download="sangeet-android.apk"
              className="btn-cobalt flex min-h-[56px] items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold transition active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                <span>
                  <span className="block">Download Android APK</span>
                  <span className="block text-[11px] font-normal opacity-80">
                    {apkMeta?.available && apkMeta.sizeBytes
                      ? `Native Media3 • ${formatBytes(apkMeta.sizeBytes)}`
                      : "Fast 4-stream parallel downloads"}
                  </span>
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0" />
            </a>

            <a
              href="/api/download/windows"
              download="Dhun.exe"
              className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl bg-encore-elevated px-5 py-3.5 text-sm font-semibold text-encore-text shadow-[var(--shadow-elevated)] transition hover:bg-encore-elevated-highlight active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <Laptop
                  className="h-5 w-5 text-encore-accent"
                  strokeWidth={1.8}
                />
                <span>
                  <span className="block">Download Windows App</span>
                  <span className="block text-[11px] font-normal text-encore-subdued">
                    {winMeta?.available && winMeta.sizeBytes
                      ? `Rust Tauri v2 • ${formatBytes(winMeta.sizeBytes)}`
                      : "Fast desktop downloads & local scan"}
                  </span>
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-encore-accent" />
            </a>
          </div>
        </div>

        <SiteFooter compact />
      </div>
    );
  }

  // Native Android & Windows experience: 1-click downloads + smart local device scan (ZERO web APK popups)
  const activeDownloadList = Object.values(downloads);
  const idbTracks = items.map(offlineMetaToTrack);
  const nativeTracks = nativeItems.map((e) => e.track);
  const allOfflineTracks = [...nativeTracks, ...idbTracks];
  const deviceTracks = scannedTracks.map(scannedDeviceTrackToTrack);
  const totalStoredBytes =
    items.reduce((sum, i) => sum + i.sizeBytes, 0) +
    nativeItems.reduce((sum, i) => sum + (i.sizeBytes || 0), 0);

  return (
    <div className="studio-enter mx-auto max-w-4xl overflow-x-hidden space-y-6 p-4 pb-12 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-encore-text sm:text-3xl">
            Downloads &amp; Device Music
          </h1>
          <p className="mt-1 text-sm text-encore-subdued">
            {isAndroid
              ? "1-click offline music & smart Android device audio scanner"
              : isWindows
                ? "1-click offline music & Windows local Music scanner"
                : "Offline & local audio"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
            multiple
            onChange={handleLocalUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => void handleScanDevice()}
            disabled={scanningDevice}
            className="btn-cobalt inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold transition active:scale-95 disabled:opacity-60"
          >
            {scanningDevice ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderSearch className="h-4 w-4" strokeWidth={1.8} />
            )}
            {scanningDevice ? "Scanning..." : "Scan Device Music"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-encore-elevated px-4 text-xs font-medium text-encore-text transition hover:bg-encore-elevated-highlight"
          >
            <FileAudio className="h-4 w-4 text-encore-accent" strokeWidth={1.6} />
            Import files
          </button>

          {allOfflineTracks.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-encore-negative/12 px-4 text-xs font-medium text-encore-negative transition hover:bg-encore-negative/20"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Smart Local Scan Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-encore-elevated/75 p-4 text-xs shadow-[var(--shadow-elevated)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-encore-tinted text-encore-accent">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="font-semibold text-encore-text">
              Smart Music Filter Active
            </p>
            <p className="mt-0.5 leading-5 text-encore-subdued">
              Automatically excludes ringtones, alarms, notifications, call
              recordings, WhatsApp voice notes, and clips under 15 seconds.
              {audioPermissionStatus === "denied" && (
                <span className="ml-1 font-medium text-encore-negative">
                  Audio media permission was denied — enable it in system
                  settings to scan device audio.
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="font-mono text-xs tabular-nums text-encore-accent">
          {allOfflineTracks.length} offline • {formatBytes(totalStoredBytes)}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-encore-negative/12 px-4 py-3 text-xs text-encore-negative"
        >
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}

      {/* Active Fast Transfers */}
      {activeDownloadList.length > 0 && (
        <section className="space-y-2.5 rounded-2xl bg-encore-elevated/75 p-4 shadow-[var(--shadow-elevated)]">
          <h2 className="text-xs font-semibold text-encore-accent">
            Active transfers ({activeDownloadList.length})
          </h2>
          {activeDownloadList.map((dl) => {
            const pct = Math.min(100, Math.max(0, Math.round(dl.progress)));
            const hasReceived =
              typeof dl.receivedBytes === "number" && dl.receivedBytes > 0;
            const hasTotal =
              typeof dl.totalBytes === "number" && dl.totalBytes > 0;

            return (
              <div
                key={dl.track.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-encore-base p-3 shadow-[var(--shadow-elevated)]"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <TrackArtwork
                    src={dl.track.thumbnail}
                    trackId={dl.track.id}
                    alt={dl.track.title}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-encore-text">
                    {dl.track.title}
                  </p>
                  <p className="truncate text-[11px] text-encore-subdued">
                    {dl.track.artist}
                  </p>
                  {dl.status === "downloading" ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-encore-rail">
                          <div
                            className="h-full rounded-full bg-encore-accent transition-[width] duration-200"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-encore-accent">
                          {pct}%
                        </span>
                      </div>
                      {(hasReceived || hasTotal) && (
                        <p className="font-mono text-[11px] tabular-nums text-encore-muted">
                          {hasReceived ? formatBytes(dl.receivedBytes!) : "0 B"}
                          {hasTotal ? ` / ${formatBytes(dl.totalBytes!)}` : ""}
                        </p>
                      )}
                    </div>
                  ) : dl.status === "completed" ? (
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Saved offline
                    </span>
                  ) : (
                    <p className="mt-1 text-xs text-encore-negative">
                      {dl.error || "Transfer failed"}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {dl.status === "error" && (
                    <button
                      type="button"
                      onClick={() => void retryDownload(dl.track.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-encore-elevated text-encore-text transition hover:bg-encore-elevated-highlight"
                      aria-label="Retry download"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cancelDownload(dl.track.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-encore-elevated text-encore-subdued transition hover:bg-encore-elevated-highlight hover:text-encore-text"
                    aria-label="Cancel download"
                  >
                    <X className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Scanned Device Music */}
      {deviceTracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-encore-text">
              On This Device{" "}
              <span className="font-mono text-xs tabular-nums text-encore-muted">
                ({deviceTracks.length})
              </span>
            </h2>
            <button
              type="button"
              onClick={() => playTrack(deviceTracks[0], deviceTracks)}
              className="btn-cobalt inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play all
            </button>
          </div>
          <div className="space-y-1.5">
            {deviceTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-encore-elevated/75 p-2.5 transition-colors hover:bg-encore-elevated-highlight"
              >
                <button
                  type="button"
                  onClick={() => playTrack(track, deviceTracks)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-encore-tinted text-encore-accent">
                    <Music2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-encore-text">
                      {track.title}
                    </p>
                    <p className="truncate font-mono text-xs text-encore-subdued">
                      {track.artist} • {track.durationText}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToQueue(track);
                    showToast("Added to queue", "success");
                  }}
                  aria-label={`Add ${track.title} to queue`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base hover:text-encore-text"
                >
                  <ListPlus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Saved Offline Library */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-encore-text">
            Downloaded Offline Music{" "}
            <span className="font-mono text-xs tabular-nums text-encore-muted">
              ({allOfflineTracks.length})
            </span>
          </h2>
          {allOfflineTracks.length > 0 && (
            <button
              type="button"
              onClick={() => playTrack(allOfflineTracks[0], allOfflineTracks)}
              className="btn-cobalt inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play all
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-encore-elevated/75"
              />
            ))}
          </div>
        ) : allOfflineTracks.length === 0 ? (
          <div className="rounded-2xl bg-encore-elevated/75 p-8 text-center">
            <p className="text-sm font-semibold text-encore-text">
              No downloaded songs yet
            </p>
            <p className="mt-1 text-xs text-encore-subdued">
              Tap Download on any song for instant 1-click offline saving, or
              tap Scan Device Music above to import local music.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {nativeItems.map((entry) => (
              <div
                key={`native-${entry.id}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-encore-elevated/75 p-2.5 transition-colors hover:bg-encore-elevated-highlight"
              >
                <button
                  type="button"
                  onClick={() => playTrack(entry.track, allOfflineTracks)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <TrackArtwork
                      src={entry.track.thumbnail}
                      trackId={entry.track.id}
                      alt={entry.track.title}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-encore-text">
                      {entry.track.title}
                    </p>
                    <p className="truncate font-mono text-xs tabular-nums text-encore-subdued">
                      {entry.track.artist} • Offline •{" "}
                      {formatBytes(entry.sizeBytes)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await exportOfflineTrack(entry.id);
                      showToast(
                        ok
                          ? `Saved "${entry.track.title}" to Downloads`
                          : "Export failed",
                        ok ? "success" : "error"
                      );
                    }}
                    aria-label={`Export ${entry.track.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-encore-accent hover:bg-encore-base"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeNativeItem(entry.id);
                      showToast(`Removed "${entry.track.title}"`);
                    }}
                    aria-label={`Remove ${entry.track.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-base hover:text-encore-negative"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {items.map((item, idx) => {
              const track = idbTracks[idx];
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-encore-elevated/75 p-2.5 transition-colors duration-150 hover:bg-encore-elevated-highlight"
                >
                  <button
                    type="button"
                    onClick={() => playTrack(track, allOfflineTracks)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                      <TrackArtwork
                        src={item.thumbnail}
                        trackId={item.id}
                        alt={item.title}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-encore-text">
                        {item.title}
                      </p>
                      <p className="truncate font-mono text-xs tabular-nums text-encore-subdued">
                        {item.artist} • {item.sourceLabel} •{" "}
                        {formatBytes(item.sizeBytes)}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await exportOfflineTrack(item.id);
                        showToast(
                          ok
                            ? `Saved "${item.title}" to device`
                            : "Could not export audio file",
                          ok ? "success" : "error"
                        );
                      }}
                      title="Save audio file to device"
                      aria-label={`Save ${item.title} to device`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-encore-accent transition-colors hover:bg-encore-base"
                    >
                      <Download className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addToQueue(track);
                        showToast("Added to queue", "success");
                      }}
                      aria-label={`Add ${item.title} to queue`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued transition-colors hover:bg-encore-base hover:text-encore-text"
                    >
                      <ListPlus className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeItem(item.id);
                        showToast(`Removed "${item.title}"`);
                      }}
                      aria-label={`Remove ${item.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-encore-subdued transition-colors hover:bg-encore-base hover:text-encore-negative"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter compact />

      <ConfirmDialog
        open={confirmClearAll}
        title="Clear all offline audio?"
        description={`This will permanently delete all ${allOfflineTracks.length} saved tracks (${formatBytes(totalStoredBytes)}) from offline storage.`}
        confirmLabel="Clear all"
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={async () => {
          setConfirmClearAll(false);
          await clearAll();
          showToast("Cleared offline audio storage");
        }}
      />
    </div>
  );
}

export default function OfflinePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-encore-subdued">
          Loading offline library
        </div>
      }
    >
      <OfflinePageContent />
    </Suspense>
  );
}
