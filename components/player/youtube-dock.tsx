"use client";

/** Keeps the YouTube iframe player permanently mounted in the DOM for reliable background playback. */
export function YouTubeDock() {
  return (
    <div
      className="fixed bottom-0 right-0 h-4 w-4 overflow-hidden opacity-0 pointer-events-none -z-50"
      aria-hidden="true"
    >
      <div id="aura-youtube-frame" className="h-full w-full" />
    </div>
  );
}
