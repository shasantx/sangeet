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
