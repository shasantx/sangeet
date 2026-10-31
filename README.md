# Sangeet

Sangeet is an independent music discovery interface built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Zustand. It includes a bundled sample catalog, browser-local playlists and likes, an embedded YouTube player, and a server-side Google sign-in foundation.

## Local development

1. Install Node.js 20 or later and Python 3.10 or later.
2. Install JavaScript dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local`. Set `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a private random `AUTH_SECRET` to enable Google sign-in. The app remains browsable without OAuth credentials.
4. In one terminal, start the local YouTube Music search service with `npm run ytmusic`.
5. In another terminal, start Next.js with `npm run dev` and open `http://localhost:3000`.

Google OAuth client setup and callback registration are documented in [AUTH_SETUP.md](./AUTH_SETUP.md).

## Current features

- Responsive browse, search, artist, album, playlist, genre, library, and recently played pages.
- Local playlists, likes, saved albums, followed artists, and playback queue stored in browser storage.
- YouTube Music metadata search through the separate local `ytmusicapi` service, plus the official YouTube IFrame Player for playback.
- Google OAuth code flow with state, PKCE, ID-token verification, and signed HTTP-only session cookie.
- Server-checked admin email allowlist and a protected read-only admin readiness page.
- Plan comparison page that clearly reports billing as unavailable until checkout and subscription persistence exist.

## YouTube integration and rights

`ytmusicapi` is an unofficial third-party YouTube Music client. It is not the official YouTube Data API, does not provide official API quota guarantees, and may change or stop working when YouTube changes its service. Search is cached and rate-limited in this app, but production deployments should use an approved provider and apply distributed rate limits at the edge.

Playback uses YouTube's embedded IFrame player with its controls and branding. The player remains visible while a YouTube video is playing and pauses when the app tab becomes hidden. Sangeet does not download, extract, proxy, or re-host YouTube audio/video. Video availability depends on the owner, embed permissions, and region. Review current [YouTube player requirements](https://developers.google.com/youtube/iframe_api_reference), [player parameters](https://developers.google.com/youtube/player_parameters), and [Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide) before deployment.

Bundled Sangeet recordings are sample assets, separate from YouTube-powered results. They are not a licensed commercial streaming catalog. No paid plan may promise YouTube ad removal, background playback, offline playback, audio-only playback, or other restricted benefits.

## Production dependencies still required

This codebase is not a complete multi-user production service yet:

- Google OAuth credentials and a secure deployed HTTPS origin are required for sign-in.
- Listener library data remains in localStorage; there is no application database, migrations, cross-device sync, or account recovery database.
- `/admin` currently has a secure Google-email allowlist but is read-only. User management, editable catalog operations, moderation, and audit history need persistent records and audited server mutations.
- Premium is intentionally unavailable. Stripe variables are placeholders only; checkout, webhook verification, durable subscription state, and server-side entitlements are not implemented.
- The YouTube Music metadata source is unofficial. For a durable production catalog, connect a licensed music provider or an approved API and verify its rights, quota, and deployment requirements.
- The search rate limit is per Node.js process. Multi-instance deployments need a trusted proxy and shared rate-limit storage.
- On Vercel, the Python search endpoint is a separate project rooted at `ytmusic-service`; follow [its deployment steps](./ytmusic-service/README.md) and configure `YTMUSIC_SERVICE_URL` plus the shared `YTMUSIC_SERVICE_TOKEN` in both Vercel projects.
- Add a privacy notice and applicable consent/configuration for third-party YouTube embeds before public deployment.

Do not deploy as a paid music service or represent the app as a licensed catalog until those dependencies are addressed.

## Checks

- `npm run typecheck`
- `npm run build`
