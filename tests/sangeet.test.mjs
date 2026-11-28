import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// --- 1. LRC parser & active-line timing logic ---
function parseLrc(lrc) {
  const lines = [];
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const matches = Array.from(raw.matchAll(tagRegex));
    if (matches.length === 0) continue;
    const text = raw.replace(tagRegex, "").trim();
    if (!text) continue;
    for (const match of matches) {
      const mins = Number.parseInt(match[1], 10);
      const secs = Number.parseInt(match[2], 10);
      const msStr = match[3] ?? "0";
      const ms =
        msStr.length === 1
          ? Number.parseInt(msStr, 10) * 100
          : msStr.length === 2
            ? Number.parseInt(msStr, 10) * 10
            : Number.parseInt(msStr, 10);
      lines.push({ time: mins * 60 + secs + ms / 1000, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function getActiveLyricIndex(lines, currentTime, leadSeconds = 0.15) {
  if (!lines.length || !Number.isFinite(currentTime)) return -1;
  const target = currentTime + leadSeconds;
  if (target < lines[0].time) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].time <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

test("LRC parser handles multi-timestamp lines and active-line binary search", () => {
  const sample = [
    "[00:05.00] First line",
    "[00:12.50][01:02.00] Repeated chorus",
    "[00:20.25] Bridge line"
  ].join("\n");
  const parsed = parseLrc(sample);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].text, "First line");
  assert.equal(parsed[1].time, 12.5);
  assert.equal(parsed[3].time, 62);

  assert.equal(getActiveLyricIndex(parsed, 1.0), -1);
  assert.equal(getActiveLyricIndex(parsed, 5.0), 0);
  assert.equal(getActiveLyricIndex(parsed, 12.4), 1); // within 0.15s lookahead
  assert.equal(getActiveLyricIndex(parsed, 25.0), 2);
  assert.equal(getActiveLyricIndex(parsed, 70.0), 3);
});

// --- 2. Service Worker cache isolation verification ---
test("Service Worker only deletes Sangeet-owned caches and serves offline.html", () => {
  const swSource = fs.readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
  assert.match(swSource, /CACHE_PREFIX\s*=\s*["']sangeet-v2-["']/);
  assert.match(swSource, /k\.startsWith\(CACHE_PREFIX\)\s*&&\s*k\s*!==\s*CACHE_NAME/);
  assert.match(swSource, /\/offline\.html/);
  assert.ok(fs.existsSync(path.join(ROOT, "public/offline.html")));
});

// --- 3. Scoped localStorage reset verification ---
test("Settings reset only removes Sangeet-owned storage keys (never localStorage.clear)", () => {
  const settingsSource = fs.readFileSync(
    path.join(ROOT, "src/app/settings/page.tsx"),
    "utf8"
  );
  assert.equal(settingsSource.includes("localStorage.clear()"), false);
  assert.match(settingsSource, /SANGEET_STORAGE_KEYS/);
  assert.match(settingsSource, /clearAllOfflineAudio/);
});

// --- 4. Consolidated lyrics store & zero duplicate fetches ---
test("Lyrics panels consume shared useLyricsStore instead of duplicating fetch calls", () => {
  const panels = [
    "src/components/shell/right-panel.tsx",
    "src/app/lyrics/page.tsx",
    "src/components/player/fullscreen-player.tsx",
    "src/components/player/mobile-now-playing-sheet.tsx"
  ];
  for (const rel of panels) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(src, /useLyricsStore/, `${rel} should use useLyricsStore`);
    assert.equal(
      src.includes("/api/music/lyrics"),
      false,
      `${rel} should not directly fetch /api/music/lyrics`
    );
  }
});

// --- 5. Playback store & Offline IndexedDB contract ---
test("Player store strips ephemeral blob URLs on persist and exposes retryCurrentTrack", () => {
  const storeSrc = fs.readFileSync(
    path.join(ROOT, "src/store/player-store.ts"),
    "utf8"
  );
  assert.match(storeSrc, /sanitizeTrackForStorage/);
  assert.match(storeSrc, /retryCurrentTrack/);
  assert.match(storeSrc, /playbackError/);
});

test("Offline DB uses IndexedDB with object URL lifecycle cleanup", () => {
  const dbSrc = fs.readFileSync(path.join(ROOT, "src/lib/offline-db.ts"), "utf8");
  assert.match(dbSrc, /indexedDB\.open/);
  assert.match(dbSrc, /URL\.revokeObjectURL/);
  assert.match(dbSrc, /QuotaExceededError/);
});

// --- 6. Official Android APK route verification ---
test("Android APK download route queries GitHub releases and supports meta=1", () => {
  const routeSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/download/android/route.ts"),
    "utf8"
  );
  assert.match(routeSrc, /api\.github\.com\/repos\/shasantx\/sangeet\/releases/);
  assert.match(routeSrc, /sangeet-android\.apk/);
  assert.match(routeSrc, /wantsMeta/);
  assert.match(routeSrc, /status:\s*503/);
});

// --- 7. Floating pill nav, primary feature placement, accessibility & touch targets ---
test("Viewport allows mobile pinch-to-zoom (no maximumScale=1 or userScalable=false)", () => {
  const layoutSrc = fs.readFileSync(
    path.join(ROOT, "src/app/layout.tsx"),
    "utf8"
  );
  assert.equal(/maximumScale\s*:\s*1\b/.test(layoutSrc), false);
  assert.equal(/userScalable\s*:\s*false/.test(layoutSrc), false);
});

test("Top bar and left sidebar use consistent 44px touch targets", () => {
  const topBarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/top-bar.tsx"),
    "utf8"
  );
  assert.match(topBarSrc, /h-16/);
  assert.match(topBarSrc, /h-11 w-11/);
  assert.equal(topBarSrc.includes("sm:h-15"), false);

  const sidebarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/left-sidebar.tsx"),
    "utf8"
  );
  assert.match(sidebarSrc, /min-h-\[44px\]/);
  assert.match(sidebarSrc, /h-11 w-11/);
  assert.match(sidebarSrc, /h-11 w-full/);
});

