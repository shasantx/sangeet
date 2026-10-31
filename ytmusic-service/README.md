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

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/search?q=...&limit=12` | YouTube video search |

## Notes

`ytmusicapi` is an unofficial client, not affiliated with YouTube. Use it in
line with YouTube's terms and your local jurisdiction. Search results are
cached in memory for five minutes to avoid hammering the upstream service.
