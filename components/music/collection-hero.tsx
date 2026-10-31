import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Artwork } from "./artwork";

interface CollectionHeroProps {
  eyebrow: string;
  title: string;
  description?: string | null;
  image: string;
  alt: string;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: string;
  round?: boolean;
  badge?: ReactNode;
  className?: string;
}

export function CollectionHero({
  eyebrow,
  title,
  description,
  image,
  alt,
  meta,
  actions,
  accent = "#8B5CF6",
  round = false,
  badge,
  className,
}: CollectionHeroProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-white/[.06] bg-surface",
        className,
      )}
    >
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <Artwork
          src={image}
          alt=""
          className="h-full w-full scale-110 rounded-none opacity-25 blur-3xl"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, hsl(var(--background) / .92) 0%, hsl(var(--background) / .7) 42%, ${accent}22 100%)`,
          }}
        />
        <div
          className="absolute -right-20 -top-24 h-[420px] w-[420px] rounded-full opacity-20 blur-[110px]"
          style={{ background: accent }}
        />
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end lg:gap-9 lg:p-10 xl:p-12">
        <div className="relative w-[min(62vw,220px)] shrink-0 sm:w-[210px] lg:w-[238px]">
          <Artwork
            src={image}
            alt={alt}
            className={cn(
              "aspect-square w-full shadow-[0_30px_70px_-24px_rgba(0,0,0,.92)]",
              round ? "rounded-full" : "rounded-xl",
            )}
            priority
          />
          {badge && <div className="absolute -bottom-3 left-3 sm:-left-3">{badge}</div>}
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <p className="eyebrow mb-3 text-foreground/55">{eyebrow}</p>
          <h1
            className={cn(
              "max-w-[920px] font-display font-medium leading-[.98] tracking-[-0.055em] text-foreground",
              title.length > 40
                ? "text-[32px] sm:text-[42px] lg:text-[52px]"
                : "text-[38px] sm:text-[50px] lg:text-[64px]",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-[650px] text-[13px] leading-[1.75] text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
          {meta && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">{meta}</div>}
          {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
