import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CenterDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "inset-x-0 top-auto bottom-0 h-[calc(100dvh-0.5rem)] max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-xl border-border bg-card p-0 shadow-[var(--shadow-dialog)]",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-auto sm:max-h-[84dvh] sm:w-[calc(100%-4rem)] sm:max-w-[1080px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">{description}</DialogDescription>
        ) : null}
        <div
          className={cn(
            "h-full max-h-[calc(100dvh-0.5rem)] overflow-y-auto overscroll-contain sm:h-auto sm:max-h-[84dvh]",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