test("Sidebar resize handle supports pointer/touch dragging, keyboard controls, and ARIA separator", () => {
  const sidebarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/left-sidebar.tsx"),
    "utf8"
  );
  assert.match(sidebarSrc, /role="separator"/);
  assert.match(sidebarSrc, /aria-orientation="vertical"/);
  assert.match(sidebarSrc, /aria-valuenow=\{leftWidth\}/);
  assert.match(sidebarSrc, /aria-valuemin=/);
  assert.match(sidebarSrc, /aria-valuemax=/);
  assert.match(sidebarSrc, /onPointerDown=/);
  assert.match(sidebarSrc, /setPointerCapture/);
  assert.match(sidebarSrc, /touch-none/);
  assert.match(sidebarSrc, /onKeyDown=\{handleResizeKeyDown\}/);
  assert.match(sidebarSrc, /ArrowRight/);
  assert.match(sidebarSrc, /ArrowLeft/);
});

test("Floating pill nav uses GlassKit Liquid Glass TabBar with Queue, Library, More & detached Search orb", () => {
  const navSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/floating-nav.tsx"),
    "utf8"
  );
  assert.match(navSrc, /from\s+["']glasskit-liquid-glass["']/);
  assert.match(navSrc, /GlassTabBar/);
  assert.match(navSrc, /searchable/);
  assert.match(navSrc, /href:\s*["']\/home["']/);
  assert.match(navSrc, /href:\s*["']\/library["']/);
  assert.match(navSrc, /href:\s*["']\/queue["']/);
  assert.match(navSrc, /href:\s*["']\/more["']/);
  assert.match(navSrc, /\/search/);
  assert.match(navSrc, /LIBRARY_PREFIXES[\s\S]*\/offline[\s\S]*\/recently-played/);
  assert.match(navSrc, /PLAYBACK_PREFIXES[\s\S]*\/queue[\s\S]*\/lyrics/);
  assert.ok(fs.existsSync(path.join(ROOT, "src/app/more/page.tsx")));

  const barSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/now-playing-bar.tsx"),
    "utf8"
  );
  assert.match(barSrc, /href="\/lyrics"/);
});

test("LiquidGlass library is installed and applied strictly to navbars only", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  );
  assert.ok(
    pkg.dependencies["glasskit-liquid-glass"],
    "glasskit-liquid-glass should be installed in dependencies"
  );
  const layoutSrc = fs.readFileSync(
    path.join(ROOT, "src/app/layout.tsx"),
    "utf8"
  );
  assert.match(layoutSrc, /glasskit-liquid-glass\/styles\.css/);
  const topBarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/top-bar.tsx"),
    "utf8"
  );
  assert.match(topBarSrc, /LiquidGlass/);
  // Ensure LiquidGlass is NOT applied to non-navbar surfaces like sidebar or media cards
  const sidebarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/left-sidebar.tsx"),
    "utf8"
  );
  const cardSrc = fs.readFileSync(
    path.join(ROOT, "src/components/music/media-card.tsx"),
    "utf8"
  );
  assert.equal(sidebarSrc.includes("LiquidGlass"), false);
  assert.equal(cardSrc.includes("LiquidGlass"), false);
});

test("Dark and Light emerald themes, 5-band Equalizer, and platform-aware native downloads/device scan exist", () => {
  const cssSrc = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8"
  );
  assert.match(cssSrc, /html\.dark/);
  assert.match(cssSrc, /html\.light/);

  const settingsSrc = fs.readFileSync(
    path.join(ROOT, "src/app/settings/page.tsx"),
    "utf8"
  );
  assert.match(settingsSrc, /5-Band Equalizer/);
  assert.match(settingsSrc, /useEQStore/);

  const modalSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/app-download-modal.tsx"),
    "utf8"
  );
  assert.match(modalSrc, /if\s*\(!isWeb\)\s*return\s+null/);

  const platformSrc = fs.readFileSync(
    path.join(ROOT, "src/lib/platform.ts"),
    "utf8"
  );
  assert.match(platformSrc, /isExcludedNonMusicAudio/);
  assert.match(platformSrc, /ringtones/);
  assert.match(platformSrc, /recordings/);

  const androidSrc = fs.readFileSync(
    path.join(
      ROOT,
      "android/app/src/main/java/xyz/shasant/sangeet/MainActivity.java"
    ),
    "utf8"
  );
  assert.match(androidSrc, /IS_RINGTONE/);
  assert.match(androidSrc, /isExcludedNonMusicPath/);

  const rustSrc = fs.readFileSync(
    path.join(ROOT, "desktop-rust/src/main.rs"),
    "utf8"
  );
  assert.match(rustSrc, /scan_local_audio/);
  assert.match(rustSrc, /download_audio_track/);
  assert.match(rustSrc, /is_excluded_non_music/);
});

test("Each feature has a clear primary location without duplicating across TopBar, Profile, Library, Settings, and More", () => {
  const topBarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/top-bar.tsx"),
    "utf8"
  );
  const sidebarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/left-sidebar.tsx"),
    "utf8"
  );
  const moreSrc = fs.readFileSync(
    path.join(ROOT, "src/app/more/page.tsx"),
    "utf8"
  );

  // Explore lives in TopBar, not duplicated in More
  assert.ok(topBarSrc.includes('href="/explore"'));
  assert.equal(moreSrc.includes('href="/explore"'), false);

  // Offline & Recently played live in Library, not duplicated in Profile menu or More
  assert.ok(sidebarSrc.includes('"/offline"'));
  assert.ok(sidebarSrc.includes('"/recently-played"'));
  assert.equal(topBarSrc.includes('href="/offline"'), false);
  assert.equal(topBarSrc.includes('href="/recently-played"'), false);
  assert.equal(moreSrc.includes('href="/offline"'), false);
  assert.equal(moreSrc.includes('href="/recently-played"'), false);

  // Listening stats lives in Profile menu, not duplicated in More
  assert.ok(topBarSrc.includes('href="/stats"'));
  assert.equal(moreSrc.includes('href="/stats"'), false);

  // Inline playback preference toggles live in Settings, not duplicated in More
  assert.equal(moreSrc.includes("setAutoplayRadio"), false);
  assert.equal(moreSrc.includes("setSponsorBlockEnabled"), false);
  assert.equal(moreSrc.includes("setSleepTimer"), false);

  // More keeps curated extras, native app downloads, and tools
  for (const route of [
    "/made-for-you",
    "/new-releases",
    "/settings",
    "/api/download/android",
    "/api/download/windows"
  ]) {
    assert.ok(moreSrc.includes(route), `/more should link to ${route}`);
  }
});

