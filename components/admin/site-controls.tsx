"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Megaphone, Music2, Save, Search, UserPlus } from "lucide-react";
import type { SiteSettings } from "@/lib/admin-settings";
import { useSiteConfigStore } from "@/store/site-config-store";

interface Options {
  albums: { id: string; title: string; artistId: string }[];
  playlists: { id: string; title: string; curator: string }[];
}

type EditableSettings = Omit<SiteSettings, "updated_at">;

function SwitchRow({ icon: Icon, title, description, value, onChange }: {
  icon: typeof UserPlus;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4">
    <div className="flex min-w-0 items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div></div>
    <button type="button" role="switch" aria-checked={value} aria-label={title} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? "bg-primary" : "bg-white/20"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-[22px]" : "left-0.5"}`} /></button>
  </div>;
}

export function SiteControls() {
  const setPublicConfig = useSiteConfigStore((state) => state.setConfig);
  const [settings, setSettings] = useState<EditableSettings | null>(null);
  const [options, setOptions] = useState<Options>({ albums: [], playlists: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { settings?: SiteSettings; options?: Options; error?: string };
        if (!response.ok || !payload.settings || !payload.options) throw new Error(payload.error || "Could not load site controls.");
        const { updated_at: _updatedAt, ...editable } = payload.settings;
        setSettings(editable);
        setOptions(payload.options);
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Could not load site controls.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const selectedPlaylists = useMemo(() => new Set(settings?.featured_playlist_ids ?? []), [settings?.featured_playlist_ids]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json() as { settings?: SiteSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error || "Could not save site controls.");
      const { updated_at: _updatedAt, ...editable } = payload.settings;
      setSettings(editable);
      setPublicConfig(editable);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save site controls.");
    } finally {
      setSaving(false);
    }
  };

  const update = (changes: Partial<EditableSettings>) => setSettings((current) => current ? { ...current, ...changes } : current);
  const togglePlaylist = (id: string) => {
    if (!settings) return;
    const next = new Set(settings.featured_playlist_ids);
    if (next.has(id)) next.delete(id);
    else if (next.size < 6) next.add(id);
    update({ featured_playlist_ids: Array.from(next) });
  };

  if (loading) return <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[.07] bg-white/[.02] p-12 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading site controls</div>;
  if (!settings) return <div role="alert" className="rounded-2xl border border-amber-300/20 bg-amber-200/[.04] p-5 text-sm text-amber-100">{error || "Site controls are unavailable."}<p className="mt-2 text-xs text-white/55">Apply <code>supabase/migrations/20261031120000_site_controls.sql</code> in the Supabase project connected to this deployment, then redeploy.</p></div>;

  return <div className="space-y-5">
    {error && <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-sm text-red-100">{error}</div>}
    {saved && <div role="status" className="rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-sm text-primary">Site settings saved and published.</div>}

    <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></span><div><h2 className="font-semibold">Announcement</h2><p className="mt-1 text-xs text-muted-foreground">Show a short message across the signed-in app.</p></div></div>
      <textarea value={settings.announcement_text} maxLength={240} onChange={(event) => update({ announcement_text: event.target.value })} placeholder="For example: New releases are here." className="mt-4 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none transition placeholder:text-white/30 focus:border-primary/50" />
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{settings.announcement_text.length}/240 characters</span><label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={settings.announcement_enabled} onChange={(event) => update({ announcement_enabled: event.target.checked })} className="accent-primary" />Publish announcement</label></div>
    </section>

    <section className="grid gap-3 md:grid-cols-2">
      <SwitchRow icon={UserPlus} title="New account registration" description="When off, existing accounts can sign in, but unregistered accounts cannot be created." value={settings.signup_enabled} onChange={(signup_enabled) => update({ signup_enabled })} />
      <SwitchRow icon={Search} title="Live music search" description="Controls requests to the external song search service. Catalog search remains available." value={settings.live_search_enabled} onChange={(live_search_enabled) => update({ live_search_enabled })} />
    </section>

    <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Music2 className="h-4 w-4" /></span><div><h2 className="font-semibold">Homepage curation</h2><p className="mt-1 text-xs text-muted-foreground">Choose the home hero and up to six curated playlists.</p></div></div>
      <label className="mt-5 block text-xs font-medium text-white/70">Featured album</label>
      <select value={settings.featured_album_id ?? ""} onChange={(event) => update({ featured_album_id: event.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#17171d] px-3 text-sm outline-none focus:border-primary/50">
        <option value="">Use the default album</option>
        {options.albums.map((album) => <option key={album.id} value={album.id}>{album.title} · {album.artistId}</option>)}
      </select>
      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs font-medium text-white/70">Featured playlists</p><span className="text-[11px] text-muted-foreground">{selectedPlaylists.size}/6 selected</span></div>
      <div className="mt-2 flex flex-wrap gap-2">{options.playlists.map((playlist) => {
        const selected = selectedPlaylists.has(playlist.id);
        const disabled = !selected && selectedPlaylists.size >= 6;
        return <button key={playlist.id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => togglePlaylist(playlist.id)} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-white/65 hover:bg-white/[.05]"}`}>
          {selected && <Check className="h-3.5 w-3.5" />}{playlist.title}
        </button>;
      })}</div>
    </section>

    <div className="flex flex-col-reverse gap-3 border-t border-white/[.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-muted-foreground">Changes are recorded in the admin activity log.</p>
      <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Publishing…" : "Save site controls"}</button>
    </div>
  </div>;
}
