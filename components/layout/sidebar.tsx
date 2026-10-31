"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock3,
  Compass,
  CreditCard,
  Heart,
  Home,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
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
  { href: "/premium", label: "Premium", icon: CreditCard },
];

const libraryNav = [
  { href: "/library", label: "Your Library", icon: Library },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/recently-played", label: "Recently Played", icon: Clock3 },
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
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const displayName = session?.displayName || profile.name;
  const initials = session?.initials || profile.initials;
  const avatarColor = session?.avatarColor || profile.avatarColor;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-[calc(100dvh-88px)] flex-col border-r border-white/[.045] bg-sidebar/95 transition-[width] duration-300 ease-out md:flex",
        collapsed ? "w-[80px]" : "w-[240px]",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-[78px] shrink-0 items-center px-5", collapsed && "justify-center px-0")}>
        <Link
          href="/home"
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]"
          aria-label="Sangeet Music home"
        >
          <SangeetMark size={34} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-display text-[18px] font-bold leading-none tracking-tight text-white flex items-center gap-1.5">
                Sangeet
              </span>
              <span className="mt-1 block text-[9px] font-medium tracking-wide text-neutral-400">
                Your music, your way
              </span>
            </span>
          )}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        <nav className="space-y-0.5" aria-label="Discover">
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
                  "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed && "justify-center px-0",
                  active ? "bg-white/[.06] text-foreground" : "text-muted-foreground hover:bg-white/[.035] hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 h-4 w-[2px] rounded-full bg-[#1ED760]" aria-hidden="true" />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-[#1ED760]" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 my-5 h-px bg-white/[.055]" />

        <nav className="space-y-0.5" aria-label="Your library">
          {libraryNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/library"
                ? pathname.startsWith("/library")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed && "justify-center px-0",
                  active ? "bg-white/[.06] text-foreground" : "text-muted-foreground hover:bg-white/[.035] hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 h-4 w-[2px] rounded-full bg-[#1ED760]" aria-hidden="true" />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-[#1ED760]" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="eyebrow">Playlists</span>
              <button
                type="button"
                onClick={() => openCreate()}
                aria-label="Create playlist"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active ? "bg-white/[.06] text-foreground" : "text-muted-foreground hover:bg-white/[.035] hover:text-foreground",
                    )}
                  >
                    <Artwork
                      src={playlist.artwork}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-[5px]"
                    />
                    <span className="min-w-0 truncate">{playlist.title}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => openCreate()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-muted-foreground transition hover:bg-white/[.035] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-white/[.13]">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Create playlist
              </button>
            </div>
          </div>
        )}

        {!collapsed && (
          <Link
            href="/made-for-you"
            className="group mt-6 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[.055] p-3 transition hover:border-primary/25 hover:bg-primary/[.085] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-medium text-foreground">Sangeet mixes</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">Curated listening paths</span>
            </span>
          </Link>
        )}
      </div>

      <div className={cn("shrink-0 border-t border-white/[.055] p-3", collapsed && "px-2")}>
        {isAuthenticated && session ? (
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <Link
              href="/profile"
              title={collapsed ? displayName : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-white/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                collapsed && "justify-center",
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-1 ring-white/10"
                style={{ background: avatarColor }}
              >
                {initials}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-foreground">{displayName}</span>
                  <span className="mt-0.5 block text-[9.5px] text-muted-foreground">{profile.plan}</span>
                </span>
              )}
            </Link>
            {!collapsed && (
              <>
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="w-full py-2 px-3 rounded-lg bg-white/[.06] hover:bg-white/[.12] text-xs font-semibold text-foreground transition text-center"
              >
                Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                title="Sign In"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[.06] text-xs font-semibold text-foreground transition"
              >
                in
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
