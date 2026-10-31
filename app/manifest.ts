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
    icons: [{ src: "/sangeet-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
