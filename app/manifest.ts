import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sangeet — Music for every mood",
    short_name: "Sangeet",
    description: "Discover music and build a library that feels like yours.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0c0b",
    theme_color: "#0b0c0b",
    icons: [
      { src: "/brand/sangeet-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/sangeet-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/sangeet-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
