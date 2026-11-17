"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, ArrowUpRight, Clock3, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Artwork } from "@/components/music/artwork";

export interface LiveSearchSuggestion {
  query: string;
  type: "youtube" | "artist" | "album" | "track" | "recent";
  subtitle?: string;
  artwork?: string;
  href?: string;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onSubmit?: () => void;
  ariaLabel?: string;
  suggestions?: LiveSearchSuggestion[];
  onSelectSuggestion?: (suggestion: LiveSearchSuggestion) => void;
  onFillSuggestion?: (query: string) => void;
  recentSearches?: string[];
  onRemoveRecentSearch?: (query: string) => void;
  isLoadingSuggestions?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search artists, albums, tracks, playlists…",
  autoFocus = false,
  className,
  onSubmit,
  ariaLabel = "Search Sangeet",
  suggestions,
  onSelectSuggestion,
  onFillSuggestion,
  recentSearches,
  onRemoveRecentSearch,
  isLoadingSuggestions = false,
}: SearchInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const hasDropdownFeature =
    suggestions !== undefined ||
    onSelectSuggestion !== undefined ||
    onFillSuggestion !== undefined ||
    recentSearches !== undefined;

  const trimmed = value.trim();

  const items: LiveSearchSuggestion[] = useMemo(() => {
    if (!hasDropdownFeature) return [];
    if (!trimmed) {
      return (recentSearches ?? []).slice(0, 8).map((item) => ({
        query: item,
        type: "recent" as const,
        subtitle: "Recent search",
      }));
    }
    return (suggestions ?? []).slice(0, 10);
  }, [hasDropdownFeature, trimmed, recentSearches, suggestions]);

  const showDropdown =
    hasDropdownFeature &&
    open &&
    (items.length > 0 || (trimmed.length > 0 && isLoadingSuggestions));

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed, items.length]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const selectItem = (item: LiveSearchSuggestion) => {
    setOpen(false);
    setActiveIndex(-1);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    } else {
      onChange(item.query);
      onSubmit?.();
    }
  };

  const fillItem = (queryText: string) => {
    if (onFillSuggestion) {
      onFillSuggestion(queryText);
    } else {
      onChange(queryText);
    }
    setOpen(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasDropdownFeature) return;

    if (event.key === "ArrowDown") {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      selectItem(items[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(false);
          onSubmit?.();
        }}
        className={cn(
          "group flex h-12 w-full items-center gap-3 rounded-full border border-white/[.075] bg-white/[.04] px-4 transition focus-within:border-primary/50 focus-within:bg-white/[.055] focus-within:ring-2 focus-within:ring-primary/15 sm:h-14 sm:px-5",
          showDropdown && "border-white/[.14] bg-white/[.06]",
        )}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition group-focus-within:text-primary" />
        <input
          ref={inputRef}
          type="search"
          role={hasDropdownFeature ? "combobox" : undefined}
          aria-expanded={hasDropdownFeature ? showDropdown : undefined}
          aria-autocomplete={hasDropdownFeature ? "list" : undefined}
          aria-controls={hasDropdownFeature ? "sangeet-search-suggestions" : undefined}
          aria-activedescendant={
            showDropdown && activeIndex >= 0 ? `sangeet-suggestion-${activeIndex}` : undefined
          }
          value={value}
          onFocus={() => {
            if (hasDropdownFeature) setOpen(true);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            if (hasDropdownFeature) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 appearance-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/65 sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
        />
        {isLoadingSuggestions && trimmed ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground/70" />
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              if (hasDropdownFeature) setOpen(true);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[.07] text-muted-foreground transition hover:bg-white/[.12] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-white/[.08] bg-white/[.025] px-2 py-1 font-sans text-[9px] text-muted-foreground/55 sm:block">
            Enter
          </kbd>
        )}
      </form>

      {showDropdown && (
        <div
          id="sangeet-search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/[.1] bg-[#121216]/90 p-1.5 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
        >
          {items.length > 0 ? (
            <ul className="max-h-[380px] overflow-y-auto py-0.5">
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={`${item.type}-${item.query}-${index}`}
                    id={`sangeet-suggestion-${index}`}
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      "group flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors",
                      isActive ? "bg-white/[.1]" : "hover:bg-white/[.065]",
                    )}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectItem(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left focus-visible:outline-none"
                    >
                      {item.artwork ? (
                        <Artwork
                          src={item.artwork}
                          alt=""
                          res="sm"
                          className={cn(
                            "h-8 w-8 shrink-0 shadow-sm",
                            item.type === "artist" ? "rounded-full" : "rounded-md",
                          )}
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[.05] text-muted-foreground">
                          {item.type === "recent" ? (
                            <Clock3 className="h-3.5 w-3.5" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.query}
                        </p>
                        {item.subtitle && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </button>

                    {item.href && (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-label={`Open ${item.query}`}
                        className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/[.08] bg-white/[.03] px-2.5 text-[10.5px] font-medium text-muted-foreground transition hover:border-white/[.16] hover:bg-white/[.08] hover:text-foreground"
                      >
                        Open
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}

                    {item.type === "recent" && onRemoveRecentSearch && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveRecentSearch(item.query);
                        }}
                        aria-label={`Remove ${item.query} from recent searches`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition hover:bg-white/[.08] hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {(onFillSuggestion || item.type !== "recent") && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          fillItem(item.query);
                        }}
                        aria-label={`Fill search with ${item.query}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-white/[.08] hover:text-foreground"
                      >
                        <ArrowUpLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-2.5 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Searching suggestions…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
