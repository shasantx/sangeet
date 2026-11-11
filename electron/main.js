const { app, BrowserWindow, globalShortcut, Menu, Tray, ipcMain, shell, nativeImage, session } = require("electron");
const path = require("path");
const fs = require("fs");

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
const APP_URL = process.env.SANGEET_APP_URL || (isDev ? "http://localhost:3000" : "https://sangeet.shasant.xyz");

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
    targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    targetSession.setPermissionCheckHandler(() => false);
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

  mainWindow.loadURL(APP_URL).catch((err) => {
    console.error("Failed to load APP_URL:", err);
    if (!isDev) {
      const offlinePath = path.join(__dirname, "../public/offline.html");
      if (fs.existsSync(offlinePath)) {
        mainWindow.loadFile(offlinePath);
      }
    }
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

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("ready", createMainWindow);

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
