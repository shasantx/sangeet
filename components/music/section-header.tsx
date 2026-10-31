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
  linkLabel = "View all",
  className,
  action,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-5 lg:mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-[22px] font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-2xl lg:text-[28px]">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action}
        {href && (
          <Link
            href={href}
            className="group hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:flex"
          >
            {linkLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
