import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANDIDATE_EXE_PATHS = [
  path.join(process.cwd(), "public", "downloads", "Sangeet.exe"),
  path.join(process.cwd(), "release", "Sangeet.exe"),
  path.join(process.cwd(), "release", "Sangeet 1.0.0.exe"),
];

const CONTENT_TYPE = "application/vnd.microsoft.portable-executable";
const CONTENT_DISPOSITION = 'attachment; filename="Sangeet.exe"';
const CACHE_CONTROL = "public, max-age=3600";

async function findLocalInstaller(): Promise<{ filePath: string; size: number } | null> {
  for (const filePath of CANDIDATE_EXE_PATHS) {
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

function getSafeEnvDownloadUrl(): string | null {
  const raw = process.env.WINDOWS_EXE_DOWNLOAD_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return null;
    if (
      host === "github.com" ||
      host.endsWith(".github.com") ||
      host === "githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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

async function handleDownload(req: NextRequest, headOnly: boolean): Promise<Response> {
  const local = await findLocalInstaller();

  if (local) {
    const { filePath, size } = local;
    const rangeHeader = req.headers.get("range");

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
        "Content-Type": CONTENT_TYPE,
        "Content-Disposition": CONTENT_DISPOSITION,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkLength),
        "Cache-Control": CACHE_CONTROL,
      });

      if (headOnly) {
        return new NextResponse(null, { status: 206, headers });
      }

      const stream = fs.createReadStream(filePath, { start, end });
      return new NextResponse(nodeStreamToWeb(stream), { status: 206, headers });
    }

    const headers = new Headers({
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": CONTENT_DISPOSITION,
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      "Cache-Control": CACHE_CONTROL,
    });

    if (headOnly) {
      return new NextResponse(null, { status: 200, headers });
    }

    const stream = fs.createReadStream(filePath);
    return new NextResponse(nodeStreamToWeb(stream), { status: 200, headers });
  }

  const externalUrl = getSafeEnvDownloadUrl();
  if (externalUrl) {
    return NextResponse.redirect(externalUrl, 302);
  }

  if (headOnly) {
    return new NextResponse(null, {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.json(
    {
      error: "windows_installer_unavailable",
      message: "The Windows .exe installer is not hosted on this server yet.",
    },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  return handleDownload(req, false);
}

export async function HEAD(req: NextRequest) {
  return handleDownload(req, true);
}
