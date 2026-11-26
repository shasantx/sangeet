import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "glasskit-liquid-glass/styles.css";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { LiquidGlassProvider } from "@/components/shell/liquid-glass-provider";

const interTight = Inter_Tight({
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
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0b" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4f1" }
  ]
};

export const metadata: Metadata = {
  title: "Dhun — Free Open-Source Music Player",
  description:
    "Free, open-source music streaming studio with synced lyrics, SponsorBlock auto-skip, 5-band equalizer, offline audio, and native Android & Rust Windows apps.",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/sangeet-logo.png",
    apple: "/brand/sangeet-icon-512.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dhun"
  }
};

const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem("sangeet-v2-ui");var t="dark";if(raw){var p=JSON.parse(raw);if(p&&p.state&&(p.state.theme==="light"||p.state.theme==="dark")){t=p.state.theme;}}var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",t==="light"?"#f6f4f1":"#0d0c0b");}}catch(e){}})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} dark`}
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
