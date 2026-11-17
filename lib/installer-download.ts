import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export interface InstallerSourceConfig {
  candidatePaths: string[];
  envUrlVar: string;
  assetNameMatchers: RegExp[];
  contentType: string;
  filename: string;
  unavailableError: string;
  unavailableMessage: string;
}

const GITHUB_RELEASES_API = "https://api.github.com/repos/shasantx/sangeet/releases?per_page=15";
const RELEASE_CACHE_TTL_MS = 5 * 60 * 1000;
const releaseAssetCache = new Map<string, { at: number; url: string }>();

async function findLocalFile(candidatePaths: string[]): Promise<{ filePath: string; size: number } | null> {
  for (const filePath of candidatePaths) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile() && stats.size > 0) {
        return { filePath, size: stats.size };
      }
    } catch {
      // Candidate path does not exist; try next location.
    }
  }
  return null;
}

function getSafeEnvUrl(envVarName: string): string | null {
  const raw = process.env[envVarName]?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function resolveGitHubReleaseAssetUrl(
  cacheKey: string,
  matchers: RegExp[],
): Promise<string | null> {
  const cached = releaseAssetCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RELEASE_CACHE_TTL_MS) {
    return cached.url;
  }

  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Sangeet-Web-Downloader",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;

    const releases = (await res.json()) as Array<{
      draft?: boolean;
      assets?: Array<{ name?: string; size?: number; browser_download_url?: string }>;
    }>;

    for (const matcher of matchers) {
      for (const release of releases) {
        if (release.draft) continue;
        for (const asset of release.assets ?? []) {
          if (
            asset.name &&
            matcher.test(asset.name) &&
            (asset.size ?? 0) > 0 &&
            asset.browser_download_url
          ) {
            releaseAssetCache.set(cacheKey, {
              at: Date.now(),
              url: asset.browser_download_url,
            });
            return asset.browser_download_url;
          }
        }
      }
    }
  } catch {
    // Ignore transient GitHub API lookup failures.
  }
  return null;
}

function parseRangeHeader(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | "invalid" {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return "invalid";
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return "invalid";

  let start: number;
  let end: number;

  if (!startStr) {
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid";
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = Number(startStr);
    end = endStr ? Math.min(totalSize - 1, Number(endStr)) : totalSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > end ||
    start >= totalSize
  ) {
    return "invalid";
  }

  return { start, end };
}

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(
          typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk),
        );
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}

async function proxyRemoteBinary(
  url: string,
  req: NextRequest,
  config: InstallerSourceConfig,
  headOnly: boolean,
): Promise<Response | null> {
  try {
    const forwardHeaders: Record<string, string> = {
      "User-Agent": "Sangeet-Web-Downloader",
    };
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      forwardHeaders.Range = rangeHeader;
    }

    const upstream = await fetch(url, {
      method: headOnly ? "HEAD" : "GET",
      headers: forwardHeaders,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(headOnly ? 10_000 : 280_000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return null;
    }

    const headers = new Headers({
      "Content-Type": config.contentType,
      "Content-Disposition": `attachment; filename="${config.filename}"`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=1800",
    });

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return null;
  }
}

export async function serveInstallerDownload(
  req: NextRequest,
  config: InstallerSourceConfig,
  headOnly: boolean,
): Promise<Response> {
  // 1. Prefer locally packaged binary on this server when present.
  const local = await findLocalFile(config.candidatePaths);
  if (local) {
    const { filePath, size } = local;
    const rangeHeader = req.headers.get("range");
    const contentDisposition = `attachment; filename="${config.filename}"`;

    if (rangeHeader) {
      const parsedRange = parseRangeHeader(rangeHeader, size);
      if (parsedRange === "invalid") {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${size}`,
          },
        });
      }

      const { start, end } = parsedRange;
      const chunkLength = end - start + 1;
      const headers = new Headers({
        "Content-Type": config.contentType,
        "Content-Disposition": contentDisposition,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkLength),
        "Cache-Control": "public, max-age=3600",
      });

      if (headOnly) {
        return new NextResponse(null, { status: 206, headers });
      }
      return new NextResponse(nodeStreamToWeb(fs.createReadStream(filePath, { start, end })), {
        status: 206,
        headers,
      });
    }

    const headers = new Headers({
      "Content-Type": config.contentType,
      "Content-Disposition": contentDisposition,
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=3600",
    });

    if (headOnly) {
      return new NextResponse(null, { status: 200, headers });
    }
    return new NextResponse(nodeStreamToWeb(fs.createReadStream(filePath)), {
      status: 200,
      headers,
    });
  }

  // 2. Otherwise stream directly from configured URL or latest build artifact via the website itself (no external redirect).
  const remoteUrl =
    getSafeEnvUrl(config.envUrlVar) ||
    (await resolveGitHubReleaseAssetUrl(config.filename, config.assetNameMatchers));

  if (remoteUrl) {
    const proxied = await proxyRemoteBinary(remoteUrl, req, config, headOnly);
    if (proxied) return proxied;
  }

  if (headOnly) {
    return new NextResponse(null, {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.json(
    {
      error: config.unavailableError,
      message: config.unavailableMessage,
    },
    { status: 503 },
  );
}

export function normalizeInstallerPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}
