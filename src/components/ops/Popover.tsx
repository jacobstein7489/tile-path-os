import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One anchored surface for every small picker: a popover on desktop, a bottom
 * sheet on a phone. The parent element must be `relative`.
 */
export function Popover({
  open,
  onClose,
  children,
  align = "left",
  title,
  width = "md:w-64",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "left" | "right";
  title?: string;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed inset-0 z-40 cursor-default bg-foreground/25 md:bg-transparent"
      />
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-popover p-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-raised)]",
          "md:absolute md:inset-x-auto md:top-[calc(100%+6px)] md:bottom-auto md:rounded-xl md:border md:p-1.5",
          width,
          align === "right" ? "md:right-0" : "md:left-0",
        )}
      >
        {title ? (
          <div className="px-2.5 pt-1.5 pb-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}

/** A single row inside a popover — sized for a thumb on a phone. */
export function PopoverItem({
  children,
  onClick,
  active,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[14.5px] outline-none transition-colors duration-150 md:min-h-9 md:text-[13.5px]",
        active ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted",
        tone === "muted" && !active && "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
