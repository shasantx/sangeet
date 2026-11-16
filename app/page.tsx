"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAndroidNativeApp } from "@/lib/android-bridge";
import { LandingPage } from "@/components/site/landing-page";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (isAndroidNativeApp()) {
      router.replace("/home");
    }
  }, [router]);

  return <LandingPage />;
}
