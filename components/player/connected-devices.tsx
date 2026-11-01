"use client";

import { useCallback, useMemo, useState } from "react";
import { Laptop2, LoaderCircle, MonitorSmartphone, Smartphone, Speaker, Volume2 } from "lucide-react";
import { getAlbum, getArtist, getTrack } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";

type Device = { deviceId: string; name: string; type: string; isPlaying: boolean; currentTime: number; track: { source: "youtube"; videoId: string; title: string; artist: string; album: string; artwork: string; duration: number } | { source: "audius"; trackId: string; title: string; artist: string; album: string; artwork: string; duration: number } | null };
type RemoteAction = { action: "play" | "pause" | "next" | "previous"; track?: Device["track"]; currentTime?: number };
const DEVICE_KEY = "sangeet-device-id-v1";

function deviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID().replaceAll("-", ""); window.localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

function deviceType() {
  const ua = navigator.userAgent;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/android|iphone|mobile/i.test(ua)) return "phone";
  return "computer";
}

function deviceName(type: string) {
  const platform = navigator.platform || "Browser";
  return `${platform} · ${type === "phone" ? "Phone" : type === "tablet" ? "Tablet" : "Computer"}`.slice(0, 48);
}

export function ConnectedDevices() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const trackId = usePlayerStore((state) => state.currentTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const current = trackId ? getTrack(trackId) : undefined;
  const currentArtist = current ? getArtist(current.artistId) : undefined;
  const currentAlbum = current ? getAlbum(current.albumId) : undefined;
  const sessionTrack = useMemo(() => {
    if (!current) return null;
    if (current.youtubeId) return { source: "youtube" as const, videoId: current.youtubeId, title: current.title, artist: currentArtist?.name ?? "Sangeet artist", album: currentAlbum?.title ?? "", artwork: current.artwork, duration: current.duration };
    if (current.source === "audius") return { source: "audius" as const, trackId: current.id.replace(/^aud-/, ""), title: current.title, artist: currentArtist?.name ?? "Independent artist", album: currentAlbum?.title ?? "", artwork: current.artwork, duration: current.duration };
    return null;
  }, [current, currentArtist?.name, currentAlbum?.title]);

  const refresh = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/devices?deviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (response.ok) setDevices((await response.json() as { devices?: Device[] }).devices ?? []);
    } catch { /* A missed refresh recovers when the menu is reopened. */ }
  }, []);

  const send = async (device: Device, action: RemoteAction["action"]) => {
    setBusy(true); setNotice("");
    try {
      const body: Record<string, unknown> = { deviceId: device.deviceId, action };
      if (action === "play") {
        if (!sessionTrack) { setNotice("This track can’t be transferred between devices."); setBusy(false); return; }
        body.track = sessionTrack;
        body.currentTime = currentTime;
      }
      const response = await fetch("/api/devices/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error === "device_offline" ? "That device is no longer online." : "Couldn’t connect to that device.");
      if (action === "play" && isPlaying) togglePlay();
      setNotice(action === "play" ? `Sent playback to ${device.name}.` : `Sent ${action} to ${device.name}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn’t connect to that device."); }
    finally { setBusy(false); }
  };

  const thisId = typeof window === "undefined" ? "" : window.localStorage.getItem(DEVICE_KEY);
  const remoteDevices = devices.filter((device) => device.deviceId !== thisId);
  return <div className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); if (authenticated) void refresh(deviceId()); }} aria-expanded={open} aria-label="Connect to a device" title="Connect to a device" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <MonitorSmartphone className="h-[17px] w-[17px]" strokeWidth={1.7}/>
    </button>
    {open && <>
      <button aria-label="Close devices menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)}/>
      <section className="absolute bottom-11 right-0 z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/10 bg-[#171917] p-4 shadow-2xl" aria-label="Connected devices">
        <header className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">Connect to a device</p><p className="mt-0.5 text-[11px] text-muted-foreground">Devices signed in to your account</p></div><Volume2 className="h-4 w-4 text-primary"/></header>
        {!authenticated ? <p className="rounded-xl bg-white/[.04] p-3 text-xs text-muted-foreground">Sign in on your other devices to connect them.</p> : <div className="max-h-60 space-y-1 overflow-y-auto">
          {devices.map((device) => { const isThis = device.deviceId === thisId; const Icon = device.type === "phone" ? Smartphone : device.type === "tablet" ? MonitorSmartphone : Laptop2; return <div key={device.deviceId} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-white/[.04]">
            <Icon className={`h-4 w-4 shrink-0 ${isThis ? "text-primary" : "text-muted-foreground"}`}/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{device.name}{isThis ? " · This device" : ""}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{isThis ? device.track?.title ? `Playing ${device.track.title}` : "Ready to play" : device.isPlaying && device.track ? `Playing ${device.track.title}` : "Connected"}</span></span>
            {isThis ? <span className="h-2 w-2 rounded-full bg-primary"/> : <button type="button" disabled={busy || !sessionTrack} onClick={() => void send(device, "play")} className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground disabled:opacity-40">Play here</button>}
          </div>; })}
          {!remoteDevices.length && <div className="rounded-xl bg-white/[.04] px-3 py-4 text-center text-xs text-muted-foreground"><Speaker className="mx-auto mb-2 h-4 w-4 opacity-60"/>Open Sangeet on another device and sign in to see it here.</div>}
        </div>}
        {busy && <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><LoaderCircle className="h-3 w-3 animate-spin"/>Connecting…</div>}
        {notice && <p role="status" className="mt-2 text-[11px] text-muted-foreground">{notice}</p>}
      </section>
    </>}
  </div>;
}
