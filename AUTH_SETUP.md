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

Set `ADMIN_EMAILS` to a comma-separated list of verified Google email addresses in server-side environment settings. `/admin` verifies the signed server session and checks this allowlist. There is no client-side admin flag and public users cannot assign themselves this role. The current admin page is read-only because Sangeet has no persistent user/catalog database yet.

## Account and library scope

Google sign-in creates a server-verified identity session. Sangeet listener data (likes, playlists, history, and preferences) is currently kept in the browser and does not sync across devices. Password recovery is handled by Google. Sangeet does not implement local email/password accounts.
