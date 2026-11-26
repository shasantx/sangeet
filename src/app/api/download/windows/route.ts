import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELEASES_API =
  "https://api.github.com/repos/shasantx/sangeet/releases?per_page=30";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GitHubAsset {
  name?: string;
  size?: number;
  browser_download_url?: string;
}

interface GitHubRelease {
  tag_name?: string;
  draft?: boolean;
  published_at?: string;
  assets?: GitHubAsset[];
}

interface ResolvedWindows {
  tag: string;
  filename: string;
  sizeBytes: number;
  publishedAt: string | null;
  url: string;
}

let cachedWin: { data: ResolvedWindows; expiresAt: number } | null = null;

function isAllowedGitHubAssetUrl(rawUrl: string): URL | null {
  try {
    const target = new URL(rawUrl);
    if (target.protocol !== "https:") return null;
    const host = target.hostname.toLowerCase();
    if (
      host === "github.com" &&
      target.pathname.startsWith("/shasantx/sangeet/releases/download/")
    ) {
      return target;
    }
    if (
      host === "objects.githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    ) {
      return target;
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeReleaseTag(tag?: string): string {
  const cleaned = (tag ?? "latest").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  return cleaned || "latest";
}

async function resolveLatestWindowsInstaller(): Promise<ResolvedWindows | null> {
  if (cachedWin && Date.now() < cachedWin.expiresAt) {
    return cachedWin.data;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Sangeet-Desktop-Installer"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(RELEASES_API, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new Error("GitHub releases lookup failed");
  }

  const releases = (await response.json()) as GitHubRelease[];
  if (!Array.isArray(releases)) {
    throw new Error("Unexpected GitHub releases response");
  }

  const candidates = releases
    .filter((r) => !r.draft && /^desktop-build-/i.test(r.tag_name ?? ""))
    .sort(
      (a, b) =>
        Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? "")
    );

  for (const release of candidates) {
    const exe = release.assets?.find(
      (asset) =>
        /\.exe$/i.test(asset.name ?? "") &&
        (asset.size ?? 0) > 0 &&
        typeof asset.browser_download_url === "string"
    );
    if (!exe?.browser_download_url) continue;
    const target = isAllowedGitHubAssetUrl(exe.browser_download_url);
    if (!target) continue;

    const resolved: ResolvedWindows = {
      tag: sanitizeReleaseTag(release.tag_name),
      filename: exe.name ?? "Dhun.exe",
      sizeBytes: exe.size ?? 0,
      publishedAt: release.published_at ?? null,
      url: target.toString()
    };
    cachedWin = { data: resolved, expiresAt: Date.now() + CACHE_TTL_MS };
    return resolved;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "download:windows",
    limit: 30,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const wantsMeta = request.nextUrl.searchParams.get("meta") === "1";

  let resolved: ResolvedWindows | null = null;
  try {
    resolved = await resolveLatestWindowsInstaller();
  } catch {
    // Serve last verified release on transient GitHub API rate-limit errors
    resolved = cachedWin?.data ?? null;
  }

  if (resolved) {
    if (wantsMeta) {
      return NextResponse.json(
        {
          available: true,
          tag: resolved.tag,
          filename: resolved.filename,
          sizeBytes: resolved.sizeBytes,
          publishedAt: resolved.publishedAt,
          downloadUrl: "/api/download/windows"
        },
        { headers: { "Cache-Control": "public, max-age=120" } }
      );
    }

    return NextResponse.redirect(resolved.url, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
        "X-Sangeet-Release-Tag": resolved.tag
      }
    });
  }

  return NextResponse.json(
    {
      available: false,
      error: "windows_installer_unavailable",
      message:
        "The latest Windows installer could not be verified right now. Please try again shortly."
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
