import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELEASES_API = "https://api.github.com/repos/shasantx/sangeet/releases?per_page=30";
const APK_NAME = "sangeet-android.apk";

/**
 * Redirect to the newest Android APK asset. Do not proxy a multi-megabyte APK
 * through the app server: serverless response limits/timeouts can turn a valid
 * release into a 503 even when GitHub has the APK ready.
 */
export async function GET() {
  try {
    const response = await fetch(RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Sangeet-Android-Installer",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`GitHub releases returned ${response.status}`);

    const releases = (await response.json()) as Array<{
      tag_name?: string;
      draft?: boolean;
      published_at?: string;
      assets?: Array<{ name?: string; size?: number; browser_download_url?: string }>;
    }>;
    const latestAndroidRelease = releases
      .filter((release) => !release.draft && /^android-build-/i.test(release.tag_name ?? ""))
      .sort((a, b) => Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? ""));

    for (const release of latestAndroidRelease) {
      const apk = release.assets?.find(
        (asset) => asset.name === APK_NAME && (asset.size ?? 0) > 0 &&
          typeof asset.browser_download_url === "string",
      );
      if (!apk?.browser_download_url) continue;
      const target = new URL(apk.browser_download_url);
      if (target.protocol !== "https:" || target.hostname !== "github.com") continue;
      return NextResponse.redirect(target, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch {
    // Return a clear error below; do not silently hand out an older bundled APK.
  }

  return NextResponse.json(
    { error: "android_apk_unavailable", message: "The latest Android APK is not available yet." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
