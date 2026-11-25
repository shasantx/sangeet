# Sangeet v2.3

[![License: MIT](https://img.shields.io/badge/License-MIT-2563eb.svg)](./LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-149ECA.svg)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![Android Media3](https://img.shields.io/badge/Android-Media3_ExoPlayer-3DDC84.svg)](https://developer.android.com/media/media3)
[![Windows Rust Tauri v2](https://img.shields.io/badge/Windows-Rust_Tauri_v2-FFC131.svg)](https://v2.tauri.app/)

**Sangeet v2.3** is a free, open-source, local-first music discovery, streaming, and offline playback platform across **Web**, **Android**, and **Windows**. Designed around a Zentra Obsidian & Electric Cobalt interface, Sangeet runs completely on-device in Guest or Local Profile mode with zero mandatory database or cloud lock-in.

---

## Key Features

- **Zentra Obsidian & Electric Cobalt Themes**: Crafted dark obsidian and crisp daylight themes with subtle tonal layering and zero harsh chrome.
- **GlassKit Liquid Glass Navigation**: Translucent floating Liquid Glass top and mobile navigation surfaces powered by `glasskit-liquid-glass`.
- **Responsive Cinema & Mobile Players**:
  - **2-Column Cinema Player** on desktop with Song/Video switching, Queue, and real-time lyrics side-by-side.
  - **Gesture-Dismiss Mobile Player** with smooth swipe-down dismissal, lock-screen media controls, and compact mini-player bar.
- **Real-Time Synced Lyrics**: Line-by-line time-synced lyrics fetched from [LRCLIB](https://lrclib.net/) with automatic scroll tracking and click-to-seek.
- **5-Band Graphic Equalizer**: Interactive Web Audio API equalizer with studio presets and real-time frequency shaping.
- **Interactive Playlist Creator**: Create, edit, reorder, pin, and export custom playlists and Liked Songs locally as JSON backups.
- **1-Click Native Offline Downloads & Smart Local Scan**:
  - Parallel segmented downloads straight to offline storage on **Android** and **Windows** with real-time progress bars.
  - Automatic local device audio scanner that filters out ringtones, notifications, alarms, call recordings, voice notes, and short clips under 15 seconds.
- **Built-In Security Hardening**: Strict Content Security Policy (CSP), HSTS, API rate limiting, SSRF host/redirect validation on media endpoints, and HMAC-signed OAuth state/session cookies.

---

## Architecture

| Platform | Stack | Highlights |
| :--- | :--- | :--- |
| **Web** | Next.js 15, React 19, TypeScript 5, Tailwind CSS 3.4, Zustand | Instant streaming, playlists, queue, synced lyrics, 5-band EQ, local-first storage, optional Google OAuth |
| **Android** | Java, AndroidX Media3 (ExoPlayer), MediaSessionService | Native background audio playback, lock-screen/notification controls, 4-stream parallel downloads, MediaStore smart audio scanner |
| **Windows** | Rust, Tauri v2, WebView2 | Lightweight native desktop shell, fast Rust-powered offline downloads, local Music folder smart scanner |

---

## Local Development

### Prerequisites

- **Node.js 20+** and **npm**
- *(Optional)* **Rust toolchain** for building the Windows Tauri v2 shell (`desktop-rust/`)
- *(Optional)* **Android SDK / JDK 17** for building the Android Media3 app (`android/`)

### Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure optional environment variables (never commit .env.local)
cp .env.example .env.local

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Sangeet works out of the box in **Guest Mode** and **Local Profile Mode** without configuring OAuth credentials.

### Verification & Production Build

```bash
# Type-check with TypeScript
npm run typecheck

# Run automated test suite
npm test

# Create an optimized production build
npm run build
```

---

## Security & Contributing

- **Security**: Read [SECURITY.md](./SECURITY.md) for details on Sangeet's security architecture and how to report vulnerabilities responsibly.
- **Contributing**: Pull requests are welcome! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

---

## Rights & Attribution

- Web audio and video playback uses YouTube's official IFrame Player API; track availability depends on content owner settings, embed permissions, and regional rights.
- Synchronized lyrics are provided by the public [LRCLIB](https://lrclib.net/) API.
- Sangeet is an independent open-source project and is not affiliated with, endorsed by, or connected to any commercial music streaming service.

---

## License

Sangeet is open-source software licensed under the [MIT License](./LICENSE).
