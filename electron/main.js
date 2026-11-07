const { app, BrowserWindow, globalShortcut, Menu, Tray, ipcMain, shell, nativeImage } = require("electron");
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

function createMainWindow() {
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
      partition: "persist:sangeet_desktop_session", // Persists all Supabase auth tokens, preferences, and cache
      webSecurity: true,
      backgroundThrottling: false, // Ensures music keeps playing smoothly when minimized or in background!
    },
  });

  mainWindow.loadURL(APP_URL).catch((err) => {
    console.error("Failed to load APP_URL:", err);
    // If remote connection fails, attempt localhost fallback or offline page
    if (!isDev) {
      mainWindow.loadURL("http://localhost:3000").catch(() => {
        const offlinePath = path.join(__dirname, "../public/offline.html");
        if (fs.existsSync(offlinePath)) {
          mainWindow.loadFile(offlinePath);
        }
      });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external web links in default system browser
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Keep Google OAuth or internal links in window or popup
      if (url.includes("accounts.google.com") || url.includes("sangeet.shasant.xyz") || url.includes("localhost:3000")) {
        return { action: "allow" };
      }
      shell.openExternal(url);
      return { action: "deny" };
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

// Playback state updates from frontend app
ipcMain.on("playback-state-update", (_event, data) => {
  if (!data) return;
  isPlaying = Boolean(data.isPlaying);
  if (data.track) {
    currentTrack = data.track;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${currentTrack.title} · ${currentTrack.artist || "Sangeet"} — Sangeet`);
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
