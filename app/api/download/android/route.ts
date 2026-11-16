import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_APK_URL =
  "https://github.com/shasantx/sangeet/releases/latest/download/sangeet-android.apk";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/shasantx/sangeet/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Sangeet-App",
        },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (res.ok) {
      const release = (await res.json()) as {
        assets?: Array<{ name?: string; browser_download_url?: string }>;
      };
      const apkAsset = release.assets?.find(
        (asset) =>
          typeof asset.name === "string" &&
          asset.name.endsWith(".apk") &&
          typeof asset.browser_download_url === "string",
      );
      if (apkAsset?.browser_download_url) {
        return NextResponse.redirect(apkAsset.browser_download_url, 302);
      }
    }
  } catch {
    // Fall back to canonical GitHub latest download URL.
  }

  return NextResponse.redirect(FALLBACK_APK_URL, 302);
}
