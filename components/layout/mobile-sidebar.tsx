"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, Compass, CreditCard, Heart, Home, Library, Plus, Search, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { useUIStore } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { SangeetMark } from "@/components/brand/sangeet-mark";

const links = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/plans", label: "Plans", icon: CreditCard },
  { href: "/library", label: "Your Library", icon: Library },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/recently-played", label: "Recently Played", icon: Clock3 },
];

export function MobileSidebar() {
  const pathname = usePathname();
  const open = useUIStore((state) => state.mobileSidebarOpen);
  const setOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const openCreate = useUIStore((state) => state.openCreatePlaylist);
  const playlists = useLibraryStore((state) => state.playlists);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const session = useAuthStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);

  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="mobile-sidebar-layer md:hidden">
      <button type="button" className="mobile-sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />
      <aside className="mobile-sidebar-panel" role="dialog" aria-modal="true" aria-label="Sangeet navigation">
        <div className="flex h-[68px] items-center justify-between border-b border-white/[.07] px-5">
          <Link href="/home" className="flex items-center gap-3 font-display text-lg font-semibold text-white">
            <SangeetMark size={38} />
            Sangeet
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 transition hover:bg-white/[.07] hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition", active ? "bg-white/[.09] text-white" : "text-white/60 hover:bg-white/[.05] hover:text-white")}>
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-white/45")} />{label}
            </Link>;
          })}
          <div className="mb-2 mt-6 flex items-center justify-between px-3"><span className="eyebrow">Playlists</span><button type="button" aria-label="Create playlist" onClick={() => { setOpen(false); openCreate(); }} className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[.07] hover:text-white"><Plus className="h-4 w-4" /></button></div>
          {playlists.slice(0, 10).map((playlist) => <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/[.05] hover:text-white">
            <Artwork src={playlist.artwork} alt="" className="h-9 w-9 shrink-0 rounded-md" /><span className="truncate">{playlist.title}</span>
          </Link>)}
          <button type="button" onClick={() => { setOpen(false); openCreate(); }} className="mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/55 hover:bg-white/[.05] hover:text-white"><Plus className="h-[18px] w-[18px]" />Create playlist</button>
        </nav>
        <div className="border-t border-white/[.07] p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          {session ? <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[.05]">
            {session.picture ? <img src={session.picture} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-black">{session.initials}</span>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{session.displayName}</span><span className="block truncate text-xs text-white/45">View profile</span></span><Settings2 className="h-4 w-4 text-white/45" />
          </Link> : <button type="button" onClick={() => { setOpen(false); openAuthModal("signin"); }} className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-black transition hover:brightness-110">Sign in</button>}
          {!session && <p className="mt-2 text-center text-[10px] text-white/35">{profile.name ? `Continue as ${profile.name}` : "Your music, your library"}</p>}
        </div>
      </aside>
    </div>
  );
}
