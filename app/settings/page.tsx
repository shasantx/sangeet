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
  Disc3,
  Download,
  Eclipse,
  HardDrive,
  Heart,
  Info,
  Keyboard,
  Laptop,
  Layers,
  Leaf,
  ListMusic,
  LogOut,
  Monitor,
  Moon,
  Music2,
  Palette,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  SunMedium,
  Trash2,
  Users,
} from "lucide-react";
import { isNativeOfflineSupported } from "@/lib/offline-audio";
import { cn, formatCount } from "@/lib/utils";
import type { ThemePreference } from "@/store/app-store";
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

type SettingsSectionId = "playback" | "appearance" | "data" | "about";

interface SettingsSectionItem {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: typeof AudioLines;
}

const settingsSections: SettingsSectionItem[] = [
  {
    id: "playback",
    label: "Playback",
    description: "Queue behavior, shortcuts & downloads",
    icon: AudioLines,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Static themes & workspace layout",
    icon: Palette,
  },
  {
    id: "data",
    label: "Storage & Data",
    description: "Library stats, sync & account",
    icon: Database,
  },
  {
    id: "about",
    label: "About",
    description: "Version, catalog & credits",
    icon: Info,
  },
];

type GlassPillVariant =
  | "cyan"
  | "violet"
  | "amber"
  | "emerald"
  | "rose"
  | "blue"
  | "slate";

interface ThemeOption {
  id: ThemePreference;
  label: string;
  tag: string;
  pillVariant: GlassPillVariant;
  description: string;
  background: string;
  sidebar: string;
  surface: string;
  elevated: string;
  accent: string;
  gradient: string;
  swatchGradient: string;
  icon: typeof Moon;
}

