"use client";

import { useEffect } from "react";
import { useSiteConfigStore, type PublicSiteConfig } from "@/store/site-config-store";

export function SiteConfigSync() {
  const setConfig = useSiteConfigStore((state) => state.setConfig);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/site-config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<PublicSiteConfig> : null)
      .then((config) => { if (config) setConfig(config); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [setConfig]);

  return null;
}
