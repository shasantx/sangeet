"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock3,
  Compass,
  Heart,
  Home,
  Library,
  ListMusic,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { SangeetMark } from "@/components/brand/sangeet-mark";

const primaryNav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/explore", label: "Explore", icon: Compass },
];

const libraryNav = [
  { href: "/library", label: "Your Library", icon: Library },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/recently-played", label: "Recently Played", icon: Clock3 },
  { href: "/queue", label: "Queue", icon: ListMusic },
];

const preferencesNav = [
  { href: "/settings?tab=appearance", label: "Themes & Appearance", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const profile = useAppStore((state) => state.profile);
  const playlists = useLibraryStore((state) => state.playlists);
  const openCreate = useUIStore((state) => state.openCreatePlaylist);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);

  const displayName = session?.displayName || profile.name;
  const initials = session?.initials || profile.initials;
  const avatarColor = session?.avatarColor || profile.avatarColor;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-[calc(100dvh-92px)] flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-[80px]" : "w-[240px]",
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          "flex h-[74px] shrink-0 items-center px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/home"
          className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Sangeet Music home"
        >
          <SangeetMark size={34} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-display text-[18px] font-bold leading-none tracking-tight text-foreground">
                Sangeet
              </span>
              <span className="mt-1 block text-[9.5px] font-medium tracking-wide text-muted-foreground">
                Studio Audio
              </span>
            </span>
          )}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        <nav className="space-y-1" aria-label="Discover">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed && "justify-center px-0",
                  active
                    ? "border-border bg-elevated text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                )}
              >
                {active && !collapsed && (
                  <span
                    className="absolute left-1 h-4 w-[2.5px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mx-2 my-4 h-px bg-border" />

        <nav className="space-y-1" aria-label="Your library">
          {libraryNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/library"
                ? pathname.startsWith("/library")
                : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed && "justify-center px-0",
                  active
                    ? "border-border bg-elevated text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                )}
              >
                {active && !collapsed && (
                  <span
                    className="absolute left-1 h-4 w-[2.5px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mx-2 my-4 h-px bg-border" />

        <nav className="space-y-1" aria-label="Preferences">
          {preferencesNav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/settings" && pathname === "/settings";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed && "justify-center px-0",
                  active
                    ? "border-border bg-elevated text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                )}
              >
                {active && !collapsed && (
                  <span
                    className="absolute left-1 h-4 w-[2.5px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="eyebrow">Playlists</span>
              <button
                type="button"
                onClick={() => openCreate()}
                aria-label="Create playlist"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {playlists.slice(0, 6).map((playlist) => {
                const active = pathname === `/playlist/${playlist.id}`;
                return (
                  <Link
                    key={playlist.id}
                    href={`/playlist/${playlist.id}`}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "bg-elevated text-foreground"
                        : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                    )}
                  >
                    <Artwork
                      src={playlist.artwork}
                      alt=""
                      res="sm"
                      className="h-8 w-8 shrink-0 rounded-lg border border-border"
                    />
                    <span className="min-w-0 truncate">{playlist.title}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => openCreate()}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] text-muted-foreground transition hover:bg-elevated/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-card">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Create playlist
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={cn("shrink-0 border-t border-border p-3", collapsed && "px-2")}>
        {isAuthenticated && session ? (
          <div className={cn("flex items-center gap-1.5", collapsed && "flex-col")}>
            <Link
              href="/profile"
              title={collapsed ? displayName : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                collapsed && "justify-center",
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-1 ring-border"
                style={{ background: avatarColor }}
              >
                {initials}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-foreground">
                    {displayName}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] text-muted-foreground">
                    Listener profile
                  </span>
                </span>
              )}
            </Link>
            {!collapsed && (
              <>
                {session.isAdmin && (
                  <Link
                    href="/admin"
                    aria-label="Admin Console"
                    title="Admin Console"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </>
            )}
            {collapsed && (
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={toggleSidebar}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {!collapsed ? (
              <>
                <Link
                  href="/auth"
                  className="flex-1 rounded-full border border-border bg-card py-2 px-3 text-center text-xs font-semibold text-foreground transition hover:bg-elevated"
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-elevated hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-2">
                <Link
                  href="/auth"
                  title="Sign In"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground transition hover:bg-elevated"
                >
                  In
                </Link>
                <button
                  type="button"
                  aria-label="Expand sidebar"
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-foreground"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
