"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, type ToastTone } from "@/store/ui-store";

const icons: Record<ToastTone, React.ReactNode> = {
  default: <Info className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
};

const tones: Record<ToastTone, string> = {
  default: "text-muted-foreground",
  info: "text-[#A8B6E8]",
  success: "text-[#7ED0AE]",
  error: "text-[#F09A9F]",
};

export function Toaster() {
  const toasts = useUIStore((state) => state.toasts);
  const dismiss = useUIStore((state) => state.dismissToast);
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-[178px] z-[170] flex flex-col items-end gap-2 sm:bottom-[104px] sm:left-auto sm:right-5 sm:w-[370px]"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduceMotion}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-white/[.08] bg-[#1c1c24]/95 p-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl"
            role="status"
          >
            <span className={cn("mt-0.5 shrink-0", tones[item.tone])}>{icons[item.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-5 text-foreground">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-white/[.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