test("Lyrics page avoids dark unreadable upcoming lines and uses shared store", () => {
  const lyricsSrc = fs.readFileSync(
    path.join(ROOT, "src/app/lyrics/page.tsx"),
    "utf8"
  );
  assert.equal(lyricsSrc.includes("text-black/45"), false);
  assert.match(lyricsSrc, /text-white\/60/);
});

test("Destructive actions use ConfirmDialog instead of unguarded instant deletes", () => {
  for (const rel of [
    "src/app/playlist/[id]/page.tsx",
    "src/app/offline/page.tsx",
    "src/app/settings/page.tsx",
    "src/app/queue/page.tsx"
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(src, /ConfirmDialog/, `${rel} should use ConfirmDialog`);
  }
});

test("ID3 metadata extractor and offline export helpers exist", () => {
  const metaSrc = fs.readFileSync(
    path.join(ROOT, "src/lib/audio-metadata.ts"),
    "utf8"
  );
  assert.match(metaSrc, /extractAudioMetadata/);
  assert.match(metaSrc, /parseFilenameMeta/);
  const offlineStoreSrc = fs.readFileSync(
    path.join(ROOT, "src/store/offline-store.ts"),
    "utf8"
  );
  assert.match(offlineStoreSrc, /exportOfflineTrack/);
});

// --- 8. Audio-only playback reliability, Quick Picks, Covers, Footer & Rust Windows App ---
test("Playback engine stays audio-only with startup grace guard against immediate pause", () => {
  const engineSrc = fs.readFileSync(
    path.join(ROOT, "src/components/player/playback-engine.tsx"),
    "utf8"
  );
  assert.match(engineSrc, /loadGraceUntilRef/);
  assert.match(engineSrc, /hasEnteredPlayingRef/);
  assert.match(engineSrc, /opacity-\[0\.01\]/);
  assert.equal(engineSrc.includes("opacity-0"), false);
  assert.equal(engineSrc.includes("videoMode"), false);
  const storeSrc = fs.readFileSync(
    path.join(ROOT, "src/store/player-store.ts"),
    "utf8"
  );
  assert.equal(storeSrc.includes("videoMode"), false);
  assert.equal(storeSrc.includes("playbackRate"), false);
  // Clearing an error (null) must NEVER force isPlaying: false
  assert.match(storeSrc, /playbackError\s*\?\s*\{\s*playbackError,\s*isBuffering:\s*false,\s*isPlaying:\s*false\s*\}\s*:\s*\{\s*playbackError:\s*null\s*\}/);
});

test("Audius downloads filter streamable tracks and clear connect timeout before streaming body", () => {
  const searchSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/audius/search/route.ts"),
    "utf8"
  );
  assert.match(searchSrc, /is_streamable\s*!==\s*false/);
  assert.match(searchSrc, /app_name/);
  const streamSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/audius/stream/route.ts"),
    "utf8"
  );
  assert.match(streamSrc, /clearTimeout\(connectTimeout\)/);
  assert.match(streamSrc, /Content-Disposition/);
});

