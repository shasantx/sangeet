"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cast,
  Check,
  Copy,
  Edit2,
  Globe,
  Laptop,
  Laptop2,
  LoaderCircle,
  Monitor,
  MonitorSmartphone,
  Pause,
  Pencil,
  Play,
  QrCode,
  Radio,
  Share2,
  SkipBack,
  SkipForward,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { toast } from "@/store/ui-store";
import {
  getCustomDeviceName,
  getDeviceId,
  getDeviceName,
  getDeviceType,
  getGuestSyncId,
  setCustomDeviceName,
  setGuestSyncId,
} from "./connected-device-sync";

export type Device = {
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

export interface ConnectedDevicesProps {
  variant?: "header" | "bottom-bar" | "icon-only";
  placement?: "top" | "bottom" | "auto";
  className?: string;
}

export function ConnectedDevices({
  variant = "bottom-bar",
  placement = "auto",
  className,
}: ConnectedDevicesProps) {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const trackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const localVolume = usePlayerStore((state) => state.volume);
  const setLocalVolume = usePlayerStore((state) => state.setVolume);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [showPairDrawer, setShowPairDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteVolumeInput, setRemoteVolumeInput] = useState<number | null>(null);

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
  const currentDeviceName = typeof window === "undefined" ? "This Device" : getDeviceName();

  const refresh = useCallback(async () => {
    try {
      const syncId = getGuestSyncId();
      const currentSession = useAuthStore.getState().session;
      const headers: Record<string, string> = { "x-sangeet-sync-id": syncId };
      if (currentSession?.userId) {
        headers["x-sangeet-user-id"] = currentSession.userId;
      }

      const response = await fetch(
        `/api/devices?deviceId=${encodeURIComponent(thisId)}&syncId=${encodeURIComponent(syncId)}`,
        {
          cache: "no-store",
          headers,
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { devices?: Device[] };
        setDevices(data.devices ?? []);
      }
    } catch {
      // Best-effort polling
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
    targetDevice: Device | "all",
    action: "play" | "pause" | "next" | "previous" | "volume" | "seek",
    extra?: { volume?: number; currentTime?: number },
  ) => {
    setBusy(true);
    const syncId = getGuestSyncId();
    const currentSession = useAuthStore.getState().session;
    const targetId = targetDevice === "all" ? "all" : targetDevice.deviceId;

    try {
      // 1. Cross-tab local broadcast
      try {
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const bus = new BroadcastChannel("sangeet_device_bus");
          bus.postMessage({
            targetId,
            action,
            track: action === "play" ? sessionTrack : undefined,
            currentTime: action === "play" ? (extra?.currentTime ?? currentTime) : extra?.currentTime,
            volume: extra?.volume,
          });
          bus.close();
        }
      } catch {
        // Fall back to server
      }

      // 2. Deliver via server API
      const body: Record<string, unknown> = {
        deviceId: targetId,
        action,
      };
      if (action === "play") {
        if (!sessionTrack) {
          toast.info("Transfer song", "Select or play a song to transfer to your device.");
          setBusy(false);
          return;
        }
        body.track = sessionTrack;
        body.currentTime = extra?.currentTime ?? currentTime;
      }
      if (extra?.volume !== undefined) {
        body.volume = extra.volume;
      }
      if (extra?.currentTime !== undefined) {
        body.currentTime = extra.currentTime;
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-sangeet-sync-id": syncId,
      };
      if (currentSession?.userId) {
        headers["x-sangeet-user-id"] = currentSession.userId;
      }

      const response = await fetch(`/api/devices/command?syncId=${encodeURIComponent(syncId)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Device did not respond.");
      }

      if (action === "play" && targetDevice !== "all" && isPlaying) {
        togglePlay();
      }

      const label = targetDevice === "all" ? "All Connected Devices" : targetDevice.name;
      toast.success(
        action === "play" ? "Playback Transferred" : `Sent ${action}`,
        `Command delivered to ${label}`,
      );
      void refresh();
    } catch (error) {
      toast.error("Device unreachable", error instanceof Error ? error.message : "Could not reach device.");
    } finally {
      setBusy(false);
    }
  };

  const handleTransferToThisDevice = () => {
    if (activeRemote?.track) {
      if (activeRemote.isPlaying) {
        void sendCommand(activeRemote, "pause");
      }
      toast.success("Playing on this device", activeRemote.track.title);
    }
  };

  const handleSaveDeviceName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceNameInput.trim()) return;
    setCustomDeviceName(deviceNameInput.trim());
    toast.success("Device renamed", `This device is now "${deviceNameInput.trim()}".`);
    setIsEditingName(false);
    void refresh();
  };

  const copySyncLink = async () => {
    const url = `${window.location.origin}/home?syncId=${encodeURIComponent(guestSyncId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Pair link copied", "Open this link on your phone or PC to connect.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info("Pair Room Code", guestSyncId);
    }
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCodeInput.trim()) return;
    setGuestSyncId(pairCodeInput.trim());
    toast.success("Syncing room", `Joined room ${pairCodeInput.trim().slice(0, 8)}...`);
    setShowPairDrawer(false);
    setPairCodeInput("");
    void refresh();
  };

  const pairUrl = typeof window !== "undefined"
    ? `${window.location.origin}/home?syncId=${encodeURIComponent(guestSyncId)}`
    : "";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    pairUrl,
  )}&bgcolor=14-18-15&color=1e-d7-60&margin=4`;

  const isHeaderVariant = variant === "header";
  const dropDirection = placement === "top" || (placement === "auto" && isHeaderVariant) ? "down" : "up";

  const renderDeviceIcon = (type: string, active: boolean) => {
    const iconClass = cn("h-4 w-4 shrink-0", active ? "text-[#1ed760]" : "text-[#9ba39d]");
    switch (type) {
      case "phone":
        return <Smartphone className={iconClass} />;
      case "tablet":
        return <Tablet className={iconClass} />;
      case "speaker":
        return <Speaker className={iconClass} />;
      case "tv":
        return <Tv className={iconClass} />;
      default:
        return <Laptop2 className={iconClass} />;
    }
  };

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
        aria-expanded={open}
        aria-label="Connect to a device (Spotify Connect)"
        title="Multiple Devices & Connect (Spotify Connect)"
        className={cn(
          "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]",
          isHeaderVariant
            ? cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs font-medium",
                isPlayingRemotely
                  ? "border-[#1ed760]/40 bg-[#1ed760]/10 text-[#1ed760] hover:bg-[#1ed760]/20"
                  : "border-white/[0.08] bg-white/[0.03] text-[#9ba39d] hover:bg-white/[0.07] hover:text-white",
              )
            : cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full",
                isPlayingRemotely
                  ? "text-[#1ed760] bg-[#1ed760]/10 hover:bg-[#1ed760]/20"
                  : "text-[#9ba39d] hover:bg-white/[0.06] hover:text-white",
              ),
          className,
        )}
      >
        <MonitorSmartphone
          className="h-4 w-4 shrink-0"
          strokeWidth={isPlayingRemotely ? 2.2 : 1.8}
        />
        {isHeaderVariant && (
          <span className="hidden sm:inline text-xs font-semibold">
            {isPlayingRemotely && activeRemote ? activeRemote.name : "Devices"}
          </span>
        )}
        {isPlayingRemotely && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#1ed760] shadow-[0_0_8px_#1ed760] animate-pulse" />
        )}
      </button>

      {/* Popover / Control Panel */}
      {open && (
        <>
          {/* Backdrop on mobile, transparent click-outside on desktop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none cursor-default"
            onClick={() => setOpen(false)}
          />

          <section
            className={cn(
              "fixed sm:absolute z-50 overflow-hidden border border-white/[0.12] bg-[#111412]/98 shadow-2xl backdrop-blur-2xl text-white",
              "inset-x-3 top-20 sm:inset-x-auto sm:top-auto sm:w-[380px] max-h-[85vh] overflow-y-auto rounded-3xl p-5",
              dropDirection === "down"
                ? "sm:top-full sm:mt-2 sm:right-0"
                : "sm:bottom-full sm:mb-2 sm:right-0",
            )}
            aria-label="Connect to a device"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1ed760]/15 text-[#1ed760]">
                  <Cast className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold tracking-tight text-white flex items-center gap-2">
                    Connect to a device
                    <span className="rounded-full bg-[#1ed760]/20 px-2 py-0.5 text-[9px] font-bold text-[#1ed760] uppercase">
                      Live
                    </span>
                  </h3>
                  <p className="text-[10px] text-[#9ba39d]">
                    {authenticated
                      ? `Syncing via account: ${session?.displayName ?? "Listener"}`
                      : "Sangeet Multi-Device Connect"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active Remote Streaming Banner (When music is playing elsewhere) */}
            {isPlayingRemotely && activeRemote && (
              <div className="mt-4 rounded-2xl border border-[#1ed760]/30 bg-[#1ed760]/10 p-3.5 text-xs text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#1ed760] font-semibold text-[11px]">
                    <span className="flex h-2 w-2 rounded-full bg-[#1ed760] animate-pulse" />
                    <span>Streaming on {activeRemote.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTransferToThisDevice}
                    className="rounded-full bg-[#1ed760] px-2.5 py-1 text-[10px] font-bold text-black hover:bg-[#1db954] transition"
                  >
                    Play here instead
                  </button>
                </div>

                {activeRemote.track && (
                  <p className="mt-1.5 truncate text-xs font-semibold text-white/90">
                    {activeRemote.track.title} · <span className="font-normal text-[#9ba39d]">{activeRemote.track.artist}</span>
                  </p>
                )}

                {/* Remote Control Bar */}
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="text-[10px] text-[#9ba39d]">Remote controls:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sendCommand(activeRemote, "previous")}
                      className="p-1 text-white/70 hover:text-white transition"
                      aria-label="Previous on remote"
                    >
                      <SkipBack className="h-3.5 w-3.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendCommand(activeRemote, "pause")}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition"
                      aria-label="Pause remote"
                    >
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendCommand(activeRemote, "next")}
                      className="p-1 text-white/70 hover:text-white transition"
                      aria-label="Next on remote"
                    >
                      <SkipForward className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                </div>

                {/* Remote Volume Slider */}
                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-[#9ba39d]">
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#1ed760]" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={remoteVolumeInput ?? activeRemote.volume ?? 0.8}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setRemoteVolumeInput(v);
                      void sendCommand(activeRemote, "volume", { volume: v });
                    }}
                    className="h-1 flex-1 accent-[#1ed760] cursor-pointer"
                    aria-label="Remote device volume"
                  />
                  <span className="font-mono text-[9px] w-7 text-right">
                    {Math.round((remoteVolumeInput ?? activeRemote.volume ?? 0.8) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Current Device Box ("This Device") */}
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-[#1ed760]">
                    <Laptop className="h-4 w-4" />
                    {isPlaying && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1ed760]" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditingName ? (
                      <form onSubmit={handleSaveDeviceName} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={deviceNameInput}
                          onChange={(e) => setDeviceNameInput(e.target.value)}
                          placeholder="Device name..."
                          className="h-7 w-36 rounded-lg border border-white/20 bg-black/50 px-2 text-xs text-white focus:outline-none focus:border-[#1ed760]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ed760] text-black"
                          aria-label="Save name"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white"
                          aria-label="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold text-white">
                          {currentDeviceName} <span className="text-[10px] font-normal text-[#636c65]">(This Device)</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceNameInput(currentDeviceName);
                            setIsEditingName(true);
                          }}
                          className="text-[#636c65] hover:text-[#1ed760] transition p-0.5"
                          title="Rename device"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="truncate text-[10px] text-[#9ba39d]">
                      {isPlaying
                        ? `Playing: ${current?.title ?? "Audio"}`
                        : "Ready to stream"}
                    </p>
                  </div>
                </div>

                {isPlaying && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#1ed760]">
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-full bg-[#1ed760] animate-pulse" />
                      <span className="w-0.5 h-2 bg-[#1ed760] animate-pulse delay-75" />
                      <span className="w-0.5 h-3 bg-[#1ed760] animate-pulse delay-150" />
                    </span>
                    <span>Listening</span>
                  </div>
                )}
              </div>

              {/* Local Volume Slider */}
              <div className="mt-3 flex items-center gap-2 text-xs text-[#9ba39d] border-t border-white/[0.06] pt-2.5">
                <Volume2 className="h-3.5 w-3.5 text-white/50" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={localVolume}
                  onChange={(e) => setLocalVolume(parseFloat(e.target.value))}
                  className="h-1 flex-1 accent-[#1ed760] cursor-pointer"
                  aria-label="This device volume"
                />
                <span className="font-mono text-[10px] tabular-nums text-white/60">
                  {Math.round(localVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Remote Devices List */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#636c65]">
                  Other Devices ({remoteDevices.length})
                </p>
                {remoteDevices.length > 0 && sessionTrack && (
                  <button
                    type="button"
                    onClick={() => void sendCommand("all", "play")}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[#1ed760] hover:underline"
                  >
                    <Radio className="h-3 w-3" /> Broadcast to All
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {remoteDevices.map((device) => {
                  const isDeviceActive = device.isPlaying;

                  return (
                    <div
                      key={device.deviceId}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl p-3 transition border",
                        isDeviceActive
                          ? "border-[#1ed760]/40 bg-[#1ed760]/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                            isDeviceActive
                              ? "bg-[#1ed760]/20 text-[#1ed760]"
                              : "bg-white/[0.06] text-[#9ba39d]",
                          )}
                        >
                          {renderDeviceIcon(device.type, isDeviceActive)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-xs font-bold",
                              isDeviceActive ? "text-[#1ed760]" : "text-white",
                            )}
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
                        {isDeviceActive ? (
                          <button
                            type="button"
                            onClick={() => void sendCommand(device, "pause")}
                            aria-label="Pause"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                          >
                            <Pause className="h-3.5 w-3.5 fill-current" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || !sessionTrack}
                            onClick={() => void sendCommand(device, "play")}
                            className="rounded-full bg-[#1ed760] px-3.5 py-1.5 text-[10px] font-bold text-black transition hover:bg-[#1db954] hover:scale-105 active:scale-95 disabled:opacity-40"
                          >
                            Play here
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!remoteDevices.length && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center text-xs text-[#9ba39d]">
                    <MonitorSmartphone className="mx-auto mb-2 h-6 w-6 text-[#636c65]" />
                    <p className="font-bold text-white">No other devices connected</p>
                    <p className="mt-1 text-[11px] text-[#9ba39d]">
                      Open Sangeet on your phone, tablet, or Windows desktop to control playback across rooms.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Pair Drawer (QR Code + Link + Code) */}
            <div className="mt-4 border-t border-white/[0.08] pt-3.5">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={copySyncLink}
                  className="flex items-center gap-1.5 text-[#1ed760] font-semibold hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Link Copied!" : "Copy Connect Link"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPairDrawer((v) => !v)}
                  className="flex items-center gap-1 text-[#9ba39d] hover:text-white transition"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{showPairDrawer ? "Close QR" : "Scan QR"}</span>
                </button>
              </div>

              {/* QR Code & Manual Pair View */}
              {showPairDrawer && (
                <div className="mt-3.5 rounded-2xl border border-white/10 bg-black/50 p-4 text-center transition animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-white">Scan with phone to pair instantly</p>
                  <p className="mt-0.5 text-[10px] text-[#9ba39d]">
                    Point your camera at this code to open and sync Sangeet
                  </p>

                  <div className="mx-auto my-3 flex h-44 w-44 items-center justify-center rounded-2xl border border-white/15 bg-[#141815] p-2 shadow-xl">
                    <img
                      src={qrCodeUrl}
                      alt="Pairing QR Code"
                      className="h-full w-full rounded-xl object-contain"
                    />
                  </div>

                  <div className="mt-2 text-center">
                    <span className="font-mono text-[10px] text-[#636c65]">Room Pair Code:</span>
                    <p className="font-mono text-xs font-bold tracking-wider text-[#1ed760]">{guestSyncId}</p>
                  </div>

                  <form onSubmit={handlePairSubmit} className="mt-3 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={pairCodeInput}
                      onChange={(e) => setPairCodeInput(e.target.value)}
                      placeholder="Enter room code to join..."
                      className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-[#636c65] focus:outline-none focus:border-[#1ed760]"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#1ed760] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#1db954]"
                    >
                      Join
                    </button>
                  </form>
                </div>
              )}
            </div>

            {busy && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#1ed760]">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>Synchronizing devices...</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
