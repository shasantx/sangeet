"use client";

import { useEffect } from "react";
import {
  GlassSettingsProvider,
  useGlassSettings
} from "glasskit-liquid-glass";
import { useUIStore } from "@/store/ui-store";
import { getAndroidBridge, getWindowsBridge } from "@/lib/platform";

function ThemeAndGlassSync({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const { updateSetting } = useGlassSettings();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.dataset.theme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "light" ? "#faf4ec" : "#0a0606");
    }

    updateSetting("siteTheme", theme);

    try {
      getAndroidBridge()?.setSystemTheme?.(theme);
      getWindowsBridge()?.setSystemTheme?.(theme);
    } catch {}
  }, [theme, updateSetting]);

  return <>{children}</>;
}

export function LiquidGlassProvider({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <GlassSettingsProvider
      persistTheme={false}
      defaultSettings={{
        renderMode: "css",
        useSvgRefraction: false,
        refraction: 0.42,
        blur: 4.0,
        bezelWidth: 16,
        specular: 0.8,
        aberration: 0.12,
        saturation: 1.75,
        siteTheme: "dark"
      }}
    >
      <ThemeAndGlassSync>{children}</ThemeAndGlassSync>
    </GlassSettingsProvider>
  );
}