test("Google OAuth redirects Android app users back to sangeet://auth deep link and removes install popups", () => {
  const googleSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/auth/google/route.ts"),
    "utf8"
  );
  assert.match(googleSrc, /state.*android/);
  const cbSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/auth/google/callback/route.ts"),
    "utf8"
  );
  assert.match(cbSrc, /sangeet:\/\/auth\?session=/);
  const pwaSrc = fs.readFileSync(
    path.join(ROOT, "src/components/pwa/pwa-register.tsx"),
    "utf8"
  );
  assert.equal(pwaSrc.includes("Install Sangeet App"), false);
  assert.match(pwaSrc, /return null/);
});

test("YouTube playlist importer is removed from sidebar and library", () => {
  const sidebarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/left-sidebar.tsx"),
    "utf8"
  );
  const librarySrc = fs.readFileSync(
    path.join(ROOT, "src/app/library/page.tsx"),
    "utf8"
  );
  assert.equal(sidebarSrc.includes("playlist-import"), false);
  assert.equal(librarySrc.includes("playlist-import"), false);
});

test("Home renders YouTube Music style Quick Picks and dynamic ArtworkMosaic exists", () => {
  const homeSrc = fs.readFileSync(path.join(ROOT, "src/app/home/page.tsx"), "utf8");
  assert.match(homeSrc, /Start radio from a song/);
  assert.match(homeSrc, /Quick picks/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "src/components/music/artwork-mosaic.tsx"))
  );
});

