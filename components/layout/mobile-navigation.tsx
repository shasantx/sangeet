"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Library, Search, UserRound, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const items = [
  { href: "/home", label: "Home", icon: Home, match: (path: string) => path === "/home" },
  { href: "/search", label: "Search", icon: Search, match: (path: string) => path.startsWith("/search") },
  { href: "/explore", label: "Explore", icon: Compass, match: (path: string) => path.startsWith("/explore") || path.startsWith("/genre") },
  { href: "/plans", label: "Plans", icon: WalletCards, match: (path: string) => path.startsWith("/plans") },
  {
    href: "/library",
    label: "Library",
    icon: Library,
    match: (path: string) =>
      path.startsWith("/library") ||
      path.startsWith("/liked") ||
      path.startsWith("/recently-played") ||
      path.startsWith("/playlist") ||
      path.startsWith("/album") ||
      path.startsWith("/artist"),
  },
  { href: "/profile", label: "Profile", icon: UserRound, match: (path: string) => path.startsWith("/profile") },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const profile = useAppStore((state) => state.profile);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex min-h-[64px] items-stretch border-t border-white/[.07] bg-[#0e0e13]/97 backdrop-blur-2xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        if (item.href === "/profile") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[9.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span
                className={cn(
                  "flex h-6 w-8 items-center justify-center rounded-full text-[10px] font-semibold transition",
                  active ? "bg-primary text-primary-foreground" : "bg-white/[.08] text-muted-foreground",
                )}
              >
                {profile.initials}
              </span>
              <span className={active ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[9.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active && (
              <span className="absolute top-0 h-[2px] w-7 rounded-full bg-primary" aria-hidden="true" />
            )}
            <Icon
              className={cn("h-[19px] w-[19px] transition-colors", active && "text-primary")}
              strokeWidth={active ? 2.2 : 1.7}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
