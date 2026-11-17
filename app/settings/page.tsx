"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  Clock3,
  Database,
  Download,
  Heart,
  Info,
  Keyboard,
  Laptop,
  ListMusic,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  SunMedium,
  Trash2,
  Users,
} from "lucide-react";
import { isNativeOfflineSupported } from "@/lib/offline-audio";
import { cn, formatCount } from "@/lib/utils";
import type { AccentPreference, ThemePreference } from "@/store/app-store";
import { useAppStore } from "@/store/app-store";
import { albums, tracks } from "@/lib/catalog";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { LocalAudioLibrary } from "@/components/settings/local-audio-library";
import { toast } from "@/store/ui-store";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const themes: {
  id: ThemePreference;
  label: string;
  tag: string;
  description: string;
  background: string;
  sidebar: string;
  surface: string;
  elevated: string;
  accent: string;
  icon: typeof Moon;
}[] = [
  {
    id: "dark",
    label: "Obsidian Studio",
    tag: "Studio Default",
    description: "Neutral graphite noir engineered for long listening sessions.",
    background: "#09090B",
    sidebar: "#0E0E11",
    surface: "#16161A",
    elevated: "#202026",
    accent: "#1ED760",
    icon: Moon,
  },
  {
    id: "midnight",
    label: "Midnight Slate",
    tag: "Cool Focus",
    description: "Deep ink sapphire with crisp slate layers and cool contrast.",
    background: "#070B14",
    sidebar: "#0B1120",
    surface: "#111A2E",
    elevated: "#18243E",
    accent: "#3898FF",
    icon: AudioLines,
  },
  {
    id: "dusk",
    label: "Warm Espresso",
    tag: "Late Night",
    description: "Refined roasted charcoal with warm copper studio depth.",
    background: "#0E0B09",
    sidebar: "#140F0C",
    surface: "#1F1814",
    elevated: "#2A211C",
    accent: "#E58E49",
    icon: SunMedium,
  },
  {
    id: "emerald",
    label: "Evergreen Nocturne",
    tag: "Botanical",
    description: "Deep pine slate balanced with crisp jade highlights.",
    background: "#060D0A",
    sidebar: "#0A1410",
    surface: "#11221B",
    elevated: "#182F25",
    accent: "#20E070",
    icon: AudioLines,
  },
  {
    id: "aurora",
    label: "Velvet Indigo",
    tag: "Editorial",
    description: "Editorial plum indigo with muted violet studio framing.",
    background: "#0A0812",
    sidebar: "#100C1C",
    surface: "#1A142E",
    elevated: "#251D40",
    accent: "#A874FF",
    icon: Palette,
  },
  {
    id: "crimson",
    label: "Noir Crimson",
    tag: "Velvet Noir",
    description: "Sophisticated burgundy noir with restrained rose accents.",
    background: "#10080B",
    sidebar: "#160B0E",
    surface: "#241217",
    elevated: "#321A21",
    accent: "#F4516C",
    icon: Heart,
  },
];

