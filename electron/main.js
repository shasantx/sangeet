const { app, BrowserWindow, dialog, globalShortcut, Menu, Tray, ipcMain, shell, nativeImage, protocol, session } = require("electron");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "sangeet-local",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".aac",
  ".flac",
  ".wav",
  ".ogg",
  ".opus",
  ".wma",
  ".aiff",
  ".alac",
  ".webm",
]);

const MIME_BY_EXTENSION = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".wma": "audio/x-ms-wma",
  ".aiff": "audio/aiff",
  ".alac": "audio/mp4",
  ".webm": "audio/webm",
};

const allowedAudioById = new Map();
const MAX_SCAN_TRACKS = 1500;
const MAX_SCAN_DEPTH = 5;
const YOUTUBE_MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const YOUTUBE_VISITOR_TTL_MS = 30 * 60 * 1000;
let cachedYouTubeVisitorData = null;

const YOUTUBE_INNERTUBE_CLIENTS = [
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    client: {
      clientName: "VISIONOS",
      clientVersion: "1.02",
      deviceMake: "Apple",
      deviceModel: "RealityDevice17,1",
      osName: "visionOS",
      osVersion: "26.5.23O471",
    },
  },
  {
    userAgent:
      "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_1 like Mac OS X;)",
    client: {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.1.22D72",
    },
  },
  {
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    client: {
      clientName: "ANDROID_VR",
      clientVersion: "1.65.10",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      androidSdkVersion: 32,
      osName: "Android",
      osVersion: "12L",
    },
  },
];

function isAllowedYouTubeStreamUrl(candidate) {
  if (typeof candidate !== "string") return false;
  try {
    const parsed = new URL(candidate);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname.endsWith(".googlevideo.com") || parsed.hostname.endsWith(".youtube.com"))
    );
  } catch {
    return false;
  }
}