test("SiteFooter includes Shasant signature and GitHub repository link", () => {
  const footerSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/site-footer.tsx"),
    "utf8"
  );
  assert.match(footerSrc, /https:\/\/github\.com\/shasantx\/sangeet/);
  assert.match(footerSrc, /Shasant/);
  const landingSrc = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  assert.match(landingSrc, /SiteFooter/);
});

test("Zentra Cobalt-Obsidian theme, floating LiquidGlass refraction, and security hardening are configured", () => {
  const cssSrc = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8"
  );
  assert.match(cssSrc, /#e2363e/);
  assert.match(cssSrc, /\.btn-cobalt/);
  assert.match(cssSrc, /\.zentra-aurora-mesh/);

  const shellSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/app-shell.tsx"),
    "utf8"
  );
  assert.match(shellSrc, /zentra-aurora-mesh/);
  assert.match(shellSrc, /pt-\[68px\]/);

  const topBarSrc = fs.readFileSync(
    path.join(ROOT, "src/components/shell/top-bar.tsx"),
    "utf8"
  );
  assert.match(topBarSrc, /renderMode="css"/);

  const homeRouteSrc = fs.readFileSync(
    path.join(ROOT, "src/app/api/music/home/route.ts"),
    "utf8"
  );
  assert.match(homeRouteSrc, /Cache-Control/);
  assert.match(homeRouteSrc, /inFlight/);

  const nextCfg = fs.readFileSync(path.join(ROOT, "next.config.mjs"), "utf8");
  assert.match(nextCfg, /poweredByHeader:\s*false/);
  assert.match(nextCfg, /Strict-Transport-Security/);
  assert.match(nextCfg, /Content-Security-Policy/);
  assert.match(nextCfg, /isProd \? "" : " 'unsafe-eval'"/);
  assert.match(nextCfg, /X-Frame-Options/);
  assert.match(nextCfg, /X-Content-Type-Options/);
  assert.match(nextCfg, /Referrer-Policy/);
  assert.match(nextCfg, /Permissions-Policy/);

  assert.ok(fs.existsSync(path.join(ROOT, "src/lib/rate-limit.ts")));
  const authSrc = fs.readFileSync(
    path.join(ROOT, "src/lib/auth-session.ts"),
    "utf8"
  );
  assert.match(authSrc, /sanitizeReturnTo/);
  assert.match(authSrc, /createOAuthState/);
  assert.match(authSrc, /verifyOAuthState/);

  // Guard against regressions: fixed navbar positioning, single download in player, sleep timer in player only, resilient artwork
  assert.equal(/\.sangeet-glass-navbar\s*\{\s*position:\s*relative/.test(cssSrc), false);
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/music/track-artwork.tsx")));

  const settingsSrc = fs.readFileSync(
    path.join(ROOT, "src/app/settings/page.tsx"),
    "utf8"
  );
  assert.equal(settingsSrc.includes("setSleepTimer"), false);

  const mobileSheetSrc = fs.readFileSync(
    path.join(ROOT, "src/components/player/mobile-now-playing-sheet.tsx"),
    "utf8"
  );
  assert.match(mobileSheetSrc, /dragY/);
  const dlCalls = mobileSheetSrc.match(/handleDownload\(\)/g) ?? [];
  assert.equal(dlCalls.length, 1, "MobileNowPlayingSheet should have exactly one download button");

  // Interactive playlist creation modal, global download progress tray & open-source repo docs
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/music/create-playlist-modal.tsx")));
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/shell/download-progress-tray.tsx")));
  assert.ok(fs.existsSync(path.join(ROOT, "SECURITY.md")));
  assert.ok(fs.existsSync(path.join(ROOT, "CONTRIBUTING.md")));

  // Android never opens unclosable RightPanel overlay and always redirects root to /home
  const uiStoreSrc = fs.readFileSync(
    path.join(ROOT, "src/store/ui-store.ts"),
    "utf8"
  );
  assert.match(uiStoreSrc, /rightTab:\s*null/);
  const landingSrc = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  assert.match(landingSrc, /router\.replace\("\/home"\)/);

  // Queue toggle, horizontal player swipe, brand logo, and Android sync/notification icon
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/ui/sangeet-logo.tsx")));
  assert.ok(fs.existsSync(path.join(ROOT, "public/brand/sangeet-logo.png")));
  assert.ok(
    fs.existsSync(
      path.join(ROOT, "android/app/src/main/res/drawable/ic_stat_sangeet.xml")
    )
  );
  const playerStoreSrc = fs.readFileSync(
    path.join(ROOT, "src/store/player-store.ts"),
    "utf8"
  );
  assert.match(playerStoreSrc, /toggleQueueTrack/);
  assert.match(mobileSheetSrc, /swipeX/);
});

