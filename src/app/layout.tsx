import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "glasskit-liquid-glass/styles.css";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { LiquidGlassProvider } from "@/components/shell/liquid-glass-provider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080c" },
    { media: "(prefers-color-scheme: light)", color: "#eef2fa" }
  ]
};

export const metadata: Metadata = {
  title: "Sangeet — Free Open-Source Music Player",
  description:
    "Free, open-source music streaming studio with synced lyrics, SponsorBlock auto-skip, 5-band equalizer, offline audio, and native Android & Rust Windows apps.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/sangeet-icon.svg",
    apple: "/icons/sangeet-icon.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sangeet"
  }
};

const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem("sangeet-v2-ui");var t="dark";if(raw){var p=JSON.parse(raw);if(p&&p.state&&(p.state.theme==="light"||p.state.theme==="dark")){t=p.state.theme;}}var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",t==="light"?"#eef2fa":"#07080c");}}catch(e){}})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} dark`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <LiquidGlassProvider>
          <AppShell>{children}</AppShell>
        </LiquidGlassProvider>
      </body>
    </html>
  );
}
