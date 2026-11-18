import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  href,
  linkLabel = "See all",
  className,
  action,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 sm:mb-5", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-[20px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-2xl lg:text-[26px]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {action}
        {href && (
          <Link
            href={href}
            className="liquid-pill group inline-flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-semibold text-white/80 transition hover:bg-white/[0.14] hover:text-white"
          >
            <span>{linkLabel}</span>
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