async function getYouTubeVisitorData() {
  if (cachedYouTubeVisitorData && Date.now() - cachedYouTubeVisitorData.at < YOUTUBE_VISITOR_TTL_MS) {
    return cachedYouTubeVisitorData.value;
  }
  try {
    const swRes = await fetch("https://www.youtube.com/sw.js_data", {
      headers: { "User-Agent": YOUTUBE_INNERTUBE_CLIENTS[0].userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (swRes.ok) {
      const text = await swRes.text();
      const match = text.match(/"(Cg[A-Za-z0-9_\-=%+/]{10,})"/);
      if (match && match[1]) {
        cachedYouTubeVisitorData = { value: match[1], at: Date.now() };
        return match[1];
      }
    }
  } catch {
    // Fallback to visitor_id endpoint below
  }
  try {
    const visitorRes = await fetch("https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": YOUTUBE_INNERTUBE_CLIENTS[0].userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20241114.01.00",
            hl: "en",
            gl: "US",
          },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (visitorRes.ok) {
      const json = await visitorRes.json();
      const vd = json?.responseContext?.visitorData;
      if (typeof vd === "string" && vd.length > 0) {
        cachedYouTubeVisitorData = { value: vd, at: Date.now() };
        return vd;
      }
    }
  } catch {
    // Continue without visitorData
  }
  return "";
}

function normalizeDesktopAudioMime(rawHeaderType, fallbackFormatType, streamUrl) {
  const clean = (val) =>
    typeof val === "string" ? val.split(";")[0].trim().toLowerCase() : "";
  const headerMime = clean(rawHeaderType);
  if (headerMime && headerMime !== "application/octet-stream") {
    if (headerMime.startsWith("audio/") || headerMime.startsWith("video/")) {
      return headerMime;
    }
    return null;
  }
  const formatMime = clean(fallbackFormatType);
  if (formatMime && (formatMime.startsWith("audio/") || formatMime.startsWith("video/"))) {
    return formatMime;
  }
  const lowerUrl = String(streamUrl || "").toLowerCase();
  if (lowerUrl.includes("mime=audio%2fwebm") || lowerUrl.includes("mime=audio/webm")) {
    return "audio/webm";
  }
  return "audio/mp4";
}

async function fetchYouTubeAudioBuffer(videoId) {
  const visitorData = await getYouTubeVisitorData();
  let lastError = "Could not extract YouTube audio stream.";

  for (const profile of YOUTUBE_INNERTUBE_CLIENTS) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": profile.userAgent,
      };
      if (visitorData) {
        headers["X-Goog-Visitor-Id"] = visitorData;
      }
      const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers,
        body: JSON.stringify({
          context: {
            client: {
              ...profile.client,
              hl: "en",
              gl: "US",
              ...(visitorData ? { visitorData } : {}),
            },
          },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!playerRes.ok) {
        lastError = `InnerTube player returned HTTP ${playerRes.status}`;
        continue;
      }
      const payload = await playerRes.json();
      if (payload?.playabilityStatus?.status !== "OK") {
        lastError = payload?.playabilityStatus?.reason || "Track is unavailable on YouTube.";
        continue;
      }

      const adaptive = Array.isArray(payload?.streamingData?.adaptiveFormats)
        ? payload.streamingData.adaptiveFormats
        : [];
      const audioFormats = adaptive.filter(
        (fmt) =>
          fmt &&
          typeof fmt.mimeType === "string" &&
          fmt.mimeType.startsWith("audio/") &&
          isAllowedYouTubeStreamUrl(fmt.url),
      );
      if (audioFormats.length === 0) continue;

      const mp4Formats = audioFormats
        .filter((fmt) => fmt.mimeType.includes("audio/mp4"))
        .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
      const webmFormats = audioFormats
        .filter((fmt) => fmt.mimeType.includes("audio/webm"))
        .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
      const otherFormats = audioFormats
        .filter((fmt) => !fmt.mimeType.includes("audio/mp4") && !fmt.mimeType.includes("audio/webm"))
        .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));

      const candidates = [mp4Formats[0], webmFormats[0], otherFormats[0]].filter(Boolean);
      for (const fmt of candidates) {
        try {
          const streamRes = await fetch(fmt.url, {
            headers: {
              "User-Agent": profile.userAgent,
              Accept: "*/*",
            },
            signal: AbortSignal.timeout(45000),
          });
          if (!streamRes.ok) {
            lastError = `YouTube CDN returned HTTP ${streamRes.status}`;
            continue;
          }
          const contentLength = Number(streamRes.headers.get("content-length") || 0);
          if (Number.isFinite(contentLength) && contentLength > YOUTUBE_MAX_AUDIO_BYTES) {
            lastError = "Audio file exceeds 40MB offline limit.";
            continue;
          }
          const mimeType = normalizeDesktopAudioMime(
            streamRes.headers.get("content-type"),
            fmt.mimeType,
            fmt.url,
          );
          if (!mimeType) {
            lastError = "YouTube returned an invalid audio content type.";
            continue;
          }
          let bytes;
          if (streamRes.body && typeof streamRes.body.getReader === "function") {
            const reader = streamRes.body.getReader();
            const chunks = [];
            let totalRead = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                totalRead += value.byteLength;
                if (totalRead > YOUTUBE_MAX_AUDIO_BYTES) {
                  await reader.cancel().catch(() => {});
                  throw new Error("Audio file exceeds 40MB offline limit.");
                }
                chunks.push(value);
              }
            }
            if (totalRead <= 0) {
              lastError = "Downloaded audio file was empty.";
              continue;
            }
            bytes = new Uint8Array(totalRead);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
          } else {
            const arrayBuffer = await streamRes.arrayBuffer();
            if (arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > YOUTUBE_MAX_AUDIO_BYTES) {
              lastError =
                arrayBuffer.byteLength <= 0
                  ? "Downloaded audio file was empty."
                  : "Audio file exceeds 40MB offline limit.";
              continue;
            }
            bytes = new Uint8Array(arrayBuffer);
          }
          return {
            ok: true,
            mimeType,
            bytes,
          };
        } catch (err) {
          if (err && typeof err.message === "string" && err.message) {
            lastError = err.message;
          }
        }
      }
    } catch (err) {
      if (err && typeof err.message === "string" && err.message) {
        lastError = err.message;
      }
    }
  }

  return { ok: false, error: lastError };
}

