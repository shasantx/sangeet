"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileAudio,
  FolderSearch,
  Moon,
  Play,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  User,
  Clock3
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { EQ_LABELS, EQ_PRESETS, useEQStore } from "@/store/eq-store";
import { useAudioFormat } from "@/store/audio-format-store";
import { getCurrentMoodProfile, useMoodLearning } from "@/store/listening-store";
import { SLOT_LABEL, describeProfile } from "@/lib/mood-engine";
import {
  offlineMetaToTrack,
  useOfflineStore
} from "@/store/offline-store";
import { useToastStore } from "@/store/toast-store";
import { usePlatform } from "@/lib/platform";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SiteFooter } from "@/components/shell/site-footer";
import { TrackArtwork } from "@/components/music/track-artwork";
import { clearAllOfflineAudio } from "@/lib/offline-db";
import { cn } from "@/lib/utils";

const SANGEET_STORAGE_KEYS = [
  "sangeet-v2-player",
  "sangeet-v2-library",
  "sangeet-v2-ui",
  "sangeet-v2-auth",
  "sangeet-v2-eq",
  "sangeet-v2-audio-format",
  "sangeet-v2-listening",
  "sangeet-v2-lyrics-cache",
  "sangeet-v2-native-offline"
];

export default function SettingsPage() {
  const { isNative } = usePlatform();
  const user = useAuthStore((s) => s.user);
  const enterAsLocal = useAuthStore((s) => s.enterAsLocal);

  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [audioFormat, setAudioFormat] = useAudioFormat();
  const moodLearning = useMoodLearning();
  const moodNow = moodLearning.enabled ? getCurrentMoodProfile() : null;
  const openDownloadAppModal = useUIStore((s) => s.openDownloadAppModal);

  const eqEnabled = useEQStore((s) => s.enabled);
  const eqPreset = useEQStore((s) => s.preset);
  const eqGains = useEQStore((s) => s.gains);
  const setEqEnabled = useEQStore((s) => s.setEnabled);
  const applyEqPreset = useEQStore((s) => s.applyPreset);
  const setEqBandGain = useEQStore((s) => s.setBandGain);

  const autoplayRadio = usePlayerStore((s) => s.autoplayRadio);
  const setAutoplayRadio = usePlayerStore((s) => s.setAutoplayRadio);
  const sponsorBlockEnabled = usePlayerStore((s) => s.sponsorBlockEnabled);
  const setSponsorBlockEnabled = usePlayerStore(
    (s) => s.setSponsorBlockEnabled
  );
  const playTrack = usePlayerStore((s) => s.playTrack);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const importLibraryJson = useLibraryStore((s) => s.importLibraryJson);
  const showToast = useToastStore((s) => s.showToast);

  const offlineItems = useOfflineStore((s) => s.items);
  const refreshOffline = useOfflineStore((s) => s.refresh);
  const importLocalFiles = useOfflineStore((s) => s.importLocalFiles);

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importJsonRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refreshOffline();
  }, [refreshOffline]);

  const localStoredTracks = offlineItems
    .filter((i) => i.kind === "local")
    .map(offlineMetaToTrack);

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const res = importLibraryJson(parsed);
      showToast(
        `Imported ${res.addedLikes} liked songs & ${res.addedPlaylists} playlists`,
        "success"
      );
      setStatusMsg(
        `Imported ${res.addedLikes} liked songs and ${res.addedPlaylists} playlists.`
      );
    } catch {
      showToast("Invalid Dhun JSON backup file", "error");
    }
    e.target.value = "";
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    enterAsLocal(displayName);
    setStatusMsg("Profile name updated.");
    showToast("Profile name updated", "success");
  };

  const handleLocalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const { added, failed, skippedNonMusic } = await importLocalFiles(files);
    if (added > 0) {
      const msg = `Saved ${added} local audio file(s) to Offline Library${skippedNonMusic > 0 ? ` (${skippedNonMusic} ringtone/recording skipped)` : ""}.`;
      setStatusMsg(msg);
      showToast(msg, "success");
    }
    if (failed > 0) {
      showToast(`${failed} file(s) skipped`, "error");
    }
    e.target.value = "";
  };

  const handleExportLibrary = () => {
    const payload = {
      app: "Sangeet v2.3",
      exportedAt: new Date().toISOString(),
      likedTracks,
      playlists
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sangeet-library-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg("Library exported as JSON.");
    showToast("Library backup downloaded", "success");
  };

  return (
    <div className="studio-enter mx-auto max-w-3xl space-y-6 overflow-x-hidden p-4 pb-12 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-encore-text sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-encore-subdued">
          Manage appearance, 5-band equalizer, playback preferences, and backups
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-2xl bg-encore-tinted px-4 py-2.5 text-xs font-medium text-encore-accent">
          {statusMsg}
        </div>
      )}

      {/* Appearance: Dark & Light Zentra Cobalt Theme */}
      <section className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2.5">
          {theme === "dark" ? (
            <Moon className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
          ) : (
            <Sun className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
          )}
          <div>
            <h2 className="text-base font-semibold text-encore-text">
              Appearance
            </h2>
            <p className="text-xs text-encore-subdued">
              Choose a dark or light theme
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              showToast("Dark theme on", "success");
            }}
            aria-pressed={theme === "dark"}
            className={cn(
              "flex min-h-[72px] items-center gap-3 rounded-2xl p-3.5 text-left transition-all duration-150",
              theme === "dark"
                ? "bg-encore-tinted ring-2 ring-[#e2363e]/50"
                : "bg-encore-base hover:bg-encore-elevated-highlight"
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0d0c0b] text-[#e2363e]">
              <Moon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-encore-text">Dark</p>
              <p className="text-[11px] text-encore-subdued">
                Charcoal &amp; red
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("light");
              showToast("Light theme on", "success");
            }}
            aria-pressed={theme === "light"}
            className={cn(
              "flex min-h-[72px] items-center gap-3 rounded-2xl p-3.5 text-left transition-all duration-150",
              theme === "light"
                ? "bg-encore-tinted ring-2 ring-[#e2363e]/50"
                : "bg-encore-base hover:bg-encore-elevated-highlight"
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f4f1] text-[#c41e2e]">
              <Sun className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-encore-text">Light</p>
              <p className="text-[11px] text-encore-subdued">
                Paper &amp; red
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Audio format: AAC (source-first, else on-device streaming transcode) or Original */}
      <section className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2.5">
          <FileAudio className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
          <div>
            <h2 className="text-base font-semibold text-encore-text">
              Audio format
            </h2>
            <p className="text-xs text-encore-subdued">
              Saved for {user?.name ? user.name : "this profile"} · applies from the next song
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "aac",
                title: "AAC",
                sub: "Uses the source's own AAC when available, otherwise converts on your device while streaming"
              },
              {
                value: "original",
                title: "Original",
                sub: "Plays exactly what the source sends (MP3, Opus, AAC…)"
              }
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setAudioFormat(opt.value);
                showToast(
                  opt.value === "aac"
                    ? "AAC audio enabled"
                    : "Original audio format enabled",
                  "success"
                );
              }}
              aria-pressed={audioFormat === opt.value}
              className={cn(
                "flex min-h-[72px] flex-col justify-center rounded-2xl p-3.5 text-left transition-all duration-150",
                audioFormat === opt.value
                  ? "bg-encore-tinted ring-2 ring-[#e2363e]/50"
                  : "bg-encore-base hover:bg-encore-elevated-highlight"
              )}
            >
              <p className="text-sm font-semibold text-encore-text">
                {opt.title}
                {opt.value === "aac" && (
                  <span className="ml-2 rounded-full bg-encore-tinted px-2 py-0.5 text-[10px] font-semibold text-encore-mint">
                    Default
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-encore-subdued">{opt.sub}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-encore-muted">
          Streams load in small chunks and only ~30 seconds ahead to save data.
          YouTube on the web plays inside YouTube&apos;s own player, so its format can&apos;t be changed there.
        </p>
      </section>

      {/* Mood picks: on-device time-of-day listening model */}
      <section className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock3 className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
            <div>
              <h2 className="text-base font-semibold text-encore-text">Mood picks</h2>
              <p className="text-xs text-encore-subdued">
                Learns what you like at different times of day · stays on this device
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={moodLearning.enabled}
            aria-label="Learn from my listening"
            onClick={() => {
              moodLearning.setEnabled(!moodLearning.enabled);
              showToast(moodLearning.enabled ? "Mood learning paused" : "Mood learning on", "success");
            }}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150",
              moodLearning.enabled ? "bg-encore-accent" : "bg-encore-highlight"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-150",
                moodLearning.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        <div className="rounded-xl bg-encore-base p-3.5 text-sm">
          {moodNow ? (
            <>
              <p className="font-medium text-encore-text">
                Right now: {SLOT_LABEL[moodNow.slot]}
                {describeProfile(moodNow) ? ` · ${describeProfile(moodNow)}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-encore-subdued">
                {moodLearning.count} plays remembered for {user?.name ? user.name : "this profile"}
                {moodNow.evidence < 3 ? " · using starter picks until you've played a few more songs" : ""}
              </p>
            </>
          ) : (
            <p className="text-encore-subdued">
              Paused. Home shows no time-of-day picks and autoplay keeps the normal radio order.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={moodLearning.count === 0}
          onClick={() => {
            moodLearning.clear();
            showToast("Listening history cleared", "success");
          }}
          className="rounded-full bg-encore-base px-4 py-2 text-xs font-semibold text-encore-text transition-colors hover:bg-encore-elevated-highlight disabled:opacity-40"
        >
          Clear listening history
        </button>
      </section>

      {/* 5-Band Graphic Equalizer */}
      <section
        id="equalizer"
        className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal
              className="h-5 w-5 text-encore-accent"
              strokeWidth={1.6}
            />
            <div>
              <h2 className="text-base font-semibold text-encore-text">
                5-Band Equalizer
              </h2>
              <p className="text-xs text-encore-subdued">
                Real-time Web Audio EQ presets for offline &amp; direct streams
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEqEnabled(!eqEnabled)}
            className={cn(
              "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
              eqEnabled ? "bg-encore-accent" : "bg-encore-rail"
            )}
            aria-label="Toggle Equalizer"
            aria-pressed={eqEnabled}
          >
            <span
              className={cn(
                "block h-5 w-5 rounded-full bg-white shadow transition-transform",
                eqEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Presets */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          {Object.keys(EQ_PRESETS).map((presetName) => (
            <button
              key={presetName}
              type="button"
              onClick={() => applyEqPreset(presetName)}
              className={cn(
                "min-h-[40px] shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
                eqPreset === presetName
                  ? "btn-cobalt"
                  : "bg-encore-base text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
              )}
            >
              {presetName}
            </button>
          ))}
        </div>

        {/* 5 Band Sliders */}
        <div
          className={cn(
            "grid grid-cols-5 gap-2 rounded-xl bg-encore-base p-4 transition-opacity",
            !eqEnabled && "opacity-45"
          )}
        >
          {EQ_LABELS.map((label, idx) => {
            const gain = eqGains[idx] ?? 0;
            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <span className="font-mono text-[11px] font-semibold tabular-nums text-encore-accent">
                  {gain > 0 ? `+${gain}` : gain}dB
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  disabled={!eqEnabled}
                  value={gain}
                  onChange={(e) => setEqBandGain(idx, Number(e.target.value))}
                  aria-label={`${label} band gain`}
                  className="h-24 w-2 cursor-pointer accent-encore-accent [direction:rtl] [writing-mode:vertical-lr]"
                />
                <span className="font-mono text-[11px] text-encore-muted">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Profile */}
      <section className="rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <User className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
            <h2 className="text-base font-semibold text-encore-text">
              Account &amp; profile
            </h2>
          </div>
          <Link
            href="/auth"
            className="text-xs font-semibold text-encore-accent hover:underline"
          >
            Switch account
          </Link>
        </div>
        <form onSubmit={handleSaveProfile} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="h-11 w-full min-w-0 rounded-full bg-encore-base px-4 text-sm text-encore-text outline-none placeholder:text-encore-muted focus:ring-2 focus:ring-[#e2363e]/50 sm:w-auto sm:min-w-[200px] sm:flex-1"
          />
          <button
            type="submit"
            className="btn-cobalt h-11 rounded-full px-5 text-xs font-semibold transition active:scale-95"
          >
            Save name
          </button>
        </form>
      </section>

      {/* Playback Preferences (Sleep timer lives cleanly inside the Player UI) */}
      <section className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2.5">
          <Radio className="h-5 w-5 text-encore-accent" strokeWidth={1.6} />
          <h2 className="text-base font-semibold text-encore-text">Playback</h2>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-encore-text">
              Autoplay radio
            </p>
            <p className="text-xs text-encore-subdued">
              Automatically queue related songs when your queue runs low
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoplayRadio(!autoplayRadio)}
            className={cn(
              "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
              autoplayRadio ? "bg-encore-accent" : "bg-encore-rail"
            )}
            aria-label="Toggle Autoplay Radio"
          >
            <span
              className={cn(
                "block h-5 w-5 rounded-full bg-white shadow transition-transform",
                autoplayRadio ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="h-px bg-encore-hairline" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-encore-text">
              SponsorBlock auto-skip
            </p>
            <p className="text-xs text-encore-subdued">
              Automatically skip non-music intros, outros, and talking skits
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSponsorBlockEnabled(!sponsorBlockEnabled)}
            className={cn(
              "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
              sponsorBlockEnabled ? "bg-encore-accent" : "bg-encore-rail"
            )}
            aria-label="Toggle SponsorBlock"
          >
            <span
              className={cn(
                "block h-5 w-5 rounded-full bg-white shadow transition-transform",
                sponsorBlockEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </section>

      {/* Local Audio & Device Scan (Native Android/Windows only; Web promotes native app) */}
      {isNative ? (
        <section className="space-y-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <FileAudio
                className="h-5 w-5 text-encore-accent"
                strokeWidth={1.6}
              />
              <div>
                <h2 className="text-base font-semibold text-encore-text">
                  Local device music
                </h2>
                <p className="text-xs text-encore-subdued">
                  Scan device audio (skipping ringtones &amp; recordings) or
                  import MP3, FLAC, WAV files
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
              multiple
              onChange={handleLocalFiles}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/offline"
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-encore-base px-4 text-xs font-semibold text-encore-text transition-colors hover:bg-encore-elevated-highlight"
              >
                <FolderSearch className="h-3.5 w-3.5 text-encore-accent" />
                Scan device
              </Link>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-cobalt h-11 rounded-full px-4 text-xs font-semibold"
              >
                Import files
              </button>
            </div>
          </div>

          {localStoredTracks.length > 0 && (
            <div className="space-y-1 pt-2">
              {localStoredTracks.slice(0, 6).map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playTrack(track, localStoredTracks)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-encore-elevated-highlight"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TrackArtwork
                      src={track.thumbnail}
                      trackId={track.id}
                      alt={track.title}
                      className="h-8 w-8 shrink-0 rounded-[6px]"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-encore-text">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-encore-subdued">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                  <Play className="h-4 w-4 shrink-0 text-encore-accent" />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-encore-tinted p-5 shadow-[var(--shadow-elevated)]">
          <div className="flex items-center gap-3">
            <FolderSearch
              className="h-5 w-5 text-encore-accent"
              strokeWidth={1.7}
            />
            <div>
              <p className="text-sm font-semibold text-encore-text">
                1-Click Downloads &amp; Device Music Scanner
              </p>
              <p className="text-xs text-encore-subdued">
                Available in the native Dhun Android APK and Windows Rust app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openDownloadAppModal()}
            className="btn-cobalt inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            Get native app
          </button>
        </section>
      )}

      {/* Library Backup & Reset */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-encore-elevated p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck
            className="h-5 w-5 text-encore-accent"
            strokeWidth={1.6}
          />
          <div>
            <p className="text-sm font-semibold text-encore-text">
              Library backup &amp; data
            </p>
            <p className="font-mono text-xs text-encore-subdued">
              {likedTracks.length} liked • {playlists.length} playlists • MIT
              License
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importJsonRef}
            type="file"
            accept="application/json"
            onChange={handleImportJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importJsonRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-encore-base px-4 text-xs font-semibold text-encore-text transition-colors hover:bg-encore-elevated-highlight"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON
          </button>
          <button
            type="button"
            onClick={handleExportLibrary}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-encore-base px-4 text-xs font-semibold text-encore-text transition-colors hover:bg-encore-elevated-highlight"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#f87171]/15 px-4 text-xs font-semibold text-encore-negative transition-colors hover:bg-[#f87171]/25"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset data
          </button>
        </div>
      </section>

      <SiteFooter compact />

      <ConfirmDialog
        open={confirmReset}
        title="Reset all Dhun data?"
        description="This will remove your liked songs, playlists, settings, cached lyrics, and offline audio from this browser. Export a JSON backup first if you want to keep your library."
        confirmLabel="Reset everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          for (const key of SANGEET_STORAGE_KEYS) {
            localStorage.removeItem(key);
          }
          await clearAllOfflineAudio().catch(() => {});
          window.location.href = "/";
        }}
      />
    </div>
  );
}
