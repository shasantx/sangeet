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

## Deploy with the Sangeet app on Vercel

The repository root `vercel.json` configures two Vercel Services: the Next.js
app and this Python search service. The Python service is reached through a
private service binding and is not exposed as a public route. Services are a
Vercel Beta feature; the project must be imported as a multi-service project.
The binding supplies `YTMUSIC_SERVICE_URL` automatically, so no URL or shared
token needs to be entered in the app's browser-facing environment.

1. Import the repository using Vercel's **multi-service project** flow.
2. Keep the repository root (`.`) as the project root so Vercel reads
   `vercel.json` and builds both services.
3. Deploy. The Next.js route calls the Python service using the private binding.
4. If you instead deploy this folder as a separate public project, configure a
   strong `YTMUSIC_SERVICE_TOKEN` on both projects and set the main app's
   `YTMUSIC_SERVICE_URL` to that service's base HTTPS URL.

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
