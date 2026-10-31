import { cn } from "@/lib/utils";

export function Equalizer({
  playing = true,
  className,
  barClassName,
}: {
  playing?: boolean;
  className?: string;
  barClassName?: string;
}) {
  return (
    <span
      className={cn("flex h-3.5 w-3.5 items-end justify-between gap-[2px]", className)}
      aria-hidden="true"
    >
      <span
        className={cn(
          "w-[2px] rounded-full bg-primary",
          playing ? "animate-equalizer-1" : "h-[30%]",
          barClassName,
        )}
      />
      <span
        className={cn(
          "w-[2px] rounded-full bg-primary",
          playing ? "animate-equalizer-2" : "h-[65%]",
          barClassName,
        )}
        style={{ animationDelay: "160ms" }}
      />
      <span
        className={cn(
          "w-[2px] rounded-full bg-primary",
          playing ? "animate-equalizer-3" : "h-[45%]",
          barClassName,
        )}
        style={{ animationDelay: "320ms" }}
      />
    </span>
  );
}
