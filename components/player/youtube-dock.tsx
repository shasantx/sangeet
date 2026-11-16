"use client";

/** Keeps the YouTube iframe player permanently mounted in the DOM for fallback/video playback. */
export function YouTubeDock() {
  return (
    <div
      className="fixed bottom-0 right-0 h-4 w-4 overflow-hidden opacity-[0.01] pointer-events-none z-0"
      aria-hidden="true"
    >
      <div id="aura-youtube-frame" className="h-full w-full" />
    </div>
  );
}
