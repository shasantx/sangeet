/**
 * Helpers for upgrading low-res thumbnails from YouTube Music and YouTube
 * into crystal-clear HD artwork (up to 1200x1200 or maxresdefault),
 * while strictly sanitizing URLs against injection or unsafe schemes.
 */

function sanitizeArtworkUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 1024 || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";

  // Allow safe local relative paths
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("..")) {
    return trimmed;
  }

  // Allow blob: URLs generated locally for imported device audio
  if (trimmed.startsWith("blob:")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export function toHighResArtwork(url?: string | null): string {
  const trimmed = sanitizeArtworkUrl(url);
  if (!trimmed) return "";

  // 1. Google user content (YouTube Music artist photos and album art)
  // e.g. https://yt3.googleusercontent.com/...=w60-h60-p-l90-rj or =s192
  if (
    trimmed.includes(".googleusercontent.com/") ||
    trimmed.includes(".ggpht.com/")
  ) {
    if (trimmed.includes("=")) {
      return trimmed.replace(/=w\d+-h\d+[^"]*/, "=w800-h800-l90-rj").replace(/=s\d+[^"]*/, "=w800-h800-l90-rj");
    }
    return `${trimmed}=w800-h800-l90-rj`;
  }

  // 2. YouTube standard thumbnail CDNs
  // Replace hqdefault / mqdefault / default with maxresdefault
  if (trimmed.includes("ytimg.com/vi/") || trimmed.includes("img.youtube.com/vi/")) {
    return trimmed
      .replace(/\/hqdefault\.jpg(\?.*)?$/i, "/maxresdefault.jpg$1")
      .replace(/\/mqdefault\.jpg(\?.*)?$/i, "/maxresdefault.jpg$1")
      .replace(/\/default\.jpg(\?.*)?$/i, "/maxresdefault.jpg$1");
  }

  return trimmed;
}

export function toMediumResArtwork(url?: string | null): string {
  const trimmed = sanitizeArtworkUrl(url);
  if (!trimmed) return "";

  if (
    trimmed.includes(".googleusercontent.com/") ||
    trimmed.includes(".ggpht.com/")
  ) {
    if (trimmed.includes("=")) {
      return trimmed.replace(/=w\d+-h\d+[^"]*/, "=w360-h360-l90-rj").replace(/=s\d+[^"]*/, "=w360-h360-l90-rj");
    }
    return `${trimmed}=w360-h360-l90-rj`;
  }

  if (trimmed.includes("ytimg.com/vi/") || trimmed.includes("img.youtube.com/vi/")) {
    return trimmed
      .replace(/\/default\.jpg(\?.*)?$/i, "/mqdefault.jpg$1");
  }

  return trimmed;
}
