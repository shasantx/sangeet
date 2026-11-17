import { NextRequest } from "next/server";
import { normalizeInstallerPath, serveInstallerDownload } from "@/lib/installer-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WINDOWS_CONFIG = {
  candidatePaths: [
    normalizeInstallerPath("public", "downloads", "Sangeet.exe"),
    normalizeInstallerPath("release", "Sangeet.exe"),
    normalizeInstallerPath("release", "Sangeet 1.0.0.exe"),
  ],
  envUrlVar: "WINDOWS_EXE_DOWNLOAD_URL",
  assetNameMatchers: [/^Sangeet\.exe$/i, /\.exe$/i],
  contentType: "application/vnd.microsoft.portable-executable",
  filename: "Sangeet.exe",
  unavailableError: "windows_installer_unavailable",
  unavailableMessage: "The Windows .exe installer is not available right now. Please try again shortly.",
};

export async function GET(req: NextRequest) {
  return serveInstallerDownload(req, WINDOWS_CONFIG, false);
}

export async function HEAD(req: NextRequest) {
  return serveInstallerDownload(req, WINDOWS_CONFIG, true);
}