const themes: ThemeOption[] = [
  {
    id: "dark",
    label: "Discord Ash",
    tag: "Default",
    pillVariant: "emerald",
    description: "Balanced charcoal ash engineered for long listening sessions.",
    background: "#121215",
    sidebar: "#0E0E11",
    surface: "#18181C",
    elevated: "#26272E",
    accent: "#1ED760",
    gradient:
      "radial-gradient(ellipse 80% 55% at 15% 0%, rgba(30, 215, 96, 0.10), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #26272E 0%, #121215 100%)",
    icon: Moon,
  },
  {
    id: "onyx",
    label: "True Onyx",
    tag: "OLED",
    pillVariant: "slate",
    description: "Pure #000000 OLED canvas with razor-sharp contrast and depth.",
    background: "#000000",
    sidebar: "#050507",
    surface: "#0A0A0D",
    elevated: "#14141A",
    accent: "#E4E4E7",
    gradient:
      "radial-gradient(ellipse 75% 50% at 20% 0%, rgba(161, 161, 170, 0.08), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #18181B 0%, #000000 100%)",
    icon: Eclipse,
  },
  {
    id: "blurple",
    label: "Blurple Dusk",
    tag: "Blurple",
    pillVariant: "blue",
    description: "Iconic Blurple twilight with luminous indigo-violet glow.",
    background: "#14152B",
    sidebar: "#101124",
    surface: "#1B1C38",
    elevated: "#26284D",
    accent: "#5865F2",
    gradient:
      "radial-gradient(ellipse 85% 60% at 18% 0%, rgba(88, 101, 242, 0.36), transparent 65%), radial-gradient(ellipse 65% 50% at 88% 10%, rgba(121, 131, 245, 0.24), transparent 60%)",
    swatchGradient: "linear-gradient(135deg, #5865F2 0%, #7983F5 52%, #14152B 100%)",
    icon: Layers,
  },
  {
    id: "midnight",
    label: "Midnight Sapphire",
    tag: "Focus",
    pillVariant: "blue",
    description: "Deep ink sapphire with crisp slate layers and cool contrast.",
    background: "#070B14",
    sidebar: "#0B1120",
    surface: "#111A2E",
    elevated: "#18243E",
    accent: "#3898FF",
    gradient:
      "radial-gradient(ellipse 80% 55% at 18% 0%, rgba(56, 152, 255, 0.20), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #3898FF 0%, #070B14 100%)",
    icon: AudioLines,
  },
  {
    id: "cotton-candy",
    label: "Cotton Candy",
    tag: "Pastel",
    pillVariant: "rose",
    description: "Deep twilight plum infused with soft pink and cyan ambient gradients.",
    background: "#1B1026",
    sidebar: "#150C1F",
    surface: "#241633",
    elevated: "#311F45",
    accent: "#F472B6",
    gradient:
      "radial-gradient(ellipse 80% 58% at 14% 0%, rgba(244, 114, 182, 0.30), transparent 65%), radial-gradient(ellipse 70% 52% at 88% 8%, rgba(56, 189, 248, 0.24), transparent 60%)",
    swatchGradient: "linear-gradient(135deg, #F472B6 0%, #38BDF8 100%)",
    icon: Music2,
  },
  {
    id: "retro",
    label: "Retro Synthwave",
    tag: "Synth",
    pillVariant: "violet",
    description: "Neon synthwave dusk with electric magenta and warm amber glow.",
    background: "#140B24",
    sidebar: "#0F081C",
    surface: "#1E1136",
    elevated: "#2B194D",
    accent: "#EC4899",
    gradient:
      "radial-gradient(ellipse 82% 58% at 15% 0%, rgba(236, 72, 153, 0.32), transparent 65%), radial-gradient(ellipse 68% 50% at 88% 10%, rgba(245, 158, 11, 0.24), transparent 60%)",
    swatchGradient: "linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)",
    icon: Disc3,
  },
  {
    id: "emerald",
    label: "Evergreen Nocturne",
    tag: "Botanical",
    pillVariant: "emerald",
    description: "Deep pine slate balanced with crisp jade highlights.",
    background: "#060D0A",
    sidebar: "#0A1410",
    surface: "#11221B",
    elevated: "#182F25",
    accent: "#20E070",
    gradient:
      "radial-gradient(ellipse 80% 55% at 18% 0%, rgba(32, 224, 112, 0.18), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #20E070 0%, #060D0A 100%)",
    icon: Leaf,
  },
  {
    id: "aurora",
    label: "Velvet Indigo",
    tag: "Velvet",
    pillVariant: "violet",
    description: "Editorial plum indigo with muted violet framing.",
    background: "#0A0812",
    sidebar: "#100C1C",
    surface: "#1A142E",
    elevated: "#251D40",
    accent: "#A874FF",
    gradient:
      "radial-gradient(ellipse 80% 55% at 18% 0%, rgba(168, 116, 255, 0.22), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #A874FF 0%, #0A0812 100%)",
    icon: Palette,
  },
  {
    id: "crimson",
    label: "Noir Crimson",
    tag: "Noir",
    pillVariant: "rose",
    description: "Sophisticated burgundy noir with restrained rose accents.",
    background: "#10080B",
    sidebar: "#160B0E",
    surface: "#241217",
    elevated: "#321A21",
    accent: "#F4516C",
    gradient:
      "radial-gradient(ellipse 80% 55% at 18% 0%, rgba(244, 81, 108, 0.20), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #F4516C 0%, #10080B 100%)",
    icon: Heart,
  },
  {
    id: "dusk",
    label: "Warm Espresso",
    tag: "Warm",
    pillVariant: "amber",
    description: "Refined roasted charcoal with warm copper depth.",
    background: "#0E0B09",
    sidebar: "#140F0C",
    surface: "#1F1814",
    elevated: "#2A211C",
    accent: "#E58E49",
    gradient:
      "radial-gradient(ellipse 80% 55% at 18% 0%, rgba(229, 142, 73, 0.20), transparent 65%)",
    swatchGradient: "linear-gradient(135deg, #E58E49 0%, #0E0B09 100%)",
    icon: SunMedium,
  },
];

const pillVariantClass: Record<GlassPillVariant, string> = {
  cyan: "glass-pill-cyan",
  violet: "glass-pill-violet",
  amber: "glass-pill-amber",
  emerald: "glass-pill-emerald",
  rose: "glass-pill-rose",
  blue: "glass-pill-blue",
  slate: "glass-pill-slate",
};

function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          {description}
        </p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

