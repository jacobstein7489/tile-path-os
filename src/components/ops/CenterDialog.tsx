import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CenterDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92dvh] w-[calc(100%-1rem)] max-w-[1040px] gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-[var(--shadow-dialog)] sm:rounded-2xl",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : null}
        <div className="max-h-[92dvh] overflow-y-auto overscroll-contain">{children}</div>
      </DialogContent>
    </Dialog>
  );
}