"use client";

import { useEffect, useRef, useState } from "react";
import { HardDrive, LoaderCircle, Music2, Play, Trash2, Upload } from "lucide-react";
import type { Track } from "@/lib/types";
import { importLocalAudio, removeLocalAudio, restoreLocalAudio } from "@/lib/local-audio";
import { removeDynamicLocalTrack } from "@/lib/dynamic-tracks";
import { usePlayerStore } from "@/store/player-store";

export function LocalAudioLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const refresh = async () => setTracks(await restoreLocalAudio());
  useEffect(() => { void refresh().catch(() => setError("This browser does not allow local audio storage.")); }, []);
  const add = async (files: File[]) => {
    setBusy(true); setError("");
    try { const added = await importLocalAudio(files); if (!added.length) setError("Choose audio files under 100 MB each."); await refresh(); }
    catch { setError("Could not save audio on this device. Check the browser storage permission and available space."); }
    finally { setBusy(false); if (picker.current) picker.current.value = ""; }
  };
  const remove = async (track: Track) => { await removeLocalAudio(track.id); removeDynamicLocalTrack(track.id); setTracks((current) => current.filter((item) => item.id !== track.id)); };
  return <section className="rounded-2xl border border-white/[.055] bg-white/[.015] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><HardDrive className="h-4 w-4"/></span><div><p className="text-[13px] font-medium">Audio on this device</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Import music from your phone or computer. Files are saved privately in this browser for offline playback.</p></div></div><input ref={picker} type="file" accept="audio/*" multiple className="sr-only" onChange={(e) => void add(Array.from(e.target.files ?? []))}/><button type="button" onClick={() => picker.current?.click()} disabled={busy} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-primary/25 px-3 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin"/> : <Upload className="h-3.5 w-3.5"/>}Add audio</button></div>
    {error && <p role="alert" className="mt-3 text-xs text-red-200">{error}</p>}
    <div className="mt-4 space-y-2">{tracks.map((track) => <div key={track.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-white/[.025] p-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[.05] text-white/45"><Music2 className="h-4 w-4"/></span><span className="min-w-0 flex-1 truncate text-xs font-medium">{track.title}</span><button type="button" aria-label={`Play ${track.title}`} onClick={() => playTrack(track.id, [track.id], "Audio on this device")} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="h-3.5 w-3.5 fill-current"/></button><button type="button" aria-label={`Remove ${track.title}`} onClick={() => void remove(track)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/35 hover:bg-white/[.06] hover:text-white"><Trash2 className="h-3.5 w-3.5"/></button></div>)}{!tracks.length && !busy && <p className="py-2 text-xs text-white/35">No local tracks imported yet.</p>}</div>
  </section>;
}
