import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_EXE_URL =
  "https://github.com/shasantx/sangeet/releases/latest/download/Sangeet.exe";

type GitHubRelease = {
  draft?: boolean;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

export async function GET() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/shasantx/sangeet/releases?per_page=10",
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
      const releases = (await res.json()) as GitHubRelease[];
      for (const release of releases) {
        if (release.draft) continue;
        const exeAsset = release.assets?.find(
          (asset) =>
            typeof asset.name === "string" &&
            asset.name.toLowerCase().endsWith(".exe") &&
            typeof asset.browser_download_url === "string",
        );
        if (exeAsset?.browser_download_url) {
          return NextResponse.redirect(exeAsset.browser_download_url, 302);
        }
      }
    }
  } catch {
    // Fall back to canonical GitHub latest download URL.
  }

  return NextResponse.redirect(FALLBACK_EXE_URL, 302);
}
