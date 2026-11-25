"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { keys: "Space", desc: "Play / Pause active track" },
  { keys: "Ctrl + K", desc: "Open Command Palette & instant search" },
  { keys: "/", desc: "Focus top Search bar" },
  { keys: "T", desc: "Toggle Dark / Light Cobalt theme" },
  { keys: "← / →", desc: "Seek backward / forward 5 seconds" },
  { keys: "Shift + → / ←", desc: "Next / Previous track" },
  { keys: "Shift + ↑ / ↓", desc: "Volume up / down 5%" },
  { keys: "M", desc: "Mute / Unmute audio" },
  { keys: "L", desc: "Like / Unlike active track" },
  { keys: "S", desc: "Toggle Shuffle" },
  { keys: "R", desc: "Cycle Repeat (Off / All / One)" },
  { keys: "Q", desc: "Toggle Queue panel" },
  { keys: "F", desc: "Toggle Fullscreen Cinema Mode" },
  { keys: "?", desc: "Open this Keyboard Shortcuts guide" }
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("sangeet:open-shortcuts", onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("sangeet:open-shortcuts", onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-encore-hairline bg-encore-elevated p-6 shadow-[var(--shadow-elevated)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-encore-accent" />
            <h2 className="text-base font-bold text-encore-text">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="flex h-9 w-9 items-center justify-center rounded-full text-encore-subdued hover:bg-encore-elevated-highlight hover:text-encore-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-xs hover:bg-encore-hover"
            >
              <span className="text-encore-subdued">{s.desc}</span>
              <kbd className="shrink-0 rounded-md border border-encore-hairline bg-encore-base px-2.5 py-1 font-mono text-[11px] font-bold text-encore-accent">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
