const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_MEDIA_ACTIONS = new Set(["play-pause", "next", "previous", "stop"]);

contextBridge.exposeInMainWorld("sangeetDesktop", {
  isDesktop: true,
  platform: process.platform,
  onMediaAction: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, action) => {
      if (typeof action === "string" && ALLOWED_MEDIA_ACTIONS.has(action)) {
        callback(action);
      }
    };
    ipcRenderer.on("media-action", handler);
    return () => ipcRenderer.removeListener("media-action", handler);
  },
  sendPlaybackState: (data) => {
    try {
      if (!data || typeof data !== "object") return;
      const safePayload = {
        isPlaying: Boolean(data.isPlaying),
        track:
          data.track && typeof data.track === "object"
            ? {
                title: typeof data.track.title === "string" ? data.track.title.slice(0, 120) : "",
                artist: typeof data.track.artist === "string" ? data.track.artist.slice(0, 100) : "",
              }
            : null,
      };
      ipcRenderer.send("playback-state-update", safePayload);
    } catch {
      // ignore
    }
  },
  getMusicFolders: () => ipcRenderer.invoke("music:get-folders"),
  pickMusicFolder: () => ipcRenderer.invoke("music:pick-folder"),
  removeMusicFolder: (folder) => ipcRenderer.invoke("music:remove-folder", folder),
  scanMusicLibrary: () => ipcRenderer.invoke("music:scan-library"),
  fetchYouTubeAudio: (videoId) => {
    if (typeof videoId !== "string" || !videoId.trim()) {
      return Promise.resolve({ ok: false, error: "Invalid videoId" });
    }
    return ipcRenderer.invoke("youtube:fetch-audio", videoId.trim());
  },
  reconnectOnline: () => ipcRenderer.invoke("app:reconnect-online"),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
