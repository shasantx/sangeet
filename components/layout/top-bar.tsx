"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { usePathname, useRouter } from "next/navigation";
import {
  ListMusic,
  LogOut,
  Menu,
  PanelRightClose,
  Search,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useUIStore, toast } from "@/store/ui-store";
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
  const isMobileHome = pathname === "/home";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/95 px-3 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8",
        isMobileHome && "hidden md:block",
      )}
    >
      <div className="flex min-h-[60px] w-full max-w-full min-w-0 items-center gap-1.5 sm:min-h-[68px] sm:gap-3">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileSidebarOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <Link
          href="/home"
          className="flex min-w-0 shrink-0 items-center gap-1.5 md:hidden"
          aria-label="Sangeet home"
        >
          <SangeetMark size={26} />
          <span className="mobile-brand-name font-display text-[15px] font-bold tracking-tight text-foreground">
            Sangeet
          </span>
        </Link>

        {/* Studio Search Bar */}
        <Link
          href="/search"
          className="group hidden h-10 w-full max-w-[440px] items-center gap-3 rounded-full border border-border bg-card px-4 text-xs text-muted-foreground transition hover:border-white/[0.16] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
          aria-label="Search Sangeet"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          <span className="truncate">Search artists, albums, tracks or songs…</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground xl:block">
            ⌘ K
          </kbd>
        </Link>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          >
            <Search className="h-[17px] w-[17px]" />
          </Link>

          <button
            type="button"
            onClick={toggleQueue}
            aria-label={queueOpen ? "Close queue" : "Open queue"}
            aria-pressed={queueOpen}
            className={cn(
              "relative hidden h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-[380px]:flex sm:h-9 sm:w-9",
              queueOpen && "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <ListMusic className="h-[17px] w-[17px]" />
            {currentTrackId && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleRightPanel}
            aria-label={rightPanelOpen ? "Hide now playing panel" : "Show now playing panel"}
            aria-pressed={rightPanelOpen}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:flex"
          >
            <PanelRightClose
              className={cn("h-[17px] w-[17px] transition-transform", !rightPanelOpen && "rotate-180")}
            />
          </button>

          {isAuthenticated && session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-0.5 flex min-h-10 items-center gap-1.5 rounded-full border border-border/80 bg-card p-1 transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:ml-1.5 sm:min-h-0 sm:gap-2"
                  aria-label="User account menu"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-1 ring-white/15"
                    style={{ background: avatarColor }}
                  >
                    {initials}
                  </span>
                  <span className="hidden max-w-[110px] truncate pr-2 text-xs font-medium text-foreground sm:block">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[220px] rounded-xl border-border bg-popover shadow-lg"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{session.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/profile")}>
                  <User className="mr-2 h-3.5 w-3.5" />
                  Profile & Library
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/settings")}>
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Settings
                </DropdownMenuItem>
                {session.isAdmin && (
                  <DropdownMenuItem
                    onSelect={() => router.push("/admin")}
                    className="text-primary focus:text-primary"
                  >
                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                    Admin Console
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleSignOut}
                  className="text-red-400 focus:text-red-300"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="ml-0.5 flex shrink-0 items-center gap-1.5 sm:ml-2 sm:gap-2">
              <Link
                href={`/auth?tab=signin&returnTo=${encodeURIComponent(pathname)}`}
                className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-[380px]:px-3 sm:px-3.5 sm:py-1.5 sm:text-xs"
              >
                Sign in
              </Link>
              <Link
                href={`/auth?tab=signup&returnTo=${encodeURIComponent(pathname)}`}
                aria-label="Create account"
                className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-[380px]:px-3 sm:px-4 sm:py-1.5 sm:text-xs"
              >
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create account</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {pathname}
      </span>
    </header>
  );
}
