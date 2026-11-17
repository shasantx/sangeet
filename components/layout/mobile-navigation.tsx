"use client";

import { useEffect, useRef, useState } from "react";
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
  const dockRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; tabWidth: number } | null>(null);
  const swipedRef = useRef(false);
  const [dragTabs, setDragTabs] = useState<number | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.match(pathname)),
  );

  useEffect(() => {
    setPendingIndex(null);
  }, [pathname]);

  useEffect(() => {
    if (pendingIndex === null) return;
    const timer = window.setTimeout(() => setPendingIndex(null), 450);
    return () => window.clearTimeout(timer);
  }, [pendingIndex]);

  const beginSwipe = (x: number, y: number) => {
    const rect = dockRef.current?.getBoundingClientRect();
    const tabWidth = rect && rect.width > 8 ? (rect.width - 8) / items.length : 88;
    startRef.current = { x, y, tabWidth };
    swipedRef.current = false;
  };

  const clampDragTabs = (dx: number, tabWidth: number) =>
    Math.max(
      -activeIndex,
      Math.min(items.length - 1 - activeIndex, dx / tabWidth),
    );

  const moveSwipe = (x: number, y: number) => {
    const start = startRef.current;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;

    if (!swipedRef.current) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        startRef.current = null;
        return;
      }
      if (Math.abs(dx) <= 8 || Math.abs(dx) <= Math.abs(dy)) return;
      swipedRef.current = true;
    }

    setDragTabs(clampDragTabs(dx, start.tabWidth));
  };

  const endSwipe = (x: number, y: number) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) {
      setDragTabs(null);
      return;
    }

    const dx = x - start.x;
    const dy = y - start.y;
    const finalDragTabs = swipedRef.current ? clampDragTabs(dx, start.tabWidth) : 0;
    setDragTabs(null);

    const isHorizontalSwipe = Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy);
    if (Math.abs(finalDragTabs) < 0.35 && !isHorizontalSwipe) {
      return;
    }

    let targetIndex = Math.max(
      0,
      Math.min(items.length - 1, Math.round(activeIndex + finalDragTabs)),
    );
    if (targetIndex === activeIndex && dx !== 0) {
      targetIndex =
        dx > 0
          ? Math.min(items.length - 1, activeIndex + 1)
          : Math.max(0, activeIndex - 1);
    }

    if (targetIndex !== activeIndex) {
      swipedRef.current = true;
      setPendingIndex(targetIndex);
      router.push(items[targetIndex].href);
    }
    if (swipedRef.current) {
      window.setTimeout(() => {
        swipedRef.current = false;
      }, 150);
    }
  };

  const cancelSwipe = () => {
    startRef.current = null;
    setDragTabs(null);
  };

  const isDragging = dragTabs !== null;
  const indicatorPosition = isDragging
    ? activeIndex + dragTabs
    : (pendingIndex ?? activeIndex);
  const highlightedIndex = Math.max(
    0,
    Math.min(items.length - 1, Math.round(indicatorPosition)),
  );

  return (
    <nav className="mobile-dock-shell md:hidden" aria-label="Mobile navigation">
      <div
        ref={dockRef}
        className="dock mobile-dock"
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
        onTouchCancel={cancelSwipe}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button === 0) beginSwipe(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && e.buttons === 1) moveSwipe(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") endSwipe(e.clientX, e.clientY);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && startRef.current) endSwipe(e.clientX, e.clientY);
        }}
        onPointerCancel={cancelSwipe}
        onClickCapture={(e) => {
          if (swipedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            swipedRef.current = false;
          }
        }}
      >
        <span
          aria-hidden="true"
          className="mobile-dock-indicator"
          style={{
            transform: `translateX(${indicatorPosition * 100}%)`,
            transitionDuration: isDragging ? "0ms" : "260ms",
          }}
        />
        {items.map((item, idx) => {
          const isRouteActive = idx === activeIndex;
          const isHighlighted = idx === highlightedIndex;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              aria-current={isRouteActive ? "page" : undefined}
              className={cn(
                "mobile-dock-item double-tap-none active:scale-95 transition-transform",
                isHighlighted && "dock-active",
              )}
            >
              <span className="mobile-dock-pill">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-colors duration-150",
                    isHighlighted ? "text-primary" : "text-muted-foreground",
                  )}
                  strokeWidth={isHighlighted ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "dock-label text-[11px] transition-colors duration-150",
                    isHighlighted ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
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