function ThemePreviewCard({
  item,
  selected,
  onSelect,
}: {
  item: ThemeOption;
  selected: boolean;
  onSelect: (id: ThemePreference) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-pressed={selected}
      className={cn(
        "group relative flex min-h-[44px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary bg-elevated shadow-[0_0_0_1px_hsl(var(--primary)/0.45)] ring-2 ring-primary/35"
          : "border-border bg-background/60 hover:border-primary/45 hover:bg-elevated/70",
      )}
    >
      {/* Miniature Static UI Preview */}
      <div
        className="relative flex h-[126px] w-full flex-col overflow-hidden rounded-xl border border-white/[0.09] shadow-inner"
        style={{
          backgroundColor: item.background,
          backgroundImage: item.gradient,
        }}
      >
        {/* Top-left Glowing Glassmorphic Pill */}
        <span
          className={cn(
            "pointer-events-none absolute left-2 top-2 z-10 glass-pill",
            pillVariantClass[item.pillVariant],
          )}
        >
          <Icon className="h-2.5 w-2.5 shrink-0" />
          <span>{item.tag}</span>
        </span>

        {/* Top-right Active Checkmark Badge */}
        <span
          className={cn(
            "pointer-events-none absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition",
            selected
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-white/20 bg-black/35 text-transparent group-hover:border-white/40",
          )}
        >
          <Check className="h-3 w-3 stroke-[2.5]" />
        </span>

        {/* Mini App Body: Sidebar + Header + Track Cards */}
        <div className="flex min-h-0 flex-1">
          {/* Mini Sidebar */}
          <div
            className="flex w-[26%] shrink-0 flex-col justify-end gap-1.5 border-r border-white/[0.07] p-2 pt-7"
            style={{ backgroundColor: item.sidebar }}
          >
            <div
              className="flex items-center gap-1 rounded px-1 py-0.5"
              style={{ backgroundColor: `${item.accent}24` }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.accent }}
              />
              <span
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: item.accent }}
              />
            </div>
            <span className="h-1.5 w-[76%] rounded-full bg-white/15" />
            <span className="h-1.5 w-[56%] rounded-full bg-white/10" />
          </div>

          {/* Mini Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2 pt-7">
            {/* Mini Header */}
            <div
              className="flex h-4 w-full items-center justify-between rounded-full border border-white/[0.07] px-1.5"
              style={{ backgroundColor: item.surface }}
            >
              <span className="h-1 w-[46%] rounded-full bg-white/20" />
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.accent }}
              />
            </div>

            {/* Mini Track Cards */}
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              <div
                className="flex flex-col justify-between rounded-md border border-white/[0.06] p-1.5"
                style={{ backgroundColor: item.surface }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{ backgroundColor: item.accent, opacity: 0.72 }}
                />
                <div className="space-y-1">
                  <span className="block h-1 w-[82%] rounded-full bg-white/25" />
                  <span className="block h-1 w-[52%] rounded-full bg-white/12" />
                </div>
              </div>
              <div
                className="flex flex-col justify-between rounded-md border border-white/[0.06] p-1.5"
                style={{ backgroundColor: item.surface }}
              >
                <span className="h-3.5 w-3.5 rounded-[3px] bg-white/15" />
                <div className="space-y-1">
                  <span className="block h-1 w-[74%] rounded-full bg-white/25" />
                  <span className="block h-1 w-[48%] rounded-full bg-white/12" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Player Bar */}
        <div
          className="flex h-[25px] shrink-0 items-center gap-2 border-t border-white/[0.08] px-2"
          style={{ backgroundColor: item.elevated }}
        >
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.accent }}
          >
            <span className="ml-[1px] h-1.5 w-1.5 rounded-full bg-black/75" />
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="block h-full w-[58%] rounded-full"
              style={{ backgroundColor: item.accent }}
            />
          </span>
          <span className="h-1.5 w-3 rounded-full bg-white/15" />
        </div>
      </div>

      {/* Card Footer: Swatch + Label + Description */}
      <div className="mt-3 flex min-w-0 flex-1 items-start gap-2.5 px-0.5">
        <span
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-white/20 shadow-sm ring-1 ring-black/30"
          style={{ background: item.swatchGradient }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {item.label}
            </p>
            {selected ? (
              <span className="shrink-0 text-[10px] font-semibold text-primary">
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 p-4 sm:p-5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <label className="block cursor-pointer text-[13px] font-medium text-foreground">
          {title}
        </label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        {badge ? <div className="mt-2.5">{badge}</div> : null}
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
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("playback");

  useEffect(() => {
    setNativeOffline(isNativeOfflineSupported());
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (
        tab === "playback" ||
        tab === "appearance" ||
        tab === "data" ||
        tab === "about"
      ) {
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

  const handleReset = () => {
    resetLibrary();
    toast.success(
      "Local library reset",
      "Likes, playlists and history are back to their starting point.",
    );
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    signOut();
    resetPlayer();
    toast.info(
      "Signed out of Sangeet",
      "Your local library is still saved on this device.",
    );
    router.replace("/welcome");
  };

  const dataStats = [
    { label: "Liked songs", value: likedTrackIds.length, icon: Heart },
    { label: "Playlists", value: playlists.length, icon: ListMusic },
    { label: "Following", value: followedArtistIds.length, icon: Users },
    { label: "History", value: recentlyPlayed.length, icon: Clock3 },
  ];

  const activeTheme = themes.find((item) => item.id === theme) ?? themes[0];

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-clip">
      <div className="page-container min-w-0 max-w-[1220px]">
        {/* Page Header */}
        <header className="mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
          <div className="max-w-2xl min-w-0">
            <p className="eyebrow mb-2.5">Workspace Preferences</p>
            <h1 className="text-[34px] font-medium leading-none tracking-[-0.045em] sm:text-[46px]">
              Settings
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Configure playback controls, visual themes, local storage, and connected devices.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-elevated hover:text-foreground"
          >
            <span>View profile</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsSectionId)}
          className="min-w-0"
        >
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[230px_1fr] lg:gap-8">
            {/* Mobile Horizontal Pill Tabs */}
            <div className="min-w-0 lg:hidden">
              <TabsList
                data-no-tab-swipe="true"
                className="hide-scrollbar inline-flex w-full max-w-full justify-start overflow-x-auto sm:w-fit"
              >
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <TabsTrigger
                      key={section.id}
                      value={section.id}
                      className="shrink-0"
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      {section.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Desktop Vertical Sidebar Rail */}
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <nav
                  aria-label="Settings sections"
                  className="space-y-1 rounded-2xl border border-border bg-card p-2"
                >
                  {settingsSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeTab === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveTab(section.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isActive
                            ? "bg-elevated text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-elevated/50 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition",
                            isActive
                              ? "border-primary/35 bg-primary/15 text-primary"
                              : "border-border bg-background/60 text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-tight">
                            {section.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                            {section.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>

                {/* Active Theme Summary Card in Rail */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="eyebrow">Active Theme</p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <span
                      className="h-6 w-6 shrink-0 rounded-full border border-white/20 shadow-sm"
                      style={{ background: activeTheme.swatchGradient }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {activeTheme.label}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {activeTheme.tag} palette
                      </p>
                    </div>
                  </div>
                  {activeTab !== "appearance" ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("appearance")}
                      className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition hover:text-secondary"
                    >
                      <span>Switch theme</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </aside>

            {/* Right Column Section Content */}
            <div className="min-w-0">
              {/* Playback */}
              <TabsContent value="playback" className="mt-0 min-w-0 space-y-6">
                <SectionHeader
                  eyebrow="Playback"
                  title="Playback & Devices"
                  description="Control queue continuation, keyboard shortcuts, local audio folders, and desktop/mobile companion apps."
                />

                <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="px-5 py-3.5">
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
                    <ToggleRow
                      icon={<Monitor className="h-4 w-4" />}
                      title="Now playing panel"
                      description="Show the persistent now playing and artist panel on wide screens."
                      checked={rightPanelOpen}
                      onCheckedChange={setRightPanelOpen}
                      badge={
                        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-[10px] font-medium text-muted-foreground">
                          <span>Desktop only</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/45" />
                          <span>{rightPanelOpen ? "Visible" : "Hidden"}</span>
                        </span>
                      }
                    />
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <Keyboard className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="eyebrow">Shortcuts</p>
                      </div>
                      <div className="mt-4 space-y-2.5 text-xs">
                        {[
                          ["Space", "Play / pause"],
                          ["→ / ←", "Seek 5 seconds"],
                          ["N / P", "Next / previous"],
                          ["M", "Mute / unmute"],
                          ["⌘ K", "Open search"],
                        ].map(([key, action]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="min-w-0 text-muted-foreground">
                              {action}
                            </span>
                            <kbd className="shrink-0 rounded border border-border bg-elevated px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                              {key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                      {!shortcuts && (
                        <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground/80">
                          Shortcuts are currently turned off.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="eyebrow">Audio Engine</p>
                      <div className="mt-3.5 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Source</span>
                          <span className="font-medium text-foreground">
                            MP3 audio
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Format</span>
                          <span className="font-medium text-foreground">
                            MP3
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Catalog tracks
                          </span>
                          <span className="font-medium text-foreground">
                            {tracks.length} tracks
                          </span>
                        </div>
                      </div>
                      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground/80">
                        Sangeet’s catalog includes bundled audio and linked
                        listening sources. No music is re-hosted from
                        third-party services.
                      </p>
                    </div>
                  </div>
                </div>

                <section
                  aria-label="Apps and Downloads"
                  className="overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
                >
                  <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-xl min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="eyebrow text-primary">
                          Apps &amp; Downloads
                        </p>
                        {nativeOffline && (
                          <span className="rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                            Native offline active
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-semibold tracking-tight text-foreground">
                        Sangeet for Windows &amp; Android
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Offline listening and local audio downloads are built
                        into the Android APK and Windows .exe apps. Download
                        directly from Sangeet below.
                      </p>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <a
                        href="/api/download/windows"
                        download="Sangeet.exe"
                        className="inline-flex min-h-[42px] max-w-full shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-elevated/80 active:scale-95"
                      >
                        <Laptop className="h-4 w-4 shrink-0 text-primary" />
                        <span>Windows .exe</span>
                        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                      <a
                        href="/api/download/android"
                        download="sangeet-android.apk"
                        className="inline-flex min-h-[42px] max-w-full shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 active:scale-95"
                      >
                        <Smartphone className="h-4 w-4 shrink-0" />
                        <span>Android APK</span>
                        <Download className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </div>
                  </div>
                </section>

                <div className="min-w-0">
                  <LocalAudioLibrary />
                </div>
              </TabsContent>

              {/* Appearance */}
              <TabsContent value="appearance" className="mt-0 min-w-0 space-y-6">
                <SectionHeader
                  eyebrow="Appearance"
                  title="Themes & Workspace"
                  description="Select a static color palette and fine-tune how navigation and side panels appear across desktop screens."
                  aside={
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                      <Palette className="h-3.5 w-3.5 text-primary" />
                      <span>{themes.length} themes</span>
                    </span>
                  }
                />

                {/* Themes Card */}
                <section className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        Themes
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Preview surface contrast, sidebar framing, and player accents before applying.
                      </p>
                    </div>
                    <span className="glass-pill glass-pill-slate">
                      <Moon className="h-2.5 w-2.5 shrink-0" />
                      <span>Static Palettes</span>
                    </span>
                  </div>

                  <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {themes.map((item) => (
                      <ThemePreviewCard
                        key={item.id}
                        item={item}
                        selected={theme === item.id}
                        onSelect={chooseTheme}
                      />
                    ))}
                  </div>
                </section>

                {/* Workspace Layout Card */}
                <section className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="px-5 py-3.5">
                    <p className="eyebrow">Workspace Layout</p>
                  </div>
                  <ToggleRow
                    icon={<Settings2 className="h-4 w-4" />}
                    title="Compact sidebar"
                    description="Collapse the desktop navigation to icons to give more horizontal space to artwork and playlists."
                    checked={sidebarCollapsed}
                    onCheckedChange={(checked) => {
                      if (checked !== sidebarCollapsed) toggleSidebar();
                    }}
                  />
                  <ToggleRow
                    icon={<Monitor className="h-4 w-4" />}
                    title="Now playing panel"
                    description="Keep artwork, artist details, and the upcoming queue visible in the right-hand panel on wide screens."
                    checked={rightPanelOpen}
                    onCheckedChange={setRightPanelOpen}
                  />
                </section>

                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="min-w-0">
                    Theme and workspace preferences are saved locally in this
                    browser.
                  </p>
                </div>
              </TabsContent>

              {/* Storage & Data */}
              <TabsContent value="data" className="mt-0 min-w-0 space-y-6">
                <SectionHeader
                  eyebrow="Storage & Data"
                  title="Library & Account"
                  description="Review local library counts, clear listening history, reset seeded defaults, or manage external connections."
                />

                <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <div className="min-w-0 space-y-5">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="eyebrow">Local Library Summary</p>
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                        {dataStats.map((stat) => {
                          const Icon = stat.icon;
                          return (
                            <div
                              key={stat.label}
                              className="min-w-0 rounded-xl border border-border bg-elevated p-3.5"
                            >
                              <Icon className="h-3.5 w-3.5 text-muted-foreground/80" />
                              <p className="mt-3 font-display text-xl font-medium leading-none">
                                {formatCount(stat.value)}
                              </p>
                              <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                                {stat.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                      <div className="px-5 py-3.5">
                        <p className="eyebrow">Manage Data</p>
                      </div>
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground">
                            Clear listening history
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Removes recently played tracks. Likes and playlists
                            are kept.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClearHistoryOpen(true)}
                          disabled={recentlyPlayed.length === 0}
                          className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          Clear history
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground">
                            Reset local library
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Restores the seeded likes, saved albums, follows and
                            playlists.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setResetOpen(true)}
                          className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                          Reset library
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground">
                            Sign out of Sangeet
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Returns to the welcome screen. Local data stays on
                            this device.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSignOutOpen(true)}
                          className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <LogOut className="h-3.5 w-3.5 shrink-0" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="eyebrow">Your data, in sync</p>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Google sign-in is verified on the server. Favorites,
                        playlists and listening history sync to your private
                        Sangeet account. Playback preferences stay on this
                        device.
                      </p>
                      <div className="mt-4 space-y-2 border-t border-border pt-4 text-[11px]">
                        {[
                          "Profile & preferences",
                          "Likes, playlists & history",
                          "Queue & player settings",
                        ].map((label) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="min-w-0 text-muted-foreground/90">
                              {label}
                            </span>
                            <span className="shrink-0 text-right text-muted-foreground/70">
                              {label === "Likes, playlists & history"
                                ? "Account sync"
                                : "This browser"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="eyebrow">A note on privacy</p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Sangeet stores your library to keep it available across
                        devices. Connecting YouTube is optional and read-only;
                        disconnect it any time from your YouTube library.
                      </p>
                      <Link
                        href="/profile"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition hover:text-secondary"
                      >
                        Back to profile
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </div>

                    <Link
                      href="/my-youtube-library"
                      className="group block overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-elevated"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-primary">
                        <ListMusic className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        My YouTube Library
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        Optionally connect to browse your own playlists and
                        liked videos.
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                        Manage connection
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              </TabsContent>

              {/* About */}
              <TabsContent value="about" className="mt-0 min-w-0 space-y-6">
                <SectionHeader
                  eyebrow="About"
                  title="About Sangeet"
                  description="Application stack, bundled sample catalog details, and privacy guarantees."
                />

                <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="p-5 sm:p-7">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-primary">
                          <AudioLines className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-2xl font-medium tracking-[0.12em] sm:tracking-[0.16em]">
                            Sangeet
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            Music beyond boundaries
                          </p>
                        </div>
                      </div>
                      <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                        Sangeet is an independent music discovery experience. It
                        combines a bundled sample catalog with music discovery
                        and playback. Listener libraries are stored locally on
                        this device.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {[
                          "Next.js App Router",
                          "React 19",
                          "TypeScript",
                          "Tailwind CSS",
                          "Zustand",
                        ].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-border bg-elevated px-3 py-1 text-[11px] text-muted-foreground"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                      <div className="min-w-0 bg-card p-5">
                        <p className="eyebrow">Catalogue</p>
                        <p className="mt-2 font-display text-2xl font-medium">
                          {
                            tracks.filter((track) => track.source !== "youtube")
                              .length
                          }
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          bundled sample tracks
                        </p>
                      </div>
                      <div className="min-w-0 bg-card p-5">
                        <p className="eyebrow">Artwork</p>
                        <p className="mt-2 font-display text-2xl font-medium">
                          {albums.length}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          catalog albums
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="eyebrow">Build Info</p>
                      <div className="mt-3.5 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Sample catalog
                          </span>
                          <span className="font-medium text-foreground">
                            1.0.0
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Environment
                          </span>
                          <span className="font-medium text-foreground">
                            Local browser
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Audio</span>
                          <span className="font-medium text-foreground">
                            Bundled MP3
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="eyebrow">Credits</p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Bundled sample recordings and cover art ship with this
                        app. External playback sources remain with their
                        providers, and Sangeet does not collect listener
                        analytics.
                      </p>
                      <Link
                        href="/home"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition hover:text-secondary"
                      >
                        Return home
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear listening history?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your recently played tracks. Liked songs, playlists
                and saved albums will stay exactly where they are.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep history</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clearHistory();
                  toast.show(
                    "Listening history cleared",
                    "Your library is otherwise untouched.",
                    "info",
                  );
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
                This restores the original seeded likes, saved albums, followed
                artists and playlists. Any playlists you created in this browser
                will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>
                Reset library
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Sangeet?</AlertDialogTitle>
              <AlertDialogDescription>
                Playback will stop and you will return to the welcome screen.
                Your local library and preferences will still be here next time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay signed in</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut}>
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
