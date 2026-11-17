import Link from "next/link";
import { SangeetMark } from "@/components/brand/sangeet-mark";

export function SiteFooter() {
  return <footer className="mx-auto mt-8 flex max-w-[1480px] flex-col gap-5 border-t border-white/[.07] px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
    <div className="flex items-center gap-3"><SangeetMark size={36} /><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Sangeet</p><a href="https://shasant.xyz" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-display text-2xl font-semibold tracking-[-.045em] text-white transition hover:text-primary sm:text-[28px]">Made by Shasant<span className="text-primary">.</span></a></div></div>
    <Link href="https://shasant.xyz" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition hover:text-white">shasant.xyz <span className="sr-only"> (opens in a new tab)</span></Link>
  </footer>;
}