function getFoldersStorePath() {
  return path.join(app.getPath("userData"), "music-folders.json");
}

function getDefaultMusicFolders() {
  const candidates = [];
  try {
    const musicDir = app.getPath("music");
    if (musicDir && fs.existsSync(musicDir)) candidates.push(musicDir);
  } catch {
    // Ignore missing OS Music directory
  }
  return candidates;
}

function loadSavedMusicFolders() {
  const storeFile = getFoldersStorePath();
  let stored = [];
  try {
    if (fs.existsSync(storeFile)) {
      const parsed = JSON.parse(fs.readFileSync(storeFile, "utf8"));
      if (Array.isArray(parsed)) {
        stored = parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
      }
    }
  } catch {
    stored = [];
  }
  const combined = new Set([...getDefaultMusicFolders(), ...stored]);
  return Array.from(combined).filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

function saveMusicFolders(folders) {
  try {
    const unique = Array.from(new Set(folders.map((f) => path.resolve(f))));
    fs.mkdirSync(path.dirname(getFoldersStorePath()), { recursive: true });
    fs.writeFileSync(getFoldersStorePath(), JSON.stringify(unique, null, 2), "utf8");
  } catch {
    // Ignore disk write issues
  }
}

function parseTrackMetadataFromPath(filePath) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext).trim();
  const folderName = path.basename(path.dirname(filePath)) || "Local music";
  const splitIdx = baseName.indexOf(" - ");
  if (splitIdx > 1 && splitIdx < baseName.length - 4) {
    return {
      artist: baseName.slice(0, splitIdx).trim().slice(0, 100),
      title: baseName.slice(splitIdx + 3).trim().slice(0, 140),
      album: folderName,
    };
  }
  return {
    artist: "On this PC",
    title: (baseName || "Untitled track").slice(0, 140),
    album: folderName,
  };
}

