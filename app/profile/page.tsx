"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Disc3,
  Heart,
  ListMusic,
  LogOut,
  Pencil,
  Settings2,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import {
  albums,
  artists,
  getGenre,
  getTracks,
} from "@/lib/catalog";
import { formatTotalDuration, pluralize } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import { Artwork } from "@/components/music/artwork";
import { ArtistCard } from "@/components/music/artist-card";
import { AlbumCard } from "@/components/music/album-card";
import { PlaylistCard } from "@/components/music/playlist-card";
import { QuickTrackTile } from "@/components/music/quick-track-tile";
import { SectionHeader } from "@/components/music/section-header";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const signOut = useAppStore((state) => state.signOut);
  const resetPlayer = usePlayerStore((state) => state.resetPlayer);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const authSignOut = useAuthStore((state) => state.signOut);
  const updateAuthProfile = useAuthStore((state) => state.updateProfile);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const likedTrackIds = useLibraryStore((state) => state.likedTrackIds);
  const savedAlbumIds = useLibraryStore((state) => state.savedAlbumIds);
  const followedArtistIds = useLibraryStore((state) => state.followedArtistIds);
  const playlists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);

  const [editOpen, setEditOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [draftHandle, setDraftHandle] = useState(profile.handle.replace(/^@/, ""));
  const [nameError, setNameError] = useState("");

  const likedTracks = getTracks(likedTrackIds);
  const savedAlbums = savedAlbumIds
    .map((albumId) => albums.find((album) => album.id === albumId))
    .filter((album): album is NonNullable<typeof album> => Boolean(album));
  const followedArtists = followedArtistIds
    .map((artistId) => artists.find((artist) => artist.id === artistId))
    .filter((artist): artist is NonNullable<typeof artist> => Boolean(artist));
  const recentTracks = getTracks(recentlyPlayed.slice(0, 5));
  const likedDuration = likedTracks.reduce((total, track) => total + track.duration, 0);
  const savedDuration = savedAlbums.reduce((total, album) => {
    return total + getTracks(album.trackIds).reduce((sum, track) => sum + track.duration, 0);
  }, 0);

  const genreCounts = new Map<string, number>();
  likedTracks.forEach((track) => {
    track.genreIds.forEach((genreId) => {
      genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + 1);
    });
  });
  const topGenres = Array.from(genreCounts.entries())
    .map(([genreId, count]) => ({ genre: getGenre(genreId), count }))
    .filter((item): item is { genre: NonNullable<ReturnType<typeof getGenre>>; count: number } =>
      Boolean(item.genre),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const maxGenreCount = topGenres[0]?.count ?? 1;

  const stats = [
    {
      href: "/liked",
      label: "Liked songs",
      value: likedTrackIds.length,
      detail: formatTotalDuration(likedDuration),
      icon: Heart,
    },
    {
      href: "/library",
      label: "Playlists",
      value: playlists.length,
      detail: "Made by you",
      icon: ListMusic,
    },
    {
      href: "/library",
      label: "Following",
      value: followedArtistIds.length,
      detail: "Artists",
      icon: Users,
    },
    {
      href: "/library",
      label: "Saved albums",
      value: savedAlbums.length,
      detail: formatTotalDuration(savedDuration),
      icon: Disc3,
    },
  ];

  const openEdit = () => {
    setDraftName(profile.name);
    setDraftHandle(profile.handle.replace(/^@/, ""));
    setNameError("");
    setEditOpen(true);
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftName.trim()) {
      setNameError("Your display name cannot be empty.");
      return;
    }
    setProfile(draftName, draftHandle);
    updateAuthProfile(draftName);
    setEditOpen(false);
    toast.success("Profile updated", "Your profile details have been saved.");
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    authSignOut();
    signOut();
    resetPlayer();
    toast.info("Signed out", "You can keep listening as a guest or sign in with Google again.");
    router.replace("/welcome");
  };

  return (
    <div className="page-container">
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
        <div
          className="absolute inset-0 -z-20"
          style={{
            background: `radial-gradient(ellipse at 15% 0%, ${profile.avatarColor}30, transparent 55%), linear-gradient(120deg, hsl(var(--background) / .6), hsl(var(--surface) / .7))`,
          }}
        />
        <div className="absolute -right-24 -top-32 -z-10 h-[420px] w-[420px] rounded-full bg-primary/[.12] blur-[120px]" />

        <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end lg:gap-8 lg:p-10">
          <div className="relative w-fit shrink-0">
            <div
              className="flex h-[112px] w-[112px] items-center justify-center rounded-full font-display text-[36px] font-semibold text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,.9)] ring-1 ring-white/15 sm:h-[132px] sm:w-[132px] sm:text-[42px]"
              style={{ background: session?.avatarColor ?? profile.avatarColor }}
            >
              {session?.initials ?? profile.initials}
            </div>
            <span className="absolute -bottom-1 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/[.08] bg-[#121218] text-primary shadow-lg">
              <UserRound className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow text-foreground/55">Your profile</span>
              <span className="rounded-full border border-primary/25 bg-primary/[.09] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
                {isAuthenticated ? "Google account" : "Guest mode"}
              </span>
              {session?.email && (
                <span className="text-[11px] text-muted-foreground/80">
                  ({session.email})
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px] lg:text-[58px]">
              {session?.displayName || profile.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{isAuthenticated ? "Connected with Google" : "Stored on this device"}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                {isAuthenticated ? "Google sign-in" : "This device"}
              </span>
              <span className="text-muted-foreground/35">·</span>
              <span>{profile.plan}</span>
              <span className="text-muted-foreground/35">·</span>
              <span>{pluralize(likedTrackIds.length, "liked song")}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-secondary transition"
              >
                Sign In
              </button>
            )}
            {!isAuthenticated && <button
              type="button"
              onClick={openEdit}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.03] px-4 text-xs font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </button>}
            <Link
              href="/settings"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.03] px-4 text-xs font-medium text-foreground transition hover:border-white/[.18] hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              aria-label="Sign out of Sangeet"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[.08] text-muted-foreground transition hover:border-white/[.16] hover:bg-white/[.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/[.05] bg-white/[.015] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p>{isAuthenticated
          ? "Your Google account authenticates your Sangeet profile. Likes, playlists, and listening history are currently stored only in this browser."
          : "You are listening as a guest. Your likes, playlists, and listening history are stored only in this browser. Sign in with Google to connect an account profile."}</p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl border border-white/[.055] bg-white/[.018] p-4 transition hover:border-white/[.11] hover:bg-white/[.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 transition group-hover:text-foreground" />
              </div>
              <p className="mt-4 font-display text-[28px] font-medium leading-none tracking-[-0.04em]">
                {stat.value}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-foreground/75">{stat.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{stat.detail}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <section>
            <SectionHeader
              title="Recently played"
              eyebrow="Back to it"
              href="/recently-played"
              linkLabel="Full history"
            />
            {recentTracks.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {recentTracks.map((track) => (
                  <QuickTrackTile
                    key={track.id}
                    track={track}
                    contextIds={recentlyPlayed.slice(0, 12)}
                    contextLabel="Recently played"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[.08] bg-white/[.012] p-8 text-center">
                <Clock3 className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">Your listening history is empty.</p>
                <Link
                  href="/home"
                  className="mt-3 inline-flex text-xs font-medium text-primary transition hover:text-secondary"
                >
                  Find something to play
                </Link>
              </div>
            )}
          </section>

          <section className="section-space">
            <SectionHeader
              title="Your playlists"
              eyebrow="Made by you"
              href="/library"
              linkLabel="View library"
            />
            {playlists.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
                {playlists.slice(0, 3).map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[.08] bg-white/[.012] p-8 text-center">
                <ListMusic className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">No playlists yet.</p>
                <Link
                  href="/library"
                  className="mt-3 inline-flex text-xs font-medium text-primary transition hover:text-secondary"
                >
                  Create your first playlist
                </Link>
              </div>
            )}
          </section>

          <section className="section-space pb-2">
            <SectionHeader
              title="Saved albums"
              eyebrow="On your shelf"
              href="/library"
              linkLabel="View all"
            />
            {savedAlbums.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
                {savedAlbums.slice(0, 3).map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[.08] bg-white/[.012] p-8 text-center">
                <Disc3 className="mx-auto h-5 w-5 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">No saved albums yet.</p>
                <Link
                  href="/explore"
                  className="mt-3 inline-flex text-xs font-medium text-primary transition hover:text-secondary"
                >
                  Explore albums
                </Link>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Listening snapshot</p>
              <span className="rounded-full border border-white/[.07] px-2 py-0.5 text-[8px] uppercase tracking-[0.1em] text-muted-foreground/60">
                Local
              </span>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Liked runtime</span>
                <span>{formatTotalDuration(likedDuration)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Saved runtime</span>
                <span>{formatTotalDuration(savedDuration)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tracks in history</span>
                <span className="tabular-nums">{recentlyPlayed.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Playlists</span>
                <span className="tabular-nums">{playlists.length}</span>
              </div>
            </div>
            <div className="mt-5 border-t border-white/[.06] pt-4">
              <p className="eyebrow mb-3">Top genres</p>
              {topGenres.length > 0 ? (
                <div className="space-y-3">
                  {topGenres.map(({ genre, count }) => (
                    <Link key={genre.id} href={`/genre/${genre.id}`} className="group block">
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="truncate text-muted-foreground transition group-hover:text-foreground">
                          {genre.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground/50">{count}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[.07]">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500 group-hover:bg-primary"
                          style={{ width: `${Math.max(12, (count / maxGenreCount) * 100)}%` }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Like a few songs and your genre mix will appear here.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[.055] bg-surface/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Artists in your orbit</p>
              <Link
                href="/library"
                className="text-[10px] text-muted-foreground transition hover:text-foreground"
              >
                View all
              </Link>
            </div>
            {followedArtists.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {followedArtists.slice(0, 6).map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} showFollow={false} />
                ))}
              </div>
            ) : (
              <div className="mt-4 text-center">
                <Users className="mx-auto h-5 w-5 text-muted-foreground/40" />
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Follow an artist to keep their records close.
                </p>
                <Link
                  href="/explore"
                  className="mt-3 inline-flex text-[11px] font-medium text-primary transition hover:text-secondary"
                >
                  Find artists
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/settings"
            className="group flex items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.018] p-4 transition hover:border-white/[.11] hover:bg-white/[.035]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium">Tune your experience</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Appearance, playback and local data
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/35 transition group-hover:text-foreground" />
          </Link>

          <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-5">
            <p className="eyebrow">About this profile</p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Your library stays on this device. Sign in with Google to connect your profile.
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-white/[.06] pt-4 text-[10px] text-muted-foreground/60">
              <Artwork src="/sangeet-mark.svg" alt="" className="h-5 w-5 rounded-md" />
              Sangeet · Music beyond boundaries
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) setNameError("");
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit your profile</DialogTitle>
            <DialogDescription>
              This updates your local listener profile on this device.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium">Display name</span>
              <Input
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                  if (nameError) setNameError("");
                }}
                maxLength={40}
                placeholder="Your name"
                autoFocus
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "profile-name-error" : undefined}
              />
              {nameError && (
                <span id="profile-name-error" className="mt-1.5 block text-[11px] text-[#f0a0a8]">
                  {nameError}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium">
                Handle <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  value={draftHandle}
                  onChange={(event) => setDraftHandle(event.target.value.replace(/^@/, ""))}
                  maxLength={24}
                  placeholder="yourhandle"
                  className="pl-8"
                />
              </div>
              <span className="mt-1.5 block text-[10px] text-muted-foreground">
                Leave blank to build one from your display name.
              </span>
            </label>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm text-foreground transition hover:border-white/20 hover:bg-white/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Save profile
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Sangeet?</AlertDialogTitle>
            <AlertDialogDescription>
              You will return to the welcome screen and playback will stop. Your likes, playlists
              and history stay saved in this browser for your next visit.
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
