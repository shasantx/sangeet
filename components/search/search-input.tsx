"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onSubmit?: () => void;
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search artists, albums, tracks, playlists…",
  autoFocus = false,
  className,
  onSubmit,
  ariaLabel = "Search Sangeet",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className={cn(
        "group flex h-12 w-full items-center gap-3 rounded-full border border-white/[.075] bg-white/[.04] px-4 transition focus-within:border-primary/50 focus-within:bg-white/[.055] focus-within:ring-2 focus-within:ring-primary/15 sm:h-14 sm:px-5",
        className,
      )}
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition group-focus-within:text-primary" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        className="h-full min-w-0 flex-1 appearance-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/65 sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
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
  );
}
