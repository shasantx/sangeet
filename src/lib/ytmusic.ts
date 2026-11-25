import type {
  AlbumSummary,
  ArtistSummary,
  HomeShelf,
  SearchResult,
  Track
} from "@/types/music";
import { parseDurationToSeconds } from "@/lib/utils";

const YTMUSIC_BASE = "https://music.youtube.com/youtubei/v1";

const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20250219.01.00",
    hl: "en",
    gl: "US"
  }
};

const INNERTUBE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Origin: "https://music.youtube.com",
  Referer: "https://music.youtube.com/"
};

export function upscaleThumbnail(url?: string, videoId?: string): string {
  if (!url) {
    return videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
  }
  if (url.includes("lh3.googleusercontent.com")) {
    return url.replace(/=w\d+-h\d+[^&]*/i, "=w544-h544-l90-rj");
  }
  if (url.includes("i.ytimg.com") && videoId) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ytFetch(endpoint: string, body: Record<string, any>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${YTMUSIC_BASE}/${endpoint}?prettyPrint=false`, {
        method: "POST",
        headers: INNERTUBE_HEADERS,
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          ...body
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(9_000)
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) continue;
        throw new Error(`YouTube Music API error ${res.status}`);
      }
      return res.json();
    } catch (err) {
      lastError = err;
      if (attempt === 0) continue;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("YouTube Music API request failed");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRunsText(runs?: any[]): string {
  if (!Array.isArray(runs)) return "";
  return runs.map((r) => r?.text ?? "").join("").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestThumbnail(thumbs?: any[]): string | undefined {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return undefined;
  return thumbs[thumbs.length - 1]?.url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTrackFromResponsiveItem(item: any): Track | null {
  const videoId: string | undefined =
    item?.playlistItemData?.videoId ??
    item?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ??
    item?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

  if (!videoId) return null;

  const titleRuns =
    item?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
  const title = getRunsText(titleRuns);
  if (!title) return null;

  const subtitleRuns =
    item?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs ?? [];

  let artist = "Unknown Artist";
  let artistId: string | undefined;
  let album: string | undefined;
  let albumId: string | undefined;
  let durationText = "";
  let plays: string | undefined;

  for (const run of subtitleRuns) {
    const text: string = (run?.text ?? "").trim();
    if (!text || text === "•" || text === "Song" || text === "Video") continue;

    const browseId: string | undefined =
      run?.navigationEndpoint?.browseEndpoint?.browseId;
    const pageType: string | undefined =
      run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
        ?.browseEndpointContextMusicConfig?.pageType;

    if (
      pageType === "MUSIC_PAGE_TYPE_ARTIST" ||
      (browseId && browseId.startsWith("UC"))
    ) {
      if (artist === "Unknown Artist") {
        artist = text;
        artistId = browseId;
      } else {
        artist = `${artist}, ${text}`;
      }
      continue;
    }

    if (
      pageType === "MUSIC_PAGE_TYPE_ALBUM" ||
      (browseId && browseId.startsWith("MPREb_"))
    ) {
      album = text;
      albumId = browseId;
      continue;
    }

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
      durationText = text;
      continue;
    }

    if (/plays|views/i.test(text)) {
      plays = text;
      continue;
    }

    if (artist === "Unknown Artist" && text.length > 1) {
      artist = text;
    }
  }

  const fixedDurationRuns =
    item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text
      ?.runs;
  if (!durationText && fixedDurationRuns) {
    durationText = getRunsText(fixedDurationRuns);
  }

  const thumbUrl = pickBestThumbnail(
    item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  );

  const explicit = Array.isArray(item?.badges)
    ? item.badges.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (b: any) =>
          b?.musicInlineBadgeRenderer?.icon?.iconType === "MUSIC_EXPLICIT_BADGE"
      )
    : false;

  return {
    id: videoId,
    title,
    artist,
    artistId,
    album,
    albumId,
    duration: parseDurationToSeconds(durationText),
    durationText: durationText || "3:30",
    thumbnail: upscaleThumbnail(thumbUrl, videoId),
    explicit,
    plays
  };
}

export async function searchYouTubeMusic(query: string): Promise<SearchResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { query: "", topResult: null, tracks: [], artists: [], albums: [] };
  }

  // Run parallel song, artist, album, and unfiltered searches for rich results
  const [songsData, allData, artistsData, albumsData] = await Promise.all([
    ytFetch("search", {
      query: cleanQuery,
      params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D" // Songs
    }).catch(() => null),
    ytFetch("search", { query: cleanQuery }).catch(() => null),
    ytFetch("search", {
      query: cleanQuery,
      params: "EgWKAQIgAWoKEAkQBRAKEAMQBA%3D%3D" // Artists
    }).catch(() => null),
    ytFetch("search", {
      query: cleanQuery,
      params: "EgWKAQIYAWoKEAkQBRAKEAMQBA%3D%3D" // Albums
    }).catch(() => null)
  ]);

  const tracks: Track[] = [];
  const artists: ArtistSummary[] = [];
  const albums: AlbumSummary[] = [];
  const seenTrackIds = new Set<string>();
  const seenArtistIds = new Set<string>();
  const seenAlbumIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractSections = (data: any) =>
    data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents ?? [];

  for (const section of extractSections(songsData)) {
    const items = section?.musicShelfRenderer?.contents ?? [];
    for (const entry of items) {
      const renderer = entry?.musicResponsiveListItemRenderer;
      if (!renderer) continue;
      const track = parseTrackFromResponsiveItem(renderer);
      if (track && !seenTrackIds.has(track.id)) {
        seenTrackIds.add(track.id);
        tracks.push(track);
      }
    }
  }

  for (const section of extractSections(allData)) {
    // Top result card
    const card = section?.musicCardShelfRenderer;
    if (card) {
      const videoId =
        card?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ??
        card?.onTap?.watchEndpoint?.videoId;
      if (videoId && !seenTrackIds.has(videoId)) {
        const title = getRunsText(card?.title?.runs);
        const subtitle = getRunsText(card?.subtitle?.runs);
        const parts = subtitle.split("•").map((s: string) => s.trim());
        const thumb = pickBestThumbnail(
          card?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
        );
        const topTrack: Track = {
          id: videoId,
          title: title || cleanQuery,
          artist: parts[1] || parts[0] || "Artist",
          duration: 0,
          durationText: "3:30",
          thumbnail: upscaleThumbnail(thumb, videoId)
        };
        seenTrackIds.add(videoId);
        tracks.unshift(topTrack);
      }
    }

    const shelf = section?.musicShelfRenderer;
    if (!shelf) continue;
    const shelfTitle = getRunsText(shelf?.title?.runs).toLowerCase();
    const items = shelf?.contents ?? [];

    for (const entry of items) {
      const r = entry?.musicResponsiveListItemRenderer;
      if (!r) continue;

      const browseId: string | undefined =
        r?.navigationEndpoint?.browseEndpoint?.browseId;
      const pageType: string | undefined =
        r?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType;
      const title = getRunsText(
        r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const subtitle = getRunsText(
        r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const thumb = pickBestThumbnail(
        r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );

      if (
        (shelfTitle.includes("artist") ||
          pageType === "MUSIC_PAGE_TYPE_ARTIST") &&
        browseId &&
        !seenArtistIds.has(browseId)
      ) {
        seenArtistIds.add(browseId);
        artists.push({
          id: browseId,
          name: title,
          thumbnail: upscaleThumbnail(thumb),
          subscribers: subtitle.replace(/^Artist\s*•\s*/i, "")
        });
      } else if (
        (shelfTitle.includes("album") ||
          pageType === "MUSIC_PAGE_TYPE_ALBUM") &&
        browseId &&
        !seenAlbumIds.has(browseId)
      ) {
        seenAlbumIds.add(browseId);
        const parts = subtitle.split("•").map((s: string) => s.trim());
        albums.push({
          id: browseId,
          title,
          artist: parts[1] || parts[0] || "Artist",
          year: parts[2] || undefined,
          thumbnail: upscaleThumbnail(thumb),
          type:
            parts[0] === "Single" || parts[0] === "EP" ? parts[0] : "Album"
        });
      } else {
        const track = parseTrackFromResponsiveItem(r);
        if (track && !seenTrackIds.has(track.id)) {
          seenTrackIds.add(track.id);
          tracks.push(track);
        }
      }
    }
  }

  for (const section of extractSections(artistsData)) {
    const items = section?.musicShelfRenderer?.contents ?? [];
    for (const entry of items) {
      const r = entry?.musicResponsiveListItemRenderer;
      if (!r) continue;
      const browseId: string | undefined =
        r?.navigationEndpoint?.browseEndpoint?.browseId;
      if (!browseId || seenArtistIds.has(browseId)) continue;
      seenArtistIds.add(browseId);
      const title = getRunsText(
        r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const subtitle = getRunsText(
        r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const thumb = pickBestThumbnail(
        r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );
      if (title) {
        artists.push({
          id: browseId,
          name: title,
          thumbnail: upscaleThumbnail(thumb),
          subscribers: subtitle.replace(/^Artist\s*•\s*/i, "")
        });
      }
    }
  }

  for (const section of extractSections(albumsData)) {
    const items = section?.musicShelfRenderer?.contents ?? [];
    for (const entry of items) {
      const r = entry?.musicResponsiveListItemRenderer;
      if (!r) continue;
      const browseId: string | undefined =
        r?.navigationEndpoint?.browseEndpoint?.browseId;
      if (!browseId || seenAlbumIds.has(browseId)) continue;
      seenAlbumIds.add(browseId);
      const title = getRunsText(
        r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const subtitle = getRunsText(
        r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      );
      const thumb = pickBestThumbnail(
        r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );
      const parts = subtitle.split("•").map((s: string) => s.trim());
      if (title) {
        albums.push({
          id: browseId,
          title,
          artist: parts[1] || parts[0] || "Artist",
          year: parts[2] || undefined,
          thumbnail: upscaleThumbnail(thumb),
          type: parts[0] === "Single" || parts[0] === "EP" ? parts[0] : "Album"
        });
      }
    }
  }

  return {
    query: cleanQuery,
    topResult: tracks[0] ?? null,
    tracks: tracks.slice(0, 25),
    artists: artists.slice(0, 10),
    albums: albums.slice(0, 10)
  };
}

interface HomeCacheEntry {
  expiresAt: number;
  shelves: HomeShelf[];
}

const homeCache = new Map<string, HomeCacheEntry>();

const MOOD_SHELF_QUERIES: Record<
  string,
  Array<{ id: string; title: string; subtitle: string; query: string }>
> = {
  all: [
    {
      id: "trending",
      title: "Trending Now",
      subtitle: "Most played songs right now",
      query: "top global hits 2025 official audio"
    },
    {
      id: "desi-hits",
      title: "Hindi & Desi Favorites",
      subtitle: "Bollywood, Indie & Nepali hits",
      query: "Arijit Singh Pritam latest hindi songs"
    },
    {
      id: "chill-lofi",
      title: "Late Night Chill",
      subtitle: "Ambient, lo-fi & mellow grooves",
      query: "chill r&b weeknd sza frank ocean"
    },
    {
      id: "indie-alt",
      title: "Indie & Alternative",
      subtitle: "Fresh guitars & dreamy synths",
      query: "Tame Impala Arctic Monkeys Cigarettes After Sex"
    },
    {
      id: "hiphop",
      title: "Hip-Hop Rotation",
      subtitle: "Heavy hitters and modern classics",
      query: "Kendrick Lamar Travis Scott Drake top songs"
    }
  ],
  music: [
    {
      id: "pop-essentials",
      title: "Pop Essentials",
      subtitle: "Chart toppers and anthems",
      query: "Sabrina Carpenter Billie Eilish Dua Lipa hits"
    },
    {
      id: "rock-classics",
      title: "Rock & Alt Anthems",
      subtitle: "Timeless tracks turned up loud",
      query: "Coldplay Linkin Park Radiohead best songs"
    },
    {
      id: "electronic",
      title: "Electronic & Dance",
      subtitle: "Pulse-raising beats",
      query: "Fred again Daft Punk Calvin Harris"
    }
  ],
  chill: [
    {
      id: "lofi-study",
      title: "Lo-Fi & Focus",
      subtitle: "Calm beats for deep work",
      query: "lofi hip hop chill beats instrumental"
    },
    {
      id: "acoustic",
      title: "Acoustic Unplugged",
      subtitle: "Warm vocals and gentle strings",
      query: "acoustic chill indie folk songs"
    }
  ],
  workout: [
    {
      id: "gym-hype",
      title: "Beast Mode",
      subtitle: "High-energy tracks for training",
      query: "workout gym motivation hip hop phonk"
    },
    {
      id: "running-bpm",
      title: "Cardio Pulse",
      subtitle: "140+ BPM momentum",
      query: "electronic workout running mix hits"
    }
  ],
  desi: [
    {
      id: "bollywood-gold",
      title: "Bollywood Soul",
      subtitle: "Arijit, Shreya, Atif & AR Rahman",
      query: "Arijit Singh Atif Aslam romantic hindi hits"
    },
    {
      id: "nepali-indie",
      title: "Nepali Indie & Classics",
      subtitle: "Sajjan Raj Vaidya, Swoopna Suman & more",
      query: "Sajjan Raj Vaidya Swoopna Suman nepali songs"
    },
    {
      id: "punjabi-vibes",
      title: "Punjabi Wave",
      subtitle: "AP Dhillon, Diljit Dosanjh, Karan Aujla",
      query: "Diljit Dosanjh Karan Aujla AP Dhillon hits"
    }
  ]
};

export async function getHomeShelves(mood = "all"): Promise<HomeShelf[]> {
  const key = MOOD_SHELF_QUERIES[mood] ? mood : "all";
  const cached = homeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.shelves;
  }

  const specs = MOOD_SHELF_QUERIES[key];
  const results = await Promise.all(
    specs.map(async (spec) => {
      try {
        const search = await searchYouTubeMusic(spec.query);
        return {
          id: spec.id,
          title: spec.title,
          subtitle: spec.subtitle,
          items: search.tracks.slice(0, 12)
        } satisfies HomeShelf;
      } catch {
        return {
          id: spec.id,
          title: spec.title,
          subtitle: spec.subtitle,
          items: []
        } satisfies HomeShelf;
      }
    })
  );

  const shelves = results.filter((s) => s.items.length > 0);
  homeCache.set(key, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    shelves
  });
  return shelves;
}

export async function getRadioTracks(videoId: string): Promise<Track[]> {
  if (!videoId) return [];
  try {
    const data = await ytFetch("next", {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      isAudioOnly: true
    });

    const contents =
      data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
        ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents ?? [];

    const tracks: Track[] = [];
    const seen = new Set<string>([videoId]);

    for (const item of contents) {
      const r = item?.playlistPanelVideoRenderer;
      const id: string | undefined = r?.videoId;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const title = getRunsText(r?.title?.runs);
      const longByline = r?.longBylineText?.runs ?? [];
      const artist =
        longByline[0]?.text ?? getRunsText(r?.shortBylineText?.runs) ?? "Artist";
      const artistId =
        longByline[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      const durationText = getRunsText(r?.lengthText?.runs);
      const thumb = pickBestThumbnail(r?.thumbnail?.thumbnails);

      tracks.push({
        id,
        title: title || "Unknown Track",
        artist,
        artistId,
        duration: parseDurationToSeconds(durationText),
        durationText: durationText || "3:30",
        thumbnail: upscaleThumbnail(thumb, id)
      });
    }

    return tracks.slice(0, 18);
  } catch {
    return [];
  }
}

export async function getArtistDetail(browseId: string, fallbackName?: string) {
  try {
    const data = await ytFetch("browse", { browseId });
    const header =
      data?.header?.musicImmersiveHeaderRenderer ??
      data?.header?.musicVisualHeaderRenderer ??
      data?.header?.musicHeaderRenderer;

    const name = getRunsText(header?.title?.runs) || fallbackName || "Artist";
    const description = getRunsText(header?.description?.runs) || "";
    const subscribers =
      getRunsText(
        header?.subscriptionButton?.subscribeButtonRenderer
          ?.longSubscriberCountText?.runs
      ) || "";
    const banner = upscaleThumbnail(
      pickBestThumbnail(
        header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      )
    );

    const sections =
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ?? [];

    const topTracks: Track[] = [];
    const albums: AlbumSummary[] = [];

    for (const section of sections) {
      const shelfItems = section?.musicShelfRenderer?.contents ?? [];
      for (const entry of shelfItems) {
        const r = entry?.musicResponsiveListItemRenderer;
        if (!r) continue;
        const track = parseTrackFromResponsiveItem(r);
        if (track) topTracks.push(track);
      }

      const carouselItems =
        section?.musicCarouselShelfRenderer?.contents ?? [];
      for (const entry of carouselItems) {
        const item = entry?.musicTwoRowItemRenderer;
        if (!item) continue;
        const id = item?.navigationEndpoint?.browseEndpoint?.browseId;
        const pageType =
          item?.navigationEndpoint?.browseEndpoint
            ?.browseEndpointContextSupportedConfigs
            ?.browseEndpointContextMusicConfig?.pageType;
        if (id && (pageType === "MUSIC_PAGE_TYPE_ALBUM" || id.startsWith("MPREb_"))) {
          albums.push({
            id,
            title: getRunsText(item?.title?.runs),
            artist: name,
            artistId: browseId,
            year: getRunsText(item?.subtitle?.runs),
            thumbnail: upscaleThumbnail(
              pickBestThumbnail(
                item?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
                  ?.thumbnails
              )
            )
          });
        }
      }
    }

    if (topTracks.length === 0 && name) {
      const fallback = await searchYouTubeMusic(name);
      return {
        id: browseId,
        name,
        description,
        subscribers,
        banner: banner || fallback.tracks[0]?.thumbnail || "",
        topTracks: fallback.tracks.slice(0, 10),
        albums: albums.length > 0 ? albums : fallback.albums
      };
    }

    return {
      id: browseId,
      name,
      description,
      subscribers,
      banner,
      topTracks: topTracks.slice(0, 12),
      albums: albums.slice(0, 12)
    };
  } catch {
    const query = fallbackName || browseId;
    const fallback = await searchYouTubeMusic(query);
    return {
      id: browseId,
      name: query,
      description: "",
      subscribers: "",
      banner: fallback.tracks[0]?.thumbnail || "",
      topTracks: fallback.tracks.slice(0, 10),
      albums: fallback.albums
    };
  }
}

export async function getAlbumDetail(browseId: string, fallbackTitle?: string) {
  try {
    const data = await ytFetch("browse", { browseId });
    const header =
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents?.[0]
        ?.musicResponsiveHeaderRenderer ??
      data?.header?.musicDetailHeaderRenderer;

    const title = getRunsText(header?.title?.runs) || fallbackTitle || "Album";
    const subtitle = getRunsText(header?.subtitle?.runs) || "";
    const artistRuns =
      header?.straplineTextOne?.runs ?? header?.subtitle?.runs ?? [];
    const artist = getRunsText(artistRuns) || "Artist";
    const artistId =
      artistRuns?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
    const cover = upscaleThumbnail(
      pickBestThumbnail(
        header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
          header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails
      )
    );

    const trackSections =
      data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
        ?.sectionListRenderer?.contents ??
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ??
      [];

    const tracks: Track[] = [];
    for (const section of trackSections) {
      const items = section?.musicShelfRenderer?.contents ?? [];
      for (const entry of items) {
        const r = entry?.musicResponsiveListItemRenderer;
        if (!r) continue;
        const parsed = parseTrackFromResponsiveItem(r);
        if (parsed) {
          tracks.push({
            ...parsed,
            artist: parsed.artist === "Unknown Artist" ? artist : parsed.artist,
            artistId: parsed.artistId ?? artistId,
            album: title,
            albumId: browseId,
            thumbnail: cover || parsed.thumbnail
          });
        }
      }
    }

    if (tracks.length === 0 && fallbackTitle) {
      const fallback = await searchYouTubeMusic(fallbackTitle);
      return {
        id: browseId,
        title,
        artist,
        artistId,
        subtitle,
        cover: cover || fallback.tracks[0]?.thumbnail || "",
        tracks: fallback.tracks.slice(0, 12)
      };
    }

    return {
      id: browseId,
      title,
      artist,
      artistId,
      subtitle,
      cover,
      tracks
    };
  } catch {
    const query = fallbackTitle || browseId;
    const fallback = await searchYouTubeMusic(query);
    return {
      id: browseId,
      title: query,
      artist: fallback.tracks[0]?.artist || "Artist",
      artistId: fallback.tracks[0]?.artistId,
      subtitle: "Album",
      cover: fallback.tracks[0]?.thumbnail || "",
      tracks: fallback.tracks.slice(0, 12)
    };
  }
}

export async function importYouTubePlaylist(urlOrId: string) {
  let listId = urlOrId.trim();
  const match = listId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match) listId = match[1];
  const browseId = listId.startsWith("VL") ? listId : `VL${listId}`;

  const data = await ytFetch("browse", { browseId });
  const header =
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer ??
    data?.header?.musicDetailHeaderRenderer ??
    data?.header?.musicEditablePlaylistDetailHeaderRenderer?.header
      ?.musicDetailHeaderRenderer;

  const name = getRunsText(header?.title?.runs) || "Imported Playlist";
  const description = getRunsText(header?.description?.runs) || "";
  const cover = upscaleThumbnail(
    pickBestThumbnail(
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
        header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails
    )
  );

  const sections =
    data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents ??
    data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer?.contents ??
    [];

  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const items =
      section?.musicPlaylistShelfRenderer?.contents ??
      section?.musicShelfRenderer?.contents ??
      [];
    for (const entry of items) {
      const r = entry?.musicResponsiveListItemRenderer;
      if (!r) continue;
      const track = parseTrackFromResponsiveItem(r);
      if (track && !seen.has(track.id)) {
        seen.add(track.id);
        tracks.push(track);
      }
    }
  }

  return { name, description, cover, tracks: tracks.slice(0, 100) };
}
