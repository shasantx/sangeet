"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-[calc(156px+env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-col items-center gap-2 md:bottom-24">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            "studio-enter pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-[var(--shadow-elevated)] transition",
            toast.tone === "success" &&
              "border-encore-accent/45 bg-encore-elevated text-encore-text",
            toast.tone === "error" &&
              "border-encore-negative/45 bg-encore-elevated text-encore-negative",
            (!toast.tone || toast.tone === "default") &&
              "border-encore-hairline bg-encore-elevated text-encore-text"
          )}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-encore-accent" />
          ) : toast.tone === "error" ? (
            <XCircle className="h-3.5 w-3.5 text-encore-negative" />
          ) : (
            <Info className="h-3.5 w-3.5 text-encore-accent" />
          )}
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
