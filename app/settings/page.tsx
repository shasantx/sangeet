"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  Clock3,
  Database,
  Heart,
  Info,
  Keyboard,
  ListMusic,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Trash2,
  Users,
} from "lucide-react";
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
  description: string;
  background: string;
  surface: string;
  accent: string;
  icon: typeof Moon;
}[] = [
  {
    id: "dark",
    label: "Sangeet Dark",
    description: "The signature charcoal black and violet.",
    background: "#0B0B0F",
    surface: "#17171E",
    accent: "#8B5CF6",
    icon: Moon,
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deeper, cooler and almost weightless.",
    background: "#08080D",
    surface: "#101018",
    accent: "#7C83FD",
    icon: AudioLines,
  },
  {
    id: "dusk",
    label: "Dusk",
    description: "A warm, low-lit charcoal with amber air.",
    background: "#0F0D0B",
    surface: "#1D1814",
    accent: "#C78D58",
    icon: SunMedium,
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
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.045] text-muted-foreground">
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

  const chooseTheme = (next: ThemePreference) => {
    if (next === theme) return;
    setTheme(next);
    const selected = themes.find((item) => item.id === next);
    toast.success("Theme updated", selected?.label ?? next);
  };

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
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-4 py-2.5 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.15] hover:bg-white/[.05] hover:text-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          View profile
        </Link>
      </div>

      <Tabs defaultValue="playback">
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
            <div className="divide-y divide-white/[.055] overflow-hidden rounded-2xl border border-white/[.055] bg-white/[.015]">
              <div className="p-4 pb-3 sm:px-5">
                <p className="eyebrow">Playback preferences</p>
              </div>
              <ToggleRow
                icon={<Sparkles className="h-4 w-4" />}
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
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.045] text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">Now playing panel</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Show the persistent now playing and artist panel on wide screens.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-3 py-1.5 text-[10px] text-muted-foreground">
                      Desktop only
                      <span className="h-1 w-1 rounded-full bg-white/20" />
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
              <div className="rounded-2xl border border-white/[.055] bg-surface/70 p-5">
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
                      <kbd className="rounded border border-white/[.08] bg-black/25 px-1.5 py-0.5 font-sans text-[9px] text-muted-foreground/80">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
                {!shortcuts && (
                  <p className="mt-4 border-t border-white/[.06] pt-3 text-[10px] text-muted-foreground/60">
                    Shortcuts are currently turned off.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-5">
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
                <p className="mt-4 border-t border-white/[.06] pt-3 text-[10px] leading-relaxed text-muted-foreground/60">
                  Sangeet’s catalog includes bundled audio and linked listening sources. No music is
                  downloaded or re-hosted from third-party services.
                </p>
              </div>
            </div>
          </div>
          <LocalAudioLibrary />
        </TabsContent>

        <TabsContent value="appearance">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Theme</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    Three dark moods, one calm interface. Changes apply immediately.
                  </p>
                </div>
                <Moon className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
                        "group overflow-hidden rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary/45 bg-primary/[.055]"
                          : "border-white/[.065] bg-white/[.015] hover:border-white/[.13] hover:bg-white/[.03]",
                      )}
                    >
                      <div
                        className="relative h-[92px] overflow-hidden rounded-lg border border-white/[.055]"
                        style={{ background: item.background }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-[30%] border-r border-white/[.045]"
                          style={{ background: item.surface }}
                        />
                        <div className="absolute inset-x-[36%] top-3 h-2 rounded-full bg-white/[.12]" />
                        <div className="absolute inset-x-[36%] top-7 h-1.5 w-[28%] rounded-full bg-white/[.07]" />
                        <div className="absolute inset-x-[36%] top-11 h-1.5 w-[38%] rounded-full bg-white/[.05]" />
                        <span
                          className="absolute bottom-3 left-[38%] h-7 w-7 rounded-full"
                          style={{ background: item.accent }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 px-0.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium">{item.label}</p>
                          <p className="mt-0.5 line-clamp-1 text-[9.5px] text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-white/[.12] text-transparent",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                      <span className="mt-2 flex items-center gap-1 px-0.5 text-[9px] text-muted-foreground/50">
                        <Icon className="h-2.5 w-2.5" />
                        {item.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-4 sm:p-5">
              <p className="eyebrow">Accent color</p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Personalize buttons, active states and highlights across Sangeet.</p>
              <div className="mt-4 flex flex-wrap gap-2">{([
                ["green", "Sangeet green", "bg-emerald-500"], ["red", "Red", "bg-red-500"], ["yellow", "Yellow", "bg-amber-400"], ["blue", "Blue", "bg-blue-500"], ["violet", "Violet", "bg-violet-500"],
              ] as [AccentPreference, string, string][]).map(([id, label, color]) => <button key={id} type="button" onClick={() => { setAccent(id); toast.success("Accent updated", label); }} aria-pressed={accent === id} className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs transition", accent === id ? "border-primary/40 bg-primary/[.08]" : "border-white/10 hover:bg-white/[.04]")}><span className={`h-3 w-3 rounded-full ${color}`} />{label}{accent === id && <Check className="h-3.5 w-3.5 text-primary"/>}</button>)}</div>
            </div>

            <div className="divide-y divide-white/[.055] overflow-hidden rounded-2xl border border-white/[.055] bg-white/[.015]">
              <div className="p-4 pb-3 sm:px-5">
                <p className="eyebrow">Interface</p>
              </div>
              <div className="flex items-start gap-3.5 p-4 sm:p-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.045] text-muted-foreground">
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
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.045] text-muted-foreground">
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

            <div className="flex items-start gap-2.5 rounded-xl border border-white/[.05] bg-white/[.015] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p>
                    Choose a dark canvas and pair it with a green, red, yellow, blue or violet accent. Your choices are saved on this device.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-4 sm:p-5">
                <p className="eyebrow">Your local library</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {dataStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-white/[.055] bg-white/[.02] p-3.5"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <p className="mt-3 font-display text-xl font-medium leading-none">
                          {formatCount(stat.value)}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="divide-y divide-white/[.055] overflow-hidden rounded-2xl border border-white/[.055] bg-white/[.015]">
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
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-white/[.09] px-4 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.17] hover:bg-white/[.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-white/[.09] px-4 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.17] hover:bg-white/[.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-white/[.09] px-4 text-[11px] font-medium text-muted-foreground transition hover:border-white/[.17] hover:bg-white/[.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[.055] bg-surface/70 p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="eyebrow">Your data, in sync</p>
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Google sign-in is verified on the server. Favorites, playlists and listening history sync to your private Sangeet account. Playback preferences stay on this device.
                </p>
                <div className="mt-4 space-y-2 border-t border-white/[.06] pt-4 text-[10px]">
                  {[
                    "Profile & preferences",
                    "Likes, playlists & history",
                    "Queue & player settings",
                  ].map((label) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground/70">{label}</span>
                      <span className="shrink-0 text-right text-muted-foreground/55">{label === "Likes, playlists & history" ? "Account sync" : "This browser"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-5">
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

              <Link href="/my-youtube-library" className="group relative isolate block overflow-hidden rounded-2xl border border-white/[.08] bg-[#15161a] p-5 transition hover:border-white/[.16] hover:bg-[#191a1f]">
                <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 -z-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl transition group-hover:bg-primary/30" />
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ListMusic className="h-5 w-5" /></span>
                <p className="mt-4 text-sm font-medium">My YouTube Library</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Optionally connect to browse your own playlists and liked videos.</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary">Manage connection <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
              </Link>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="about">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
              <div className="relative isolate p-6 sm:p-8">
                <div className="absolute -right-24 -top-28 -z-10 h-64 w-64 rounded-full bg-primary/15 blur-[90px]" />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Sparkles className="h-5 w-5" />
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
                        className="rounded-full border border-white/[.07] bg-white/[.025] px-2.5 py-1 text-[10px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-white/[.055] bg-white/[.055]">
                <div className="bg-surface p-5">
                  <p className="eyebrow">Catalogue</p>
                  <p className="mt-2 font-display text-2xl font-medium">{tracks.filter((track) => track.source !== "youtube").length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">bundled sample tracks</p>
                </div>
                <div className="bg-surface p-5">
                  <p className="eyebrow">Artwork</p>
                  <p className="mt-2 font-display text-2xl font-medium">{albums.length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">catalog albums</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-5">
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
              <div className="rounded-2xl border border-white/[.055] bg-white/[.015] p-5">
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
