import Link from "next/link";
import { ArrowUpRight, AudioLines, Radio, Sparkles } from "lucide-react";
import { artists, getArtist, getArtistTracks, getTracks, playlists } from "@/lib/catalog";
import { dailyMixes } from "@/lib/mixes";
import { Artwork } from "@/components/music/artwork";
import { CollectionPlayButton, CollectionShuffleButton } from "@/components/music/collection-actions";
import { MixCard } from "@/components/music/mix-card";
import { PlayButton } from "@/components/music/play-button";
import { SectionHeader } from "@/components/music/section-header";
import { TrackList } from "@/components/music/track-list";

export const metadata = {
  title: "Sangeet mixes",
  description: "Curated mixes and artist selections from the bundled catalog.",
};

const radioArtists = artists.slice(0, 6);
const lateNightIds = ["t01", "t02", "t28", "t34", "t07", "t10", "t25", "t39"];
const lateNightTracks = getTracks(lateNightIds);
const discoverIds = ["t13", "t31", "t22", "t16", "t36", "t19", "t33", "t24"];
const featuredMix = dailyMixes[0];

export default function MadeForYouPage() {
  return (
    <div className="page-container">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Curated listening</p>
          <h1 className="text-[38px] font-medium leading-none tracking-[-0.05em] sm:text-[52px]">
            Sangeet mixes
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Curated listening paths and artist selections from the bundled catalog.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-white/[.07] bg-white/[.03] px-4 py-2.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Curated catalog picks
        </div>
      </div>

      {featuredMix && (
        <section className="grid gap-4 lg:grid-cols-[1.28fr_.72fr]">
          <MixCard mix={featuredMix} featured />
          <div className="relative isolate overflow-hidden rounded-xl border border-white/[.06] bg-surface p-6 sm:p-7">
            <div className="absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-primary/15 blur-[90px]" />
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" />
              Sangeet Radio
            </div>
            <h2 className="mt-5 font-display text-[30px] font-medium leading-none tracking-[-0.04em] sm:text-[36px]">
              The Late Set
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              A short selection for the small hours: soul, ambient and slow-motion electronics,
              arranged as a ready-to-play queue.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <CollectionPlayButton trackIds={lateNightIds} label="The Late Set" size="default" />
              <CollectionShuffleButton
                trackIds={lateNightIds}
                label="The Late Set"
                className="h-10 px-4 text-xs"
              />
            </div>
            <div className="mt-7 border-t border-white/[.06] pt-4">
              <div className="flex items-center gap-2.5">
                <AudioLines className="h-4 w-4 text-primary" />
                <p className="text-[11px] text-muted-foreground">On air · {lateNightTracks.length} tracks</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {Array.from(new Set(lateNightTracks.map((track) => track.artwork)))
                  .slice(0, 4)
                  .map((artwork) => (
                    <Artwork key={artwork} src={artwork} alt="" className="aspect-square rounded-md" />
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section-space">
        <SectionHeader
          title="Curated mixes"
          eyebrow="Six ways in"
          description="A few different moods from the bundled sample catalog."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dailyMixes.map((mix) => (
            <MixCard key={mix.id} mix={mix} />
          ))}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="Artist selections"
          eyebrow="Stay a while"
          description="Pick an artist and play tracks from their catalog."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {radioArtists.map((artist) => {
            const artistTracks = getArtistTracks(artist.id);
            return (
              <article
                key={artist.id}
                className="group relative isolate overflow-hidden rounded-xl border border-white/[.055] bg-surface/70 p-5 transition-colors hover:border-white/[.11]"
              >
                <div
                  className="absolute -left-12 -top-16 -z-10 h-44 w-44 rounded-full opacity-[.14] blur-[60px] transition-opacity group-hover:opacity-[.22]"
                  style={{ background: artist.image ? "#8B5CF6" : "#8B5CF6" }}
                />
                <div className="flex items-start gap-3">
                  <Link href={`/artist/${artist.id}`} className="shrink-0">
                    <Artwork
                      src={artist.image}
                      alt={`${artist.name} portrait`}
                      className="h-14 w-14 rounded-full"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                      Artist selection
                    </p>
                    <Link
                      href={`/artist/${artist.id}`}
                      className="mt-1 block truncate font-display text-xl font-medium tracking-[-0.03em] transition hover:underline"
                    >
                      {artist.name}
                    </Link>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {artist.shortBio}
                    </p>
                  </div>
                  <PlayButton
                    trackIds={artistTracks.map((track) => track.id)}
                    label={`${artist.name} selection`}
                    size="sm"
                    className="opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground/65">
                  <span>{artistTracks.length} tracks</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span>{artist.genreIds.slice(0, 2).map((id) => id[0].toUpperCase() + id.slice(1)).join(" · ")}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader
          title="Because you keep coming back"
          eyebrow="A quiet recommendation"
          description="A few records that share a room with the music already in your library."
          href="/explore"
          linkLabel="Explore more"
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
          <div className="rounded-xl border border-white/[.045] bg-white/[.012] px-2 py-3 sm:px-3">
            <TrackList trackIds={discoverIds} label="Because you keep coming back" showAlbum />
          </div>
          <div className="rounded-xl border border-white/[.055] bg-surface/60 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Sangeet note</p>
              <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                Local demo
              </span>
            </div>
            <h3 className="mt-4 font-display text-2xl font-medium leading-tight tracking-[-0.035em]">
              Tuned to the edges of your taste.
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Recommendations here are built from the catalogue and your local likes. Nothing leaves
              this browser, and no listening data is sent anywhere.
            </p>
            <div className="mt-5 space-y-2.5 border-t border-white/[.06] pt-4">
              {lateNightTracks.slice(0, 3).map((track) => (
                <Link
                  key={track.id}
                  href={`/album/${track.albumId}`}
                  className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-white/[.04]"
                >
                  <Artwork src={track.artwork} alt="" className="h-9 w-9 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">{track.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {getArtist(track.artistId)?.name}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground/45" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-space pb-2">
        <SectionHeader title="More editorial" eyebrow="Browse the collection" href="/explore" linkLabel="Explore" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {playlists.slice(0, 4).map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="group flex items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.018] p-3 transition hover:border-white/[.11] hover:bg-white/[.035]"
            >
              <Artwork src={playlist.artwork} alt="" className="h-14 w-14 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{playlist.title}</span>
                <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                  {playlist.curator}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35 transition group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
