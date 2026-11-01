# Google sign-in setup

Sangeet uses Google's OAuth authorization-code flow. The server validates the state and PKCE values, Google ID-token signature and claims, and then issues a signed HTTP-only session cookie. Sangeet does not store Google passwords or request access to other Google services.

1. In Google Cloud Console, configure the OAuth consent screen and create an OAuth 2.0 Client ID with application type **Web application**.
2. Add `http://localhost:3000` as an authorized JavaScript origin for local development.
3. Add this exact authorized redirect URI: `http://localhost:3000/api/auth/google/callback`.
4. Copy `.env.example` to `.env.local` and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL=http://localhost:3000`.
5. Generate `AUTH_SECRET` with `(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")` and keep the output private.
6. Restart Next.js, then use **Continue with Google** from Sangeet.

For deployment, use the canonical HTTPS origin in `APP_URL` and register `https://your-domain.example/api/auth/google/callback` with Google. Store all OAuth credentials and `AUTH_SECRET` in the deployment platform's secret manager. Never commit `.env.local`.

## Admin access

`private.shasant@gmail.com` is the initial server-side administrator. Add any additional verified Google accounts to the comma-separated `ADMIN_EMAILS` server environment variable. `/admin` checks the signed server session against this allowlist; users cannot grant themselves admin access. The admin console manages server-stored member status, site settings, donation QR settings, and audit history through server-only Supabase access. See [ADMIN_SETUP.md](./ADMIN_SETUP.md) for migrations and environment setup.

## Account and library scope

Google sign-in creates a server-verified identity session. Favorites, playlists, and recently played tracks sync to the Sangeet database after the `20261101000000_user_library_sync.sql` migration is applied. Player and appearance preferences remain on each device. Password recovery is handled by Google; Sangeet does not implement local email/password accounts.

### Optional My YouTube Library

To enable the separate read-only connection, add `https://your-domain.example/api/youtube/connect/callback` (and the localhost equivalent for development) as an authorized redirect URI in the same Google OAuth web client. Apply `20261101010000_youtube_connections.sql`, then set `YOUTUBE_TOKEN_ENCRYPTION_KEY` to 64 random hexadecimal characters (32 random bytes). For example, generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store this key as a server-only deployment secret. Users connect from **Settings → My YouTube Library**; normal sign-in never requests this scope. Sangeet reads owned playlists, playlist contents, and liked videos when the YouTube Data API permits it. It does not read YouTube Music listening history and does not edit remote playlists.
