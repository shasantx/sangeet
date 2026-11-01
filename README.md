# Sangeet

Sangeet is a free, open-source music discovery app built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Zustand. It includes synced playlists, favorites and listening history for signed-in users, music discovery, an embedded player, Google sign-in, a server-side admin console, and an optional project donation QR.

## Local development

1. Install Node.js 20 or later and Python 3.10 or later.
2. Install JavaScript dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local`. Set `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a private random `AUTH_SECRET` to enable Google sign-in. The app remains browsable without OAuth credentials.
4. Apply the migrations documented in [AUTH_SETUP.md](./AUTH_SETUP.md) to enable per-account library sync and optional YouTube Library access.
5. In one terminal, start the local music search service with `npm run ytmusic`.
6. In another terminal, start Next.js with `npm run dev` and open `http://localhost:3000`.

Google OAuth client setup and callback registration are documented in [AUTH_SETUP.md](./AUTH_SETUP.md).

## Current features

- Responsive browse, search, artist, album, playlist, genre, library, and recently played pages.
- Guest libraries and playback preferences are browser-local. Signed-in favorites, playlists and recently played data sync to the private Supabase library table.
- YouTube Music metadata search through the separate local `ytmusicapi` service, plus the official YouTube IFrame Player for playback.
- Google OAuth code flow with state, PKCE, ID-token verification, and signed HTTP-only session cookie.
- Optional separate read-only Google OAuth connection for a listener's YouTube playlists and liked videos; refresh tokens are encrypted server-side.
- Server-checked admin email allowlist and a Supabase-backed admin console for members, site settings, audit history, and donation display.
- Playlists, recently played history, and eligible offline audio are not restricted by a paid plan.
- Public open-source project support section with donation QR and instructions managed from the admin console.

## YouTube integration and rights

`ytmusicapi` is an unofficial third-party YouTube Music client. It is not the official YouTube Data API, does not provide official API quota guarantees, and may change or stop working when YouTube changes its service. Search is cached and rate-limited in this app, but production deployments should use an approved provider and apply distributed rate limits at the edge.

Playback uses YouTube's embedded IFrame player with its controls and branding. The player remains visible while a YouTube video is playing and pauses when the app tab becomes hidden. Sangeet does not download, extract, proxy, or re-host YouTube audio/video. Video availability depends on the owner, embed permissions, and region. Review current [YouTube player requirements](https://developers.google.com/youtube/iframe_api_reference), [player parameters](https://developers.google.com/youtube/player_parameters), and [Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide) before deployment.

Bundled Sangeet recordings are sample assets, separate from YouTube-powered results. They are not a licensed commercial streaming catalog. The YouTube embedded player may stop when the browser or mobile OS backgrounds the page, and it cannot be converted into an audio-only or offline stream. Background and offline playback are available only for audio files the browser can directly play and store, subject to browser and device policies.

## Production deployment notes

- Google OAuth credentials and a secure deployed HTTPS origin are required for sign-in.
- Run the admin and site-control migrations plus `20261031150000_open_access_project_donations.sql`; see [ADMIN_SETUP.md](./ADMIN_SETUP.md).
- Apply `20261101000000_user_library_sync.sql` to enable cross-device library sync and `20261101010000_youtube_connections.sql` for optional YouTube account access; generate `YOUTUBE_TOKEN_ENCRYPTION_KEY` as described in [AUTH_SETUP.md](./AUTH_SETUP.md).
- There are no paid plans, checkout, or payment collection. Donation QR display is optional and does not unlock features.
- Android background playback depends on the media source and browser lock-screen support. The native HTML audio element uses Media Session where supported; embedded YouTube playback cannot reliably continue in the background.
- The YouTube Music metadata source is unofficial. For a durable production catalog, connect a licensed music provider or an approved API and verify its rights, quota, and deployment requirements.
- The search rate limit is per Node.js process. Multi-instance deployments need a trusted proxy and shared rate-limit storage.
- On Vercel, import the repo as a multi-service project so the private Python search service is deployed with the Next.js app; see [its deployment steps](./ytmusic-service/README.md). Vercel Services is currently a Beta feature.
- Add a privacy notice and applicable consent/configuration for third-party YouTube embeds before public deployment.

Do not deploy as a paid music service or represent the app as a licensed catalog until those dependencies are addressed.

## Checks

- `npm run typecheck`
- `npm run build`
