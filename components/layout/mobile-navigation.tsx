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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0c0e0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors",
                active ? "text-[#1ed760]" : "text-white/50 hover:text-white/80",
              )}
            >
              <Icon
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span className="text-[10px] font-medium leading-none tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
