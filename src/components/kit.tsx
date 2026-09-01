import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Cobblestone Tile OS design kit.
 * Canonical primitives. Reuse these — never invent new card styles.
 * ============================================================ */

export function KpiCard({
  icon,
  tone = "blue",
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "neutral";
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  const ring: Record<string, string> = {
    blue: "bg-info-soft text-info",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-danger",
    violet: "bg-violet-soft text-violet",
    neutral: "bg-neutral-chip text-muted-foreground",
  };
  const valueTone: Record<string, string> = {
    blue: "text-info",
    green: "text-success",
    amber: "text-warning",
    red: "text-danger",
    violet: "text-violet",
    neutral: "text-foreground",
  };
  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", ring[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-secondary-foreground">{label}</div>
        <div className={cn("text-[26px] leading-[1.15] font-semibold", valueTone[tone])}>
          {value}
        </div>
        {hint ? <div className="truncate text-[11.5px] text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  actions,
  badge,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      {title ? (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-[15.5px] leading-tight font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

/* ---------------- Tabs (underline style from references) ---------------- */

export function UnderlineTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex items-center gap-1 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 pb-3 text-[13.5px] transition-colors",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-secondary-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count ? (
              <span className="grid size-[18px] place-items-center rounded-full bg-danger text-[10px] font-bold text-primary-foreground">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- Buttons ---------------- */

export function Button({
  variant = "secondary",
  size = "md",
  className,
  disabledReason,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabledReason?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary:
      "border border-border bg-card text-secondary-foreground shadow-[var(--shadow-card)] hover:bg-muted",
    ghost: "text-primary hover:bg-accent",
    danger: "bg-danger text-primary-foreground hover:bg-danger/90",
  };
  const sizes = { sm: "h-8 px-3 text-[12.5px]", md: "h-9 px-3.5 text-[13px]" };
  return (
    <button
      type="button"
      {...rest}
      {...(disabledReason ? { title: disabledReason } : {})}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}

export function QuickActionButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/60",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-soft text-info">
        {icon}
      </span>
      <span className="text-[13.5px] font-semibold text-primary">{label}</span>
      <span className="ml-auto text-primary">→</span>
    </button>
  );
}

/* ---------------- Table primitives ---------------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse", className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={cn(
        "border-b border-border px-4 py-2.5 text-left text-[11.5px] font-semibold whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...rest}
      className={cn("border-b border-border/70 px-4 py-3 align-middle text-[13px]", className)}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-[14px] font-semibold">{title}</p>
      {note ? <p className="max-w-md text-[12.5px] text-muted-foreground">{note}</p> : null}
      {action}
    </div>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-info-soft/50 px-4 py-3">
      <span className="mt-[1px] grid size-5 shrink-0 place-items-center rounded-full bg-info text-[11px] font-bold text-primary-foreground">
        i
      </span>
      <p className="text-[12.5px] leading-relaxed text-secondary-foreground">{children}</p>
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/25 p-6 backdrop-blur-[2px]">
      <div
        className={cn(
          "mt-12 w-full rounded-2xl border border-border bg-card shadow-[var(--shadow-raised)]",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-3.5 px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Form fields ---------------- */

const fieldClass =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-secondary-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(fieldClass, "h-auto py-2 leading-relaxed", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, "pr-8", props.className)} />;
}

export function Checkbox({
  checked,
  onChange,
  label,
  strike,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left"
    >
      <span
        className={cn(
          "mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
          checked ? "border-success bg-success text-primary-foreground" : "border-border-strong bg-background",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M4 10.5l4 4 8-8" strokeLinecap="round" />
          </svg>
        ) : null}
      </span>
      {label ? (
        <span
          className={cn(
            "text-[13px] leading-snug",
            strike && checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

/* ---------------- Right-side drawer ---------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  width = "max-w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
      />
      <aside
        className={cn(
          "relative flex h-full w-full flex-col border-l border-border bg-card shadow-[var(--shadow-raised)]",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle ? (
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

/** Subtle vertical workflow sequence — only the current step is emphasized. */
export function StepSequence({ steps, current }: { steps: string[]; current: string | null }) {
  const idx = current ? steps.indexOf(current) : -1;
  return (
    <ol className="space-y-1.5">
      {steps.map((step, i) => {
        const done = idx > -1 && i < idx;
        const active = i === idx;
        return (
          <li key={step} className="flex items-center gap-2.5">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                active ? "bg-primary ring-3 ring-primary/20" : done ? "bg-success" : "bg-border-strong",
              )}
            />
            <span
              className={cn(
                "text-[12.5px]",
                active
                  ? "font-semibold text-foreground"
                  : done
                    ? "text-muted-foreground line-through"
                    : "text-muted-foreground/70",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
