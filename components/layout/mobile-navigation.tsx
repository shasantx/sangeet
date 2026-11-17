"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Home, Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/home",
    label: "Home",
    icon: Home,
    match: (path: string) => path === "/home" || path.startsWith("/home/"),
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    match: (path: string) => path.startsWith("/search"),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: Compass,
    match: (path: string) =>
      ["/explore", "/genre", "/artist", "/album", "/new-releases", "/made-for-you"].some(
        (route) => path.startsWith(route),
      ),
  },
  {
    href: "/library",
    label: "Library",
    icon: Library,
    match: (path: string) =>
      ["/library", "/liked", "/recently-played", "/playlist", "/profile", "/settings"].some(
        (route) => path.startsWith(route),
      ),
  },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.match(pathname)),
  );

  const beginSwipe = (x: number, y: number) => {
    startRef.current = { x, y };
    swipedRef.current = false;
  };

  const moveSwipe = (x: number, y: number) => {
    const start = startRef.current;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      setDragOffset(Math.max(-28, Math.min(28, dx * 0.35)));
    }
  };

  const endSwipe = (x: number, y: number) => {
    const start = startRef.current;
    startRef.current = null;
    setDragOffset(0);
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 34 || Math.abs(dx) < Math.abs(dy)) return;
    swipedRef.current = true;
    const nextIdx =
      dx < 0
        ? Math.min(items.length - 1, activeIndex + 1)
        : Math.max(0, activeIndex - 1);
    if (nextIdx !== activeIndex) {
      router.push(items[nextIdx].href);
    }
  };

  return (
    <nav className="mobile-dock-shell md:hidden" aria-label="Mobile navigation">
      <div
        className="dock mobile-dock min-h-[60px] transition-transform duration-150 ease-out"
        style={
          dragOffset !== 0
            ? { transform: `translateX(${dragOffset}px)`, transitionDuration: "0ms" }
            : undefined
        }
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) beginSwipe(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) moveSwipe(t.clientX, t.clientY);
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          if (t) endSwipe(t.clientX, t.clientY);
        }}
        onTouchCancel={() => {
          startRef.current = null;
          setDragOffset(0);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") beginSwipe(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && e.buttons === 1) moveSwipe(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") endSwipe(e.clientX, e.clientY);
        }}
        onClickCapture={(e) => {
          if (swipedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            swipedRef.current = false;
          }
        }}
      >
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mobile-dock-item double-tap-none active:scale-95 transition-transform",
                active && "dock-active",
              )}
            >
              <span className="mobile-dock-pill min-h-[46px]">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "dock-label text-[11px]",
                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
