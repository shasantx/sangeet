import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/outfit";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: {
    default: "Sangeet — Music for every mood",
    template: "%s · Sangeet",
  },
  description:
    "Discover independent music, explore your library, and listen in Sangeet.",
  applicationName: "Sangeet",
  keywords: ["music", "streaming", "discovery"],
  icons: {
    icon: "/sangeet-mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className="dark" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
