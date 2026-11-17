import { NextRequest } from "next/server";
import { normalizeInstallerPath, serveInstallerDownload } from "@/lib/installer-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ANDROID_CONFIG = {
  candidatePaths: [
    normalizeInstallerPath("public", "downloads", "sangeet-android.apk"),
    normalizeInstallerPath("android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    normalizeInstallerPath("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  ],
  envUrlVar: "ANDROID_APK_DOWNLOAD_URL",
  assetNameMatchers: [/^sangeet-android\.apk$/i, /\.apk$/i],
  contentType: "application/vnd.android.package-archive",
  filename: "sangeet-android.apk",
  unavailableError: "android_apk_unavailable",
  unavailableMessage: "The Android APK is not available right now. Please try again shortly.",
};

export async function GET(req: NextRequest) {
  return serveInstallerDownload(req, ANDROID_CONFIG, false);
}

export async function HEAD(req: NextRequest) {
  return serveInstallerDownload(req, ANDROID_CONFIG, true);
}
