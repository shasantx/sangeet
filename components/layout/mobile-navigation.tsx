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
    <nav className="mobile-dock-shell md:hidden" aria-label="Mobile navigation">
      <div className="dock dock-md mobile-dock" role="list">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("mobile-dock-item", active && "dock-active")}
            >
              <span className="mobile-dock-pill">
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.8} />
                {active && <span className="dock-label">{item.label}</span>}
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
