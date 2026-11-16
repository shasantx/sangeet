"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Library, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", icon: Home, match: (path: string) => path === "/home" },
  { href: "/search", label: "Search", icon: Search, match: (path: string) => path.startsWith("/search") },
  { href: "/explore", label: "Explore", icon: Compass, match: (path: string) => path.startsWith("/explore") || path.startsWith("/genre") || path.startsWith("/artist") || path.startsWith("/album") },
  { href: "/library", label: "Library", icon: Library, match: (path: string) => ["/library", "/liked", "/recently-played", "/playlist"].some((route) => path.startsWith(route)) },
  { href: "/profile", label: "Profile", icon: UserRound, match: (path: string) => path.startsWith("/profile") || path.startsWith("/settings") },
];

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#09090d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex h-14 items-center justify-around px-1.5 sm:px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "double-tap-none flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-all active:scale-95",
                active ? "text-[#1ed760]" : "text-white/65 hover:text-white",
              )}
            >
              <Icon
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                strokeWidth={active ? 2.4 : 1.75}
              />
              <span
                className={cn(
                  "max-w-full truncate text-[10px] leading-none tracking-tight",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
