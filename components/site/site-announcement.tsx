"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useSiteConfigStore } from "@/store/site-config-store";

export function SiteAnnouncement() {
  const config = useSiteConfigStore((state) => state.config);
  const [dismissedText, setDismissedText] = useState("");
  if (!config.announcement_enabled || !config.announcement_text || dismissedText === config.announcement_text) return null;

  return <aside role="status" className="flex items-center justify-between gap-4 border-b border-primary/15 bg-primary/[.07] px-4 py-2.5 text-sm text-white/85 sm:px-6">
    <p className="mx-auto max-w-5xl text-center">{config.announcement_text}</p>
    <button type="button" onClick={() => setDismissedText(config.announcement_text)} className="rounded-full p-1 text-white/55 transition hover:bg-white/10 hover:text-white" aria-label="Dismiss announcement"><X className="h-4 w-4" /></button>
  </aside>;
}