const accents: {
  id: AccentPreference;
  label: string;
  mood: string;
  primaryHex: string;
  secondaryHex: string;
}[] = [
  {
    id: "green",
    label: "Sangeet Green",
    mood: "Default",
    primaryHex: "#1ED760",
    secondaryHex: "#4CE584",
  },
  {
    id: "cyan",
    label: "Aurora Cyan",
    mood: "Crisp Ice",
    primaryHex: "#1BC6DB",
    secondaryHex: "#4ED8EB",
  },
  {
    id: "blue",
    label: "Cobalt Blue",
    mood: "Electric",
    primaryHex: "#3D95F5",
    secondaryHex: "#62B8FA",
  },
  {
    id: "violet",
    label: "Electric Violet",
    mood: "Studio",
    primaryHex: "#9D66F2",
    secondaryHex: "#BC74F2",
  },
  {
    id: "red",
    label: "Crimson Red",
    mood: "Signal",
    primaryHex: "#E73D38",
    secondaryHex: "#F05E59",
  },
  {
    id: "yellow",
    label: "Amber Gold",
    mood: "Warm",
    primaryHex: "#F7B911",
    secondaryHex: "#F7AB3B",
  },
];

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3.5 p-4 sm:p-5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <label className="block cursor-pointer text-[13px] font-medium">{title}</label>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const accent = useAppStore((state) => state.accent);
  const setAccent = useAppStore((state) => state.setAccent);
  const autoplay = useAppStore((state) => state.autoplay);
  const setAutoplay = useAppStore((state) => state.setAutoplay);
  const shortcuts = useAppStore((state) => state.shortcuts);
  const setShortcuts = useAppStore((state) => state.setShortcuts);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const signOut = useAppStore((state) => state.signOut);
  const resetPlayer = usePlayerStore((state) => state.resetPlayer);

  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const playlists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const clearHistory = useLibraryStore((state) => state.clearHistory);
  const resetLibrary = useLibraryStore((state) => state.resetLibrary);

  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [nativeOffline, setNativeOffline] = useState(false);
  const [activeTab, setActiveTab] = useState("playback");

  useEffect(() => {
    setNativeOffline(isNativeOfflineSupported());
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab && ["playback", "appearance", "data", "about"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  const chooseTheme = (next: ThemePreference) => {
    if (next === theme) return;
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    const selected = themes.find((item) => item.id === next);
    toast.success("Theme updated", selected?.label ?? next);
  };

  const chooseAccent = (next: AccentPreference) => {
    if (next === accent) return;
    setAccent(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.accent = next;
    }
    const selected = accents.find((item) => item.id === next);
    toast.success("Accent updated", selected?.label ?? next);
  };

  const activeTheme = themes.find((item) => item.id === theme) ?? themes[0];
  const activeAccent = accents.find((item) => item.id === accent) ?? accents[0];

  const handleReset = () => {
    resetLibrary();
    toast.success("Local library reset", "Likes, playlists and history are back to their starting point.");
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    signOut();
    resetPlayer();
    toast.info("Signed out of Sangeet", "Your local library is still saved on this device.");
    router.replace("/welcome");
  };

  const dataStats = [
    { label: "Liked songs", value: likedTrackIds.length, icon: Heart },
    { label: "Playlists", value: playlists.length, icon: ListMusic },
    { label: "Following", value: followedArtistIds.length, icon: Users },
    { label: "History", value: recentlyPlayed.length, icon: Clock3 },
  ];

  return (
    <div className="page-container max-w-[1120px]">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Make it yours</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            Settings
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Tune how Sangeet looks and behaves. Every preference is stored locally in this browser.
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-elevated hover:text-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          View profile
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="hide-scrollbar max-w-full overflow-x-auto">
          <TabsTrigger value="playback">
            <AudioLines className="mr-1.5 h-3.5 w-3.5" />
            Playback
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-1.5 h-3.5 w-3.5" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Data
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="mr-1.5 h-3.5 w-3.5" />
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playback">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              <div className="p-4 pb-3 sm:px-5">
                <p className="eyebrow">Playback preferences</p>
              </div>
              <ToggleRow
                icon={<Play className="h-4 w-4" />}
                title="Autoplay after the queue ends"
                description="Keep the room going with related tracks when the current queue finishes."
                checked={autoplay}
                onCheckedChange={setAutoplay}
              />
              <ToggleRow
                icon={<Keyboard className="h-4 w-4" />}
                title="Keyboard shortcuts"
                description="Use Space, arrows, M, N and P to control playback when you are not typing."
                checked={shortcuts}
                onCheckedChange={setShortcuts}
              />
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">Now playing panel</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Show the persistent now playing and artist panel on wide screens.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 text-[10px] text-muted-foreground">
                      Desktop only
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                      {rightPanelOpen ? "Visible" : "Hidden"}
                    </div>
                  </div>
                  <Switch
                    checked={rightPanelOpen}
                    onCheckedChange={setRightPanelOpen}
                    aria-label="Show now playing panel"
                    className="ml-auto mt-0.5 shrink-0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-3.5 w-3.5 text-primary" />
                  <p className="eyebrow">Shortcuts</p>
                </div>
                <div className="mt-4 space-y-2.5 text-[11px]">
                  {[
                    ["Space", "Play / pause"],
                    ["→ / ←", "Seek 5 seconds"],
                    ["N / P", "Next / previous"],
                    ["M", "Mute / unmute"],
                    ["⌘ K", "Open search"],
                  ].map(([key, action]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{action}</span>
                      <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-sans text-[9px] text-muted-foreground">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
                {!shortcuts && (
                  <p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground/70">
                    Shortcuts are currently turned off.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="eyebrow">Audio</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Source</span>
                  <span>MP3 audio</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Format</span>
                  <span>MP3</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Tracks available</span>
                  <span>{tracks.length} tracks</span>
                </div>
                <p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground/70">
                  Sangeet’s catalog includes bundled audio and linked listening sources. No music is
                  downloaded or re-hosted from third-party services.
                </p>
              </div>
            </div>
          </div>

          <section
            aria-label="Apps and Downloads"
            className="mt-4 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <p className="eyebrow text-primary">Apps &amp; Downloads</p>
                  {nativeOffline && (
                    <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Native offline active
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 font-display text-lg font-bold tracking-tight text-foreground">
                  Sangeet for Windows &amp; Android
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Offline listening and local audio downloads are built into the Android APK and Windows .exe apps. Download directly from Sangeet below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="/api/download/windows"
                  download="Sangeet.exe"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-elevated/80 active:scale-95"
                >
                  <Laptop className="h-4 w-4 text-primary" />
                  <span>Windows .exe</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <a
                  href="/api/download/android"
                  download="sangeet-android.apk"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 active:scale-95"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Android APK</span>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </section>

          <LocalAudioLibrary />
        </TabsContent>

        <TabsContent value="appearance">
          <div className="space-y-4">
            {/* Live Theme Studio Preview Banner */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow text-primary">Live studio preview</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                      {activeTheme.label}
                    </h2>
                    <span className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {activeTheme.tag}
                    </span>
                  </div>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 text-[11px] font-medium text-foreground">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${activeAccent.primaryHex} 50%, ${activeAccent.secondaryHex} 50%)`,
                    }}
                  />
                  <span>{activeAccent.label}</span>
                  <span className="text-muted-foreground">· {activeAccent.mood}</span>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex min-h-[120px]">
                  <div className="hidden w-[132px] shrink-0 flex-col justify-between border-r border-border bg-sidebar p-3 sm:flex">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="font-display text-[11px] font-semibold tracking-wide text-foreground">
                        Sangeet
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 rounded-md bg-elevated px-2 py-1 text-[10px] font-medium text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>Home</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span>Discover</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span>Library</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between bg-background">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground">
                        <Search className="h-2.5 w-2.5" />
                        <span>Search tracks, artists…</span>
                      </div>
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">
                        Live token preview
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
                          <AudioLines className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            Nocturne in Obsidian
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {activeTheme.label} · {activeAccent.label}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10.5px] font-semibold text-primary-foreground">
                        <Play className="h-2.5 w-2.5 fill-current" />
                        Play
                      </span>
                    </div>

                    <div className="border-t border-border bg-elevated px-3.5 py-2">
                      <div className="flex items-center justify-between gap-3 text-[9.5px] text-muted-foreground">
                        <span>01:48</span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-background">
                          <div className="h-full w-[62%] rounded-full bg-primary" />
                        </div>
                        <span>03:12</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Studio Theme Picker Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Studio themes</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    Six calibrated dark palettes with crisp contrast and zero visual clutter.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-elevated px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {themes.length} themes
                </span>
              </div>

              <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((item) => {
                  const Icon = item.icon;
                  const selected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseTheme(item.id)}
                      aria-pressed={selected}
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary bg-elevated ring-2 ring-primary/60"
                          : "border-border bg-background/60 hover:border-primary/40 hover:bg-elevated/70",
                      )}
                    >
                      <div
                        className="flex h-[112px] w-full flex-col overflow-hidden rounded-lg border border-white/[.08]"
                        style={{ background: item.background }}
                      >
                        <div className="flex min-h-0 flex-1">
                          <div
                            className="flex w-[26%] shrink-0 flex-col gap-1.5 border-r border-white/[.06] p-2"
                            style={{ background: item.sidebar }}
                          >
                            <span
                              className="h-1.5 w-full rounded-full"
                              style={{ background: item.accent }}
                            />
                            <span className="h-1.5 w-[78%] rounded-full bg-white/15" />
                            <span className="h-1.5 w-[58%] rounded-full bg-white/10" />
                          </div>

                          <div className="flex flex-1 flex-col gap-2 p-2">
                            <div
                              className="flex h-3.5 w-full items-center rounded-full border border-white/[.06] px-1.5"
                              style={{ background: item.surface }}
                            >
                              <span className="h-1 w-[44%] rounded-full bg-white/15" />
                            </div>
                            <div className="grid flex-1 grid-cols-2 gap-1.5">
                              <div
                                className="flex flex-col justify-end rounded-md border border-white/[.05] p-1.5"
                                style={{ background: item.surface }}
                              >
                                <span className="h-2.5 w-4 rounded-[2px] bg-white/10" />
                                <span className="mt-1 h-1 w-[75%] rounded-full bg-white/20" />
                              </div>
                              <div
                                className="flex flex-col justify-end rounded-md border border-white/[.05] p-1.5"
                                style={{ background: item.surface }}
                              >
                                <span
                                  className="h-2.5 w-4 rounded-[2px]"
                                  style={{ background: item.accent, opacity: 0.45 }}
                                />
                                <span className="mt-1 h-1 w-[68%] rounded-full bg-white/20" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex h-[24px] shrink-0 items-center gap-2 border-t border-white/[.07] px-2"
                          style={{ background: item.elevated }}
                        >
                          <span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: item.accent }}
                          >
                            <span className="h-1 w-1 rounded-full bg-black/75" />
                          </span>
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full w-[56%] rounded-full"
                              style={{ background: item.accent }}
                            />
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-1 flex-col justify-between gap-2.5 px-0.5">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                                {item.label}
                              </p>
                              <span className="mt-1 inline-flex rounded-full border border-border bg-card px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                                {item.tag}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-transparent",
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/70 pt-2.5">
                          <div className="flex items-center gap-1.5" aria-hidden="true">
                            <span
                              className="h-3 w-3 rounded-full border border-white/15"
                              style={{ background: item.background }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-white/15"
                              style={{ background: item.surface }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-white/15"
                              style={{ background: item.accent }}
                            />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            {item.id}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color Selector Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Accent color</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    Personalize buttons, active playback controls, and studio highlights across Sangeet.
                  </p>
                </div>
                <Palette className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {accents.map((item) => {
                  const selected = accent === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseAccent(item.id)}
                      aria-pressed={selected}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary bg-elevated ring-1 ring-primary/50"
                          : "border-border bg-background/60 hover:border-primary/40 hover:bg-elevated/70",
                      )}
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-full border border-white/15"
                        style={{
                          background: `linear-gradient(135deg, ${item.primaryHex} 50%, ${item.secondaryHex} 50%)`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-foreground">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{item.mood}</p>
                      </div>
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-transparent",
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              <div className="p-4 pb-3 sm:px-5">
                <p className="eyebrow">Interface</p>
              </div>
              <div className="flex items-start gap-3.5 p-4 sm:p-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground">
                  <Settings2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Compact sidebar</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Collapse the desktop navigation to icons for more room for your music.
                  </p>
                </div>
                <Switch
                  checked={sidebarCollapsed}
                  onCheckedChange={(checked) => {
                    if (checked !== sidebarCollapsed) toggleSidebar();
                  }}
                  aria-label="Collapse sidebar"
                  className="ml-auto mt-0.5 shrink-0"
                />
              </div>
              <div className="flex items-start gap-3.5 p-4 sm:p-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground">
                  <Monitor className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Now playing panel</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Keep artwork, artist details and the upcoming queue in view on wide screens.
                  </p>
                </div>
                <Switch
                  checked={rightPanelOpen}
                  onCheckedChange={setRightPanelOpen}
                  aria-label="Show now playing panel"
                  className="ml-auto mt-0.5 shrink-0"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p>
                Pair any studio palette with a custom accent color. Preferences are saved locally on this device.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="eyebrow">Your local library</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {dataStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-border bg-elevated p-3.5"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <p className="mt-3 font-display text-xl font-medium leading-none">
                          {formatCount(stat.value)}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                <div className="p-4 pb-3 sm:px-5">
                  <p className="eyebrow">Manage data</p>
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <p className="text-[13px] font-medium">Clear listening history</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Removes recently played tracks. Likes and playlists are kept.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClearHistoryOpen(true)}
                    disabled={recentlyPlayed.length === 0}
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear history
                  </button>
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <p className="text-[13px] font-medium">Reset local library</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Restores the seeded likes, saved albums, follows and playlists.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset library
                  </button>
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <p className="text-[13px] font-medium">Sign out of Sangeet</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Returns to the welcome screen. Local data stays on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignOutOpen(true)}
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="eyebrow">Your data, in sync</p>
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Google sign-in is verified on the server. Favorites, playlists and listening history sync to your private Sangeet account. Playback preferences stay on this device.
                </p>
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-[10px]">
                  {[
                    "Profile & preferences",
                    "Likes, playlists & history",
                    "Queue & player settings",
                  ].map((label) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground/80">{label}</span>
                      <span className="shrink-0 text-right text-muted-foreground/60">{label === "Likes, playlists & history" ? "Account sync" : "This browser"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="eyebrow">A note on privacy</p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Sangeet stores your library to keep it available across devices. Connecting YouTube is optional and read-only; disconnect it any time from your YouTube library.
                </p>
                <Link
                  href="/profile"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary transition hover:text-secondary"
                >
                  Back to profile
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <Link href="/my-youtube-library" className="group block overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-elevated">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-primary"><ListMusic className="h-5 w-5" /></span>
                <p className="mt-4 text-sm font-medium">My YouTube Library</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Optionally connect to browse your own playlists and liked videos.</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary">Manage connection <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
              </Link>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="about">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-elevated text-primary">
                    <AudioLines className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-medium tracking-[0.18em]">Sangeet</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Music beyond boundaries
                    </p>
                  </div>
                </div>
                <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                  Sangeet is an independent music discovery experience. It combines a bundled
                  sample catalog with music discovery and playback. Listener libraries are currently
                  stored on this device.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Next.js App Router", "React 19", "TypeScript", "Tailwind CSS", "Zustand"].map(
                    (item) => (
                      <span
                        key={item}
                        className="rounded-full border border-border bg-elevated px-2.5 py-1 text-[10px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                <div className="bg-card p-5">
                  <p className="eyebrow">Catalogue</p>
                  <p className="mt-2 font-display text-2xl font-medium">{tracks.filter((track) => track.source !== "youtube").length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">bundled sample tracks</p>
                </div>
                <div className="bg-card p-5">
                  <p className="eyebrow">Artwork</p>
                  <p className="mt-2 font-display text-2xl font-medium">{albums.length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">catalog albums</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="eyebrow">Version</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Sample catalog</span>
                  <span>1.0.0</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Environment</span>
                  <span>Local browser</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">Audio</span>
                  <span>Bundled MP3</span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="eyebrow">Credits</p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Bundled sample recordings and cover art ship with this app. External playback
                  sources remain with their providers, and Sangeet does not collect listener analytics.
                </p>
                <Link
                  href="/home"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary transition hover:text-secondary"
                >
                  Return home
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear listening history?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your recently played tracks. Liked songs, playlists and saved albums will
              stay exactly where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep history</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                toast.show("Listening history cleared", "Your library is otherwise untouched.", "info");
              }}
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the local library?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores the original seeded likes, saved albums, followed artists and playlists.
              Any playlists you created in this browser will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset library</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Sangeet?</AlertDialogTitle>
            <AlertDialogDescription>
              Playback will stop and you will return to the welcome screen. Your local library and
              preferences will still be here next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
