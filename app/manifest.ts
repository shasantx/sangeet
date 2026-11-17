import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sangeet — Music Player",
    short_name: "Sangeet",
    description: "Ad-free music player with background playback, synced lyrics, and offline library.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#080908",
    theme_color: "#080908",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/brand/sangeet-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/sangeet-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/sangeet-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
