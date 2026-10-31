# Sangeet · YouTube Music search service

A tiny local HTTP service that gives Sangeet real YouTube-wide search **without a
Google API key**, using [`ytmusicapi`](https://github.com/sigma67/ytmusicapi).

- Returns **metadata only** (video ID, title, artist, duration, thumbnail).
- Sangeet plays the result through the official **YouTube IFrame Player**.
- No audio is downloaded, extracted, or re-hosted.

## Run

```powershell
npm run ytmusic
```

The first run creates `.venv-ytm/`, installs `ytmusicapi`, and serves
`http://127.0.0.1:8765`.

Keep it running alongside `npm run dev` or `npm run start`. If the service is
offline, Sangeet still shows its own catalogue and the curated YouTube sessions;
the search page simply notes that YouTube search is offline.

## Deploy the search service to Vercel

Deploy this folder as a second Vercel project from the same GitHub repository:

1. Import the repository again and set **Root Directory** to `ytmusic-service`.
2. Use the **Python** framework preset. Vercel will deploy `api/search.py` as
   `GET /api/search`.
3. Add `YTMUSIC_SERVICE_TOKEN` to this project. Generate a random value locally
   with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   and keep it private.
4. In the main Sangeet Vercel project, set `YTMUSIC_SERVICE_URL` to this
   project's base HTTPS URL and set the same `YTMUSIC_SERVICE_TOKEN` value.
5. Redeploy both projects.

The function requires the token and returns metadata only. The app's Next.js
route forwards authenticated requests to it. The existing `server.py` remains
available for local development.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/search?q=...&limit=12` | YouTube video search |

## Notes

`ytmusicapi` is an unofficial client, not affiliated with YouTube. Use it in
line with YouTube's terms and your local jurisdiction. Search results are
cached in memory for five minutes to avoid hammering the upstream service.
