"use client";

import { useRouter } from "next/navigation";
import { NowPlayingView } from "@/components/player/now-playing-view";

export default function NowPlayingPage() {
  const router = useRouter();
  return <NowPlayingView onDismiss={() => router.back()} />;
}