function scanMusicFolders(folders) {
  const tracks = [];
  const seenPaths = new Set();

  function walk(dirPath, depth) {
    if (depth > MAX_SCAN_DEPTH || tracks.length >= MAX_SCAN_TRACKS) return;
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (tracks.length >= MAX_SCAN_TRACKS) break;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!AUDIO_EXTENSIONS.has(ext)) continue;
        const resolved = path.resolve(fullPath);
        if (seenPaths.has(resolved)) continue;
        seenPaths.add(resolved);
        try {
          const stat = fs.statSync(resolved);
          if (!stat.isFile() || stat.size <= 0) continue;
          const id = crypto.createHash("sha1").update(resolved).digest("hex").slice(0, 20);
          allowedAudioById.set(id, resolved);
          const meta = parseTrackMetadataFromPath(resolved);
          tracks.push({
            id,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            duration: 0,
            uri: `sangeet-local://track/${encodeURIComponent(id)}`,
            sizeBytes: stat.size,
            folder: path.dirname(resolved),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  for (const folder of folders) {
    walk(path.resolve(folder), 0);
  }
  tracks.sort((a, b) => a.title.localeCompare(b.title));
  return tracks;
}

function registerLocalAudioProtocol(targetSession) {
  const handler = async (request) => {
    try {
      const parsed = new URL(request.url);
      if (parsed.hostname !== "track") {
        return new Response("Not found", { status: 404 });
      }
      const id = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      const filePath = allowedAudioById.get(id);
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response("Track not found", { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const total = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_BY_EXTENSION[ext] || "audio/mpeg";
      const rangeHeader = request.headers.get("range");
      const baseHeaders = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, max-age=3600",
      };

      if (rangeHeader && rangeHeader.startsWith("bytes=")) {
        const [startStr, endStr] = rangeHeader.replace(/^bytes=/, "").split("-");
        const start = startStr ? parseInt(startStr, 10) : 0;
        const end = endStr ? Math.min(parseInt(endStr, 10), total - 1) : total - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${total}` },
          });
        }
        const chunkLen = end - start + 1;
        const buffer = Buffer.allocUnsafe(chunkLen);
        const fd = fs.openSync(filePath, "r");
        try {
          fs.readSync(fd, buffer, 0, chunkLen, start);
        } finally {
          fs.closeSync(fd);
        }
        return new Response(buffer, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Length": String(chunkLen),
          },
        });
      }

      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          ...baseHeaders,
          "Content-Length": String(total),
        },
      });
    } catch {
      return new Response("Could not read local audio file", { status: 500 });
    }
  };

  try {
    targetSession.protocol.handle("sangeet-local", handler);
  } catch {
    // Ignore duplicate handler registration
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let currentTrack = null;
let isPlaying = false;

// Windows AppUserModelId for taskbar groupings and notifications
if (process.platform === "win32") {
  app.setAppUserModelId("xyz.shasant.sangeet");
}

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
const APP_URL = process.env.SANGEET_APP_URL || (isDev ? "http://localhost:3000/home" : "https://sangeet.shasant.xyz/home");

const ALLOWED_WINDOW_ORIGINS = new Set([
  "https://sangeet.shasant.xyz",
  "https://accounts.google.com",
]);
if (isDev) {
  ALLOWED_WINDOW_ORIGINS.add("http://localhost:3000");
  ALLOWED_WINDOW_ORIGINS.add("http://127.0.0.1:3000");
}
try {
  ALLOWED_WINDOW_ORIGINS.add(new URL(APP_URL).origin);
} catch {
  // Ignore invalid env override
}

function isAllowedInWindowUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_WINDOW_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function getAppIcon() {
  const iconPaths = [
    path.join(__dirname, "../public/brand/sangeet-icon-512.png"),
    path.join(__dirname, "../public/brand/sangeet-icon-192.png"),
    path.join(__dirname, "../public/brand/sangeet-icon-180.png"),
  ];
  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }
  }
  return null;
}

function lockDownSessionPermissions() {
  try {
    const targetSession = session.fromPartition("persist:sangeet_desktop_session");
    targetSession.setPermissionRequestHandler((webContents, permission, callback) => {
      try {
        const origin = new URL(webContents.getURL()).origin;
        if (ALLOWED_WINDOW_ORIGINS.has(origin) && (permission === "media" || permission === "fullscreen")) {
          callback(true);
          return;
        }
      } catch {
        // Deny invalid origins
      }
      callback(false);
    });
    targetSession.setPermissionCheckHandler((webContents, permission) => {
      try {
        const origin = new URL(webContents.getURL()).origin;
        return ALLOWED_WINDOW_ORIGINS.has(origin) && (permission === "media" || permission === "fullscreen");
      } catch {
        return false;
      }
    });
  } catch {
    // Ignore if session not initialized yet
  }
}

function createMainWindow() {
  lockDownSessionPermissions();
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: "#090b09",
    title: "Sangeet - Music for every mood",
    icon: icon || undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: "persist:sangeet_desktop_session",
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
    },
  });

  const loadOfflinePlayer = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const offlinePath = path.join(__dirname, "../public/offline.html");
    if (fs.existsSync(offlinePath)) {
      mainWindow.loadFile(offlinePath).catch(() => {});
    }
  };

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _desc, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    loadOfflinePlayer();
  });

  mainWindow.loadURL(APP_URL).catch((err) => {
    console.error("Failed to load APP_URL:", err);
    loadOfflinePlayer();
  });

  // Prevent navigation to untrusted origins inside the Electron window
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isAllowedInWindowUrl(navigationUrl)) {
      event.preventDefault();
      if (isSafeExternalUrl(navigationUrl)) {
        shell.openExternal(navigationUrl);
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInWindowUrl(url)) {
      return { action: "allow" };
    }
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setupTray();
  registerMediaShortcuts();
}

function setupTray() {
  if (tray) return;

  const icon = getAppIcon();
  if (!icon) return;

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Sangeet - Music for every mood");

  updateTrayMenu();

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const nowPlayingLabel = currentTrack
    ? `${isPlaying ? "▶" : "⏸"} ${currentTrack.title} — ${currentTrack.artist || "Sangeet"}`
    : "Sangeet — No track playing";

  const contextMenu = Menu.buildFromTemplate([
    { label: nowPlayingLabel, enabled: false },
    { type: "separator" },
    {
      label: isPlaying ? "Pause" : "Play",
      click: () => sendMediaAction("play-pause"),
    },
    {
      label: "Next Track",
      click: () => sendMediaAction("next"),
    },
    {
      label: "Previous Track",
      click: () => sendMediaAction("previous"),
    },
    { type: "separator" },
    {
      label: "Open Sangeet",
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Quit Sangeet",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function sendMediaAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("media-action", action);
  }
}

function registerMediaShortcuts() {
  globalShortcut.register("MediaPlayPause", () => sendMediaAction("play-pause"));
  globalShortcut.register("MediaNextTrack", () => sendMediaAction("next"));
  globalShortcut.register("MediaPreviousTrack", () => sendMediaAction("previous"));
  globalShortcut.register("MediaStop", () => sendMediaAction("stop"));
}

// Window management IPC
ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.close();
});

// Playback state updates from frontend app (strictly sanitized)
ipcMain.on("playback-state-update", (_event, data) => {
  if (!data || typeof data !== "object") return;
  isPlaying = Boolean(data.isPlaying);
  if (data.track && typeof data.track === "object") {
    const safeTitle = typeof data.track.title === "string" ? data.track.title.slice(0, 120) : "Untitled";
    const safeArtist = typeof data.track.artist === "string" ? data.track.artist.slice(0, 100) : "Sangeet";
    currentTrack = { title: safeTitle, artist: safeArtist };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${safeTitle} · ${safeArtist} — Sangeet`);
    }
  }
  if (tray) {
    const tip = currentTrack
      ? `${currentTrack.title} · ${currentTrack.artist || "Sangeet"}`
      : "Sangeet - Music for every mood";
    tray.setToolTip(tip.slice(0, 120));
    updateTrayMenu();
  }
});

ipcMain.handle("music:get-folders", () => {
  return loadSavedMusicFolders();
});

ipcMain.handle("music:pick-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: "Select music folder for offline playback",
    properties: ["openDirectory"],
  });
  const current = loadSavedMusicFolders();
  if (!result.canceled && Array.isArray(result.filePaths) && result.filePaths.length > 0) {
    const next = Array.from(new Set([...current, ...result.filePaths.map((p) => path.resolve(p))]));
    saveMusicFolders(next);
    return { folders: next, tracks: scanMusicFolders(next) };
  }
  return { folders: current, tracks: scanMusicFolders(current) };
});

ipcMain.handle("music:remove-folder", (_event, folderToRemove) => {
  const target = typeof folderToRemove === "string" ? path.resolve(folderToRemove) : "";
  const next = loadSavedMusicFolders().filter((f) => path.resolve(f) !== target);
  saveMusicFolders(next);
  return { folders: next, tracks: scanMusicFolders(next) };
});

ipcMain.handle("music:scan-library", () => {
  const folders = loadSavedMusicFolders();
  return { folders, tracks: scanMusicFolders(folders) };
});

ipcMain.handle("youtube:fetch-audio", async (event, videoId) => {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || "";
  if (senderUrl && !isAllowedInWindowUrl(senderUrl)) {
    return { ok: false, error: "Forbidden origin" };
  }
  const cleanId = typeof videoId === "string" ? videoId.trim() : "";
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanId)) {
    return { ok: false, error: "Invalid videoId" };
  }
  return fetchYouTubeAudioBuffer(cleanId);
});

ipcMain.handle("app:reconnect-online", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(APP_URL).catch(() => {});
  }
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("ready", () => {
  try {
    registerLocalAudioProtocol(session.fromPartition("persist:sangeet_desktop_session"));
  } catch {
    // Ignore session registration errors
  }
  createMainWindow();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
