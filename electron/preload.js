const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sangeetDesktop", {
  isDesktop: true,
  platform: process.platform,
  onMediaAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on("media-action", handler);
    return () => ipcRenderer.removeListener("media-action", handler);
  },
  sendPlaybackState: (data) => {
    try {
      ipcRenderer.send("playback-state-update", data);
    } catch (e) {
      // ignore
    }
  },
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