test("Windows desktop client is implemented in Rust (Tauri v2) with icons and CI workflow", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "desktop-rust/Cargo.toml")));
  assert.ok(fs.existsSync(path.join(ROOT, "desktop-rust/src/main.rs")));
  assert.ok(fs.existsSync(path.join(ROOT, "desktop-rust/tauri.conf.json")));
  assert.ok(fs.existsSync(path.join(ROOT, "desktop-rust/icons/icon.ico")));
  const cargoSrc = fs.readFileSync(
    path.join(ROOT, "desktop-rust/Cargo.toml"),
    "utf8"
  );
  assert.match(cargoSrc, /tauri\s*=/);
  const ciSrc = fs.readFileSync(
    path.join(ROOT, ".github/workflows/windows-desktop.yml"),
    "utf8"
  );
  assert.match(ciSrc, /dtolnay\/rust-toolchain/);
  assert.match(ciSrc, /cargo build --release/);
});

test("Audio format switcher defaults to AAC, is saved per user, and is wired on every platform", () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

  const storeSrc = read("src/store/audio-format-store.ts");
  assert.match(storeSrc, /DEFAULT_AUDIO_FORMAT: AudioFormat = "aac"/);
  assert.match(storeSrc, /byUser: Record<string, AudioFormat>/);
  assert.match(storeSrc, /name: "sangeet-v2-audio-format"/);

  const transcoderSrc = read("src/lib/aac-transcoder.ts");
  // Source-first: native AAC (MP4/ADTS) is played untouched before any encoding.
  assert.match(transcoderSrc, /container === "mp4" \|\| container === "adts"\) return originalSource\(url, "native-aac"\)/);
  // Chunked, data-saving streaming transcode via MediaSource + WebCodecs.
  assert.match(transcoderSrc, /BUFFER_AHEAD_SECONDS = 30/);
  assert.match(transcoderSrc, /fastStart: "fragmented"/);
  assert.match(transcoderSrc, /Range: `bytes=\$\{start\}-\$\{endInclusive\}`/);
  assert.match(transcoderSrc, /codec: "mp3"/);

  const engineSrc = read("src/components/player/playback-engine.tsx");
  assert.match(engineSrc, /prepareAacSource\(/);
  assert.match(engineSrc, /prefetchStreamHead\(/);
  assert.match(engineSrc, /setPreferredAudioFormat\?\.\(audioFormat\)/);

  assert.match(read("src/app/settings/page.tsx"), /Audio format/);
  assert.match(read("src/store/offline-store.ts"), /convertBlobToAac\(/);

  const extractorSrc = read(
    "android/app/src/main/java/xyz/shasant/sangeet/YouTubeInnerTubeExtractor.java"
  );
  assert.match(extractorSrc, /public static void setPreferredAudioFormat/);
  assert.match(
    read("android/app/src/main/java/xyz/shasant/sangeet/MainActivity.java"),
    /public void setPreferredAudioFormat\(String format\)/
  );

  const rustSrc = read("desktop-rust/src/main.rs");
  assert.match(rustSrc, /fn save_audio_bytes\(request: tauri::ipc::Request/);
  assert.match(rustSrc, /save_audio_bytes,/);
  assert.match(rustSrc, /saveAudioBytes: \(meta, bytes\)/);
});

test("Jam (listen together) is host-authoritative over Supabase Realtime and off until configured", () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const session = read("src/lib/jam-session.ts");
  const store = read("src/store/jam-store.ts");
  const page = read("src/app/jam/page.tsx");
  const nextConfig = read("next.config.mjs");
  const envExample = read(".env.example");

  // Transport: broadcast + presence only, no tables, lazy-loaded client, codes from crypto
  assert.match(session, /import\("@supabase\/supabase-js"\)/);
  assert.match(session, /presence: \{ key: this\.memberId \}/);
  assert.match(session, /crypto\.getRandomValues/);
  assert.doesNotMatch(session, /\.from\(["']/);
  // Guests only forward their own taps, and only the host can change playback unless allowed
  assert.match(session, /lastGestureAt > 1500/);
  assert.match(session, /if \(!this\.allowGuestControl\) return;/);
  // Device-only files are never shared
  assert.match(session, /delete copy\.localUrl;/);
  // Off until configured; CSP opened only for the configured project
  assert.match(session, /NEXT_PUBLIC_SUPABASE_URL && process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(nextConfig, /wss:\/\/\$\{host\}/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
  // Only the display name is persisted; a Jam never silently reconnects
  assert.match(store, /partialize: \(s\) => \(\{ displayName: s\.displayName \}\)/);
  assert.match(page, /Jam isn&apos;t switched on yet/);
});

test("EQ + spatial sound reach every playback path and the real format is shown", () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const engine = read("src/components/player/playback-engine.tsx");
  const fx = read("src/lib/audio-effects.ts");
  const service = read("android/app/src/main/java/xyz/shasant/sangeet/SangeetAudioService.java");
  const activity = read("android/app/src/main/java/xyz/shasant/sangeet/MainActivity.java");
  const dsp = read("android/app/src/main/java/xyz/shasant/sangeet/DhunAudioEffects.java");
  const settings = read("src/app/settings/page.tsx");

  // Web: one shared chain (headroom -> 5 biquads -> spatial) on the <audio> element
  assert.match(engine, /createEffectsChain\(ctx, source\)/);
  assert.match(fx, /channelInterpretation = "speakers"/); // mono files play in both ears
  assert.match(fx, /export function headroomDb/);
  // Android: the same EQ/spatial inside ExoPlayer for YouTube + streams, set live from the web UI
  assert.match(service, /setAudioProcessors\(new AudioProcessor\[\]\{new DhunAudioEffects\(\)\}\)/);
  assert.match(activity, /public void setAudioEffects\(boolean eqEnabled, String gainsCsv, String spatial\)/);
  assert.match(engine, /setAudioEffects\?\.\(eqEnabled, eqGains\.join\(","\), spatial\)/);
  assert.match(dsp, /return AudioProcessor\.AudioFormat\.NOT_SET;/); // unknown formats pass through, never fail playback
  // The decoded format is reported back and shown, so the AAC/Original switch is visible
  assert.match(service, /onTracksChanged/);
  assert.match(engine, /type === "audio_format"/);
  assert.match(settings, /Now playing: /);
  assert.match(settings, /Spatial sound/);
});
