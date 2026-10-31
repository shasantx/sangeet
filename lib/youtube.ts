import type { Album, Artist, GenreId, Track } from "./types";

/**
 * Curated YouTube sessions.
 *
 * Playback happens through the official YouTube IFrame Player. We deliberately
 * do not scrape streams or extract audio, and no API key is required for the
 * embed. The Data API is not used, so search is limited to this curated set.
 */

export interface YouTubeSession {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  releaseDate: string;
  duration: number;
  genreIds: GenreId[];
  mood: string;
  description: string;
  artistBio: string;
  location: string;
  related: string[];
}

export const youtubeSessions: YouTubeSession[] = [
  {
    videoId: "u7K72X4eo_s",
    title: "Teardrop",
    artist: "Massive Attack",
    album: "Mezzanine",
    year: 1998,
    releaseDate: "1998-04-27",
    duration: 284,
    genreIds: ["downtempo", "electronic", "alternative"],
    mood: "Nocturnal trip-hop",
    description:
      "A slow, weightless trip-hop landmark built on a heartbeat pulse, hushed vocals and a harpsichord figure that never quite resolves.",
    artistBio:
      "Bristol collective Massive Attack helped define trip-hop with patient beats, dub bass and an unmistakable sense of dread and beauty.",
    location: "Bristol, UK",
    related: ["Bonobo", "Radiohead"],
  },
  {
    videoId: "S0Q4gqBUs7c",
    title: "Kerala",
    artist: "Bonobo",
    album: "Migration",
    year: 2016,
    releaseDate: "2016-11-11",
    duration: 243,
    genreIds: ["electronic", "downtempo", "ambient"],
    mood: "Floating and kinetic",
    description:
      "A patient, sample-rich build from Bonobo's Migration — warm keys, clipped vocals and a bassline that unfolds like a long drive home.",
    artistBio:
      "Simon Green records as Bonobo, blending downtempo, house and live instrumentation into widescreen, deeply physical electronic music.",
    location: "London, UK",
    related: ["ODESZA", "M83"],
  },
  {
    videoId: "xarC5jAiO7w",
    title: "A Moment Apart",
    artist: "ODESZA",
    album: "A Moment Apart",
    year: 2017,
    releaseDate: "2017-09-08",
    duration: 234,
    genreIds: ["electronic", "cinematic"],
    mood: "Widescreen and euphoric",
    description:
      "The title track from ODESZA's third record: brass, chopped vocals and a slow-blooming drop that feels like a horizon opening up.",
    artistBio:
      "Seattle duo ODESZA make cinematic electronic music built for festival sunsets and long, luminous drives.",
    location: "Seattle, US",
    related: ["Bonobo", "Flume"],
  },
  {
    videoId: "dX3k_QDnzHE",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    year: 2011,
    releaseDate: "2011-10-18",
    duration: 243,
    genreIds: ["electronic", "indie", "cinematic"],
    mood: "Neon and nostalgic",
    description:
      "Synth-pop maximalism with a saxophone finale, 'Midnight City' is a widescreen memory of a night that may never have happened.",
    artistBio:
      "Anthony Gonzalez's M83 project makes expansive, dreamlike electronic music that treats nostalgia as a physical material.",
    location: "Antibes, FR",
    related: ["ODESZA", "M83"],
  },
  {
    videoId: "4NRXx6U8ABQ",
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    year: 2020,
    releaseDate: "2019-11-29",
    duration: 263,
    genreIds: ["electronic", "soul", "alternative"],
    mood: "Neon and restless",
    description:
      "A chrome-plated synth-pop rush built on gated drums, a sawtooth riff and Abel Tesfaye's most direct vocal — a late-night drive that never quite reaches home.",
    artistBio:
      "Canadian singer, songwriter and producer Abel Tesfaye records as The Weeknd, merging R&B, synth-pop and cinematic production into one of the defining pop voices of the 2020s.",
    location: "Toronto, CA",
    related: ["Daft Punk", "M83"],
  },
  {
    videoId: "TWcyIpul8OE",
    title: "Holocene",
    artist: "Bon Iver",
    album: "Bon Iver, Bon Iver",
    year: 2011,
    releaseDate: "2011-06-21",
    duration: 344,
    genreIds: ["indie", "alternative", "cinematic"],
    mood: "Wide-open and tender",
    description:
      "A slow, brass-lit meditation on distance and belonging, recorded with a full band in a converted Wisconsin studio.",
    artistBio:
      "Justin Vernon's Bon Iver began as a solitary winter project and grew into one of the most distinctive voices in modern indie folk.",
    location: "Eau Claire, US",
    related: ["James Blake", "Radiohead"],
  },
  {
    videoId: "XFkzRNyygfk",
    title: "Creep",
    artist: "Radiohead",
    album: "Pablo Honey",
    year: 1993,
    releaseDate: "1993-02-22",
    duration: 237,
    genreIds: ["alternative", "indie"],
    mood: "Raw and restless",
    description:
      "The song that introduced Radiohead: a self-lacerating alt-rock anthem with a guitar crunch that still lands decades later.",
    artistBio:
      "Oxford five-piece Radiohead began as a guitar band and steadily became one of the most restless and influential groups in modern music.",
    location: "Oxford, UK",
    related: ["Massive Attack", "James Blake"],
  },
  {
    videoId: "k4V3Mo61fJM",
    title: "Fix You",
    artist: "Coldplay",
    album: "X&Y",
    year: 2005,
    releaseDate: "2005-06-06",
    duration: 294,
    genreIds: ["alternative", "indie"],
    mood: "Slow-building and hopeful",
    description:
      "A church-organ elegy that builds into one of Coldplay's most cathartic choruses, written as a quiet promise to someone hurting.",
    artistBio:
      "Coldplay formed in London in 1996 and became one of the biggest bands in the world by pairing arena-scale songs with plain-spoken emotion.",
    location: "London, UK",
    related: ["Radiohead", "Bon Iver"],
  },
  {
    videoId: "5NV6Rdv1a3I",
    title: "Get Lucky",
    artist: "Daft Punk",
    album: "Random Access Memories",
    year: 2013,
    releaseDate: "2013-05-17",
    duration: 249,
    genreIds: ["electronic", "soul"],
    mood: "Sleek and sunlit",
    description:
      "Nile Rodgers' guitar, Pharrell's falsetto and a patient groove — Daft Punk's love letter to late-1970s studio craft.",
    artistBio:
      "French duo Daft Punk spent three decades reshaping electronic music with masks, filters and an obsessive relationship to the studio.",
    location: "Paris, FR",
    related: ["M83", "Flume"],
  },
  {
    videoId: "Ly7uj0JwgKg",
    title: "Never Be Like You",
    artist: "Flume",
    album: "Skin",
    year: 2016,
    releaseDate: "2016-05-27",
    duration: 233,
    genreIds: ["electronic", "alternative"],
    mood: "Bright and fractured",
    description:
      "Kai's vocal floats over Flume's stop-start production — a future-bass anthem that turns heartbreak into something weightless.",
    artistBio:
      "Australian producer Flume makes restlessly detailed electronic pop, full of odd samples, sudden silences and enormous low end.",
    location: "Sydney, AU",
    related: ["ODESZA", "James Blake"],
  },
  {
    videoId: "yKNxeF4KMsY",
    title: "Yellow",
    artist: "Coldplay",
    album: "Parachutes",
    year: 2000,
    releaseDate: "2000-06-26",
    duration: 272,
    genreIds: ["indie", "alternative"],
    mood: "Open-hearted and quiet",
    description:
      "A tender, reverb-soaked love song from Coldplay's debut, all slow-build guitars and stars in the sky.",
    artistBio:
      "Coldplay formed in London in 1996 and became one of the biggest bands in the world by pairing arena-scale songs with plain-spoken emotion.",
    location: "London, UK",
    related: ["Radiohead", "Bon Iver"],
  },
  {
    videoId: "fJ9rUzIMcZQ",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    year: 1975,
    releaseDate: "1975-10-31",
    duration: 359,
    genreIds: ["alternative", "cinematic"],
    mood: "Theatrical and timeless",
    description:
      "A six-minute suite of ballad, opera and hard rock that broke every rule of mid-1970s radio and became one of the most enduring songs ever recorded.",
    artistBio:
      "Queen merged rock, opera and vaudeville around Freddie Mercury's voice and Brian May's guitar, becoming one of Britain's defining bands.",
    location: "London, UK",
    related: ["Coldplay", "Radiohead"],
  },
  {
    videoId: "djV11Xbc914",
    title: "Take On Me",
    artist: "a-ha",
    album: "Hunting High and Low",
    year: 1985,
    releaseDate: "1985-10-19",
    duration: 244,
    genreIds: ["electronic", "alternative"],
    mood: "Bright and cinematic",
    description:
      "A synth-pop rush with one of the most recognisable choruses of the 1980s, matched by an animated video that became a pop-culture landmark.",
    artistBio:
      "Norwegian trio a-ha combined new-wave synths, Morten Harket's soaring voice and a genuinely inventive visual identity.",
    location: "Oslo, NO",
    related: ["M83", "Daft Punk"],
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const youtubeArtwork = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const artistId = (name: string) => `yt-artist-${slugify(name)}`;
const albumId = (session: YouTubeSession) => `yt-album-${session.videoId}`;
const trackId = (session: YouTubeSession) => `yt-${session.videoId}`;

const uniqueSessionsByArtist = Array.from(
  youtubeSessions.reduce((map, session) => {
    if (!map.has(session.artist)) map.set(session.artist, session);
    return map;
  }, new Map<string, YouTubeSession>()),
).map(([, session]) => session);

export const youtubeArtists: Artist[] = uniqueSessionsByArtist.map((session) => ({
  id: artistId(session.artist),
  name: session.artist,
  bio: session.artistBio,
  shortBio: session.artistBio.split(".")[0] + ".",
  image: youtubeArtwork(session.videoId),
  location: session.location,
  genreIds: session.genreIds,
  relatedArtistIds: session.related
    .filter((name) => name !== session.artist)
    .map((name) => artistId(name)),
}));

export const youtubeAlbums: Album[] = youtubeSessions.map((session) => ({
  id: albumId(session),
  title: session.album,
  artistId: artistId(session.artist),
  year: session.year,
  releaseDate: session.releaseDate,
  type: "Album",
  artwork: youtubeArtwork(session.videoId),
  genreIds: session.genreIds,
  description: session.description,
  trackIds: [trackId(session)],
}));

export const youtubeTracks: Track[] = youtubeSessions.map((session) => ({
  id: trackId(session),
  title: session.title,
  artistId: artistId(session.artist),
  albumId: albumId(session),
  duration: session.duration,
  audioUrl: "",
  artwork: youtubeArtwork(session.videoId),
  genreIds: session.genreIds,
  mood: session.mood,
  trackNumber: 1,
  source: "youtube",
  youtubeId: session.videoId,
}));

export const youtubeTrackIds = youtubeTracks.map((track) => track.id);

export function isYouTubeTrackId(id: string | null | undefined): boolean {
  return Boolean(id && youtubeTracks.some((track) => track.id === id));
}
