"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useJamStore } from "@/store/jam-store";

/** Small "Jam · 3" pill shown in the top bar while a Jam is active. */
export function JamIndicator() {
  const status = useJamStore((s) => s.status);
  const count = useJamStore((s) => s.members.length);
  if (status !== "live" && status !== "connecting") return null;
  return (
    <Link
      href="/jam"
      aria-label={`Jam, ${count} listening`}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-encore-tinted px-3 text-xs font-semibold text-encore-accent transition-colors hover:bg-encore-tinted-highlight"
    >
      <Users className="h-4 w-4" strokeWidth={1.8} />
      <span>Jam{status === "live" ? ` · ${count}` : "…"}</span>
    </Link>
  );
}
