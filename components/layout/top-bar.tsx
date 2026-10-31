"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { usePathname, useRouter } from "next/navigation";
import {
  ListMusic,
  Menu,
  LogOut,
  PanelRightClose,
  Search,
  Settings,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const toggleRightPanel = useAppStore((state) => state.toggleRightPanel);
  const queueOpen = useUIStore((state) => state.queuePanelOpen);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const toggleQueue = useUIStore((state) => state.toggleQueuePanel);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    signOut();
    toast.show("Signed out", "You can continue listening as a guest.", "default");
  };

  const displayName = session?.displayName || profile.name;
  const initials = session?.initials || profile.initials;
  const avatarColor = session?.avatarColor || profile.avatarColor;

  return (
    <header className="sticky top-0 z-30 flex h-[62px] items-center gap-3 border-b border-white/[.04] bg-[#101014] px-4 sm:h-[70px] sm:px-6 sm:backdrop-blur-2xl lg:px-8">
      <button type="button" onClick={toggleMobileSidebar} aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileSidebarOpen} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden">
        <Menu className="h-5 w-5" />
      </button>
      {/* Mobile Logo */}
      <Link href="/home" className="flex items-center gap-2 md:hidden" aria-label="Sangeet home">
        <SangeetMark size={30} />
        <span className="font-display text-[17px] font-bold tracking-tight text-white">Sangeet</span>
      </Link>

      {/* Search Input (Sangeet / YT Music pill style) */}
      <Link
        href="/search"
        className="group hidden h-10 w-full max-w-[420px] items-center gap-3 rounded-full border border-white/[.07] bg-white/[.035] px-4 text-xs text-muted-foreground transition hover:border-white/[.14] hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
        aria-label="Search Sangeet"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="truncate">Search artists, albums, tracks or songs…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-white/[.08] bg-black/30 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground/80 xl:block">
          ⌘ K
        </kbd>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/search"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </Link>

        {/* Queue button */}
        <button
          type="button"
          onClick={toggleQueue}
          aria-label={queueOpen ? "Close queue" : "Open queue"}
          aria-pressed={queueOpen}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            queueOpen && "bg-white/[.055] text-foreground",
          )}
        >
          <ListMusic className="h-[18px] w-[18px]" />
          {currentTrackId && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </button>

        {/* Right now-playing panel toggle */}
        <button
          type="button"
          onClick={toggleRightPanel}
          aria-label={rightPanelOpen ? "Hide now playing panel" : "Show now playing panel"}
          aria-pressed={rightPanelOpen}
          className="hidden h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:flex"
        >
          <PanelRightClose className={cn("h-[18px] w-[18px] transition-transform", !rightPanelOpen && "rotate-180")} />
        </button>

        {/* Authentication area (Sangeet Music style) */}
        {isAuthenticated && session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1.5 flex items-center gap-2 rounded-full p-1 transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="User account menu"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-md ring-1 ring-white/15"
                  style={{ background: avatarColor }}
                >
                  {initials}
                </span>
                <span className="hidden sm:block text-xs font-medium text-foreground max-w-[110px] truncate pr-2">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] bg-[#121218] border-white/[.1]">
              <div className="px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{session.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <User className="h-3.5 w-3.5 mr-2" />
                Profile & Library
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} className="text-red-400 focus:text-red-300">
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="ml-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAuthModal("signin")}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/80 hover:text-white transition hover:bg-white/[.06]"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="px-4 py-1.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-md transition active:scale-95"
            >
              Create account
            </button>
          </div>
        )}
      </div>

      <span className="sr-only" aria-live="polite">
        {pathname}
      </span>
    </header>
  );
}
