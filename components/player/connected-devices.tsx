"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Laptop2,
  LoaderCircle,
  MonitorSmartphone,
  Pause,
  Play,
  QrCode,
  Radio,
  SkipForward,
  Smartphone,
  Speaker,
  Volume2,
} from "lucide-react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import {
  getDeviceId,
  getGuestSyncId,
  setGuestSyncId,
} from "./connected-device-sync";

type Device = {
  deviceId: string;
  name: string;
  type: string;
  isPlaying: boolean;
  currentTime: number;
  volume?: number;
  track: {
    source: "youtube" | "audius";
    videoId?: string;
    trackId?: string;
    title: string;
    artist: string;
    album: string;
    artwork: string;
    duration: number;
  } | null;
  lastSeen?: string;
};

export function ConnectedDevices() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const trackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [showPairInput, setShowPairInput] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = trackId ? getTrack(trackId) : undefined;
  const currentArtist = current ? getArtist(current.artistId) : undefined;
  const currentAlbum = current ? getAlbum(current.albumId) : undefined;

  const sessionTrack = useMemo(() => {
    if (!current) return null;
    if (current.youtubeId) {
      return {
        source: "youtube" as const,
        videoId: current.youtubeId,
        title: current.title,
        artist: currentArtist?.name ?? "Sangeet artist",
        album: currentAlbum?.title ?? "",
        artwork: current.artwork,
        duration: current.duration,
      };
    }
    if (current.source === "audius") {
      return {
        source: "audius" as const,
        trackId: current.id.replace(/^aud-/, ""),
        title: current.title,
        artist: currentArtist?.name ?? "Independent artist",
        album: currentAlbum?.title ?? "",
        artwork: current.artwork,
        duration: current.duration,
      };
    }
    return null;
  }, [current, currentArtist?.name, currentAlbum?.title]);

  const thisId = typeof window === "undefined" ? "" : getDeviceId();
  const guestSyncId = typeof window === "undefined" ? "" : getGuestSyncId();

  const refresh = useCallback(async () => {
    try {
      const syncId = getGuestSyncId();
      const response = await fetch(
        `/api/devices?deviceId=${encodeURIComponent(thisId)}&syncId=${encodeURIComponent(syncId)}`,
        {
          cache: "no-store",
          headers: { "x-sangeet-sync-id": syncId },
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { devices?: Device[] };
        setDevices(data.devices ?? []);
      }
    } catch {
      // Best-effort refresh
    }
  }, [thisId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  const remoteDevices = devices.filter((device) => device.deviceId !== thisId);
  const activeRemote = remoteDevices.find((device) => device.isPlaying);
  const isPlayingRemotely = Boolean(activeRemote && !isPlaying);

  const sendCommand = async (
    targetDevice: Device,
    action: "play" | "pause" | "next" | "previous" | "volume",
    extra?: { volume?: number },
  ) => {
    setBusy(true);
    const syncId = getGuestSyncId();

    try {
      // 1. Broadcast locally first
      try {
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const bus = new BroadcastChannel("sangeet_device_bus");
          bus.postMessage({
            targetId: targetDevice.deviceId,
            action,
            track: action === "play" ? sessionTrack : undefined,
            currentTime: action === "play" ? currentTime : undefined,
            volume: extra?.volume,
          });
          bus.close();
        }
      } catch {
        // Fall through to server
      }

      // 2. Deliver via server API
      const body: Record<string, unknown> = {
        deviceId: targetDevice.deviceId,
        action,
      };
      if (action === "play") {
        if (!sessionTrack) {
          toast.info("Transfer track", "Pick a song to transfer to your device.");
          setBusy(false);
          return;
        }
        body.track = sessionTrack;
        body.currentTime = currentTime;
      }
      if (extra?.volume !== undefined) {
        body.volume = extra.volume;
      }

      const response = await fetch(`/api/devices/command?syncId=${encodeURIComponent(syncId)}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sangeet-sync-id": syncId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Device did not respond. Retrying...");
      }

      if (action === "play" && isPlaying) {
        togglePlay();
      }

      toast.success(
        action === "play" ? "Playback Transferred" : `Sent ${action}`,
        `Connected to ${targetDevice.name}`,
      );
      void refresh();
    } catch (error) {
      toast.error("Device error", error instanceof Error ? error.message : "Could not reach device.");
    } finally {
      setBusy(false);
    }
  };

  const copySyncLink = async () => {
    const url = `${window.location.origin}/home?syncId=${encodeURIComponent(guestSyncId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Pair link copied", "Open this link on your phone or PC to connect.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info("Pair code", guestSyncId);
    }
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCodeInput.trim()) return;
    setGuestSyncId(pairCodeInput.trim());
    toast.success("Device paired", `Now syncing with room ${pairCodeInput.trim().slice(0, 8)}...`);
    setShowPairInput(false);
    setPairCodeInput("");
    void refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
        aria-expanded={open}
        aria-label="Connect to a device"
        title="Connect to a device (Spotify Connect)"
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760] ${
          isPlayingRemotely
            ? "text-[#1ed760] bg-[#1ed760]/10 hover:bg-[#1ed760]/20"
            : "text-[#9ba39d] hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <MonitorSmartphone className="h-[18px] w-[18px]" strokeWidth={isPlayingRemotely ? 2.2 : 1.7} />
        {isPlayingRemotely && (
          <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-[#1ed760] shadow-sm animate-pulse" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close devices menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            className="absolute bottom-11 right-0 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/10 bg-[#141815] p-4 shadow-2xl backdrop-blur-2xl text-white"
            aria-label="Connected devices"
          >
            {/* Header */}
            <header className="mb-3.5 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Speaker className="h-4 w-4 text-[#1ed760]" />
                  <span>Connect to a device</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[#9ba39d]">
                  {authenticated ? "Google Account Devices" : "Sangeet Connect (Spotify Style)"}
                </p>
              </div>
              {isPlayingRemotely && (
                <span className="rounded-full bg-[#1ed760]/20 px-2 py-0.5 text-[10px] font-bold text-[#1ed760] animate-pulse">
                  Playing Remotely
                </span>
              )}
            </header>

            {/* Current Device Box */}
            <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1ed760]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">This Device</p>
                    <p className="truncate text-[10px] text-[#9ba39d]">
                      {isPlaying ? (current ? `Playing ${current.title}` : "Playing audio") : "Ready to play"}
                    </p>
                  </div>
                </div>
                {isPlaying && (
                  <span className="font-mono text-[10px] text-[#1ed760] font-bold">Listening here</span>
                )}
              </div>
            </div>

            {/* Remote Devices List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {remoteDevices.map((device) => {
                const Icon =
                  device.type === "phone"
                    ? Smartphone
                    : device.type === "tablet"
                    ? MonitorSmartphone
                    : Laptop2;
                const isThisDeviceActive = device.isPlaying;

                return (
                  <div
                    key={device.deviceId}
                    className={`flex items-center justify-between gap-3 rounded-xl p-2.5 transition border ${
                      isThisDeviceActive
                        ? "border-[#1ed760]/30 bg-[#1ed760]/10"
                        : "border-transparent bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isThisDeviceActive ? "text-[#1ed760]" : "text-[#9ba39d]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-xs font-medium ${
                            isThisDeviceActive ? "text-[#1ed760] font-semibold" : "text-white"
                          }`}
                        >
                          {device.name}
                        </p>
                        <p className="truncate text-[10px] text-[#9ba39d]">
                          {device.isPlaying && device.track
                            ? `Playing: ${device.track.title}`
                            : "Online · Ready"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isThisDeviceActive ? (
                        <button
                          type="button"
                          onClick={() => void sendCommand(device, "pause")}
                          aria-label="Pause remote device"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                        >
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || !sessionTrack}
                          onClick={() => void sendCommand(device, "play")}
                          className="rounded-full bg-[#1ed760] px-3 py-1 text-[10px] font-bold text-black transition hover:bg-[#1db954] disabled:opacity-40"
                        >
                          Play here
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {!remoteDevices.length && (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-center text-xs text-[#9ba39d]">
                  <Speaker className="mx-auto mb-2 h-5 w-5 text-[#636c65]" />
                  <p className="font-medium text-white">No other devices active</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9ba39d]">
                    Open Sangeet on your phone, tablet, or Windows app to control music seamlessly.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Pair Footer */}
            <div className="mt-3.5 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between text-[11px] text-[#9ba39d]">
                <button
                  type="button"
                  onClick={copySyncLink}
                  className="flex items-center gap-1.5 hover:text-white transition text-[#1ed760] font-medium"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Link Copied!" : "Share Connect Link"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPairInput((v) => !v)}
                  className="hover:text-white transition underline"
                >
                  {showPairInput ? "Hide" : "Enter Pair Code"}
                </button>
              </div>

              {showPairInput && (
                <form onSubmit={handlePairSubmit} className="mt-2.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={pairCodeInput}
                    onChange={(e) => setPairCodeInput(e.target.value)}
                    placeholder="Enter 8+ char code..."
                    className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white placeholder:text-[#636c65] focus:outline-none focus:border-[#1ed760]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#1ed760] px-3 py-1 text-xs font-bold text-black hover:bg-[#1db954]"
                  >
                    Pair
                  </button>
                </form>
              )}
            </div>

            {busy && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#9ba39d]">
                <LoaderCircle className="h-3 w-3 animate-spin text-[#1ed760]" />
                <span>Connecting to device...</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
