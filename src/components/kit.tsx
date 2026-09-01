import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Friendly short date for a yyyy-mm-dd value, e.g. "Sep 4". */
export function friendlyDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Date field with an obvious calendar affordance: clicking anywhere opens the
 * native picker, the chosen value shows as a friendly date, and Clear is easy.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  label = "Date",
  className,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const openPicker = () => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };
  return (
    <div
      onClick={openPicker}
      className={cn(
        "relative flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-[13px]",
        "transition-colors duration-150 hover:border-border-strong focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
        className,
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
        {value ? friendlyDate(value) : placeholder}
      </span>
      {value ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="relative z-10 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <input
        ref={ref}
        type="date"
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 z-0 size-full cursor-pointer opacity-0"
      />
    </div>
  );
}

/** Compact metric tile used for the restrained status strips (not a big KPI card). */
export function MetricTile({
  label,
  value,
  tone = "neutral",
  icon,
  active = false,
  onClick,
}: {
  label: string;
  value: ReactNode;
  tone?: "blue" | "amber" | "green" | "neutral";
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    blue: "bg-info-soft/70 text-info",
    amber: "bg-warning-soft/70 text-warning",
    green: "bg-success-soft/70 text-success",
    neutral: "bg-muted text-secondary-foreground",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "surface flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left outline-none",
        "transition-[background-color,border-color,transform] duration-150 hover:border-border-strong active:translate-y-[0.5px]",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        active && "border-primary/35 ring-1 ring-inset ring-primary/20",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tones[tone])}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[19px] leading-none font-bold tabular-nums">{value}</span>
        <span className="mt-1 block truncate text-[11.5px] font-medium text-muted-foreground">
          {label}
        </span>
      </span>
    </button>
  );
}

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
  tone?: "blue" | "green" | "amber" | "red" | "neutral";
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  const ring: Record<string, string> = {
    blue: "bg-info-soft text-info",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-danger",
    neutral: "bg-neutral-chip text-muted-foreground",
  };
  const valueTone: Record<string, string> = {
    blue: "text-info",
    green: "text-success",
    amber: "text-warning",
    red: "text-danger",
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
  items: { value: string; label: string; count?: number; to?: string; params?: any }[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex items-center gap-1 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.value === value;
        const base = cn(
          "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 pb-3 text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/20",
          active
            ? "border-primary font-semibold text-primary"
            : "border-transparent font-medium text-secondary-foreground hover:border-border-strong hover:text-foreground",
        );

        const content = (
          <>
            {item.label}
            {item.count ? (
              <span className="grid size-[18px] place-items-center rounded-full bg-danger text-[10px] font-bold text-primary-foreground">
                {item.count}
              </span>
            ) : null}
          </>
        );

        if (item.to) {
          return (
            <Link key={item.value} to={item.to as any} params={item.params} className={base}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange?.(item.value)}
            className={base}
          >
            {content}
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
  loading = false,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabledReason?: string;
  loading?: boolean;
}) {
  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/35 active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-55";
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
      disabled={rest.disabled || loading}
      {...(disabledReason ? { title: disabledReason } : {})}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function FilterGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-semibold outline-none transition-colors duration-150 active:translate-y-[0.5px] focus-visible:ring-2 focus-visible:ring-primary/25",
              active
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-border bg-background text-secondary-foreground hover:bg-muted",
            )}
          >
            {opt.label}
            {opt.count !== undefined ? (
              <span className="ml-1.5 text-[12px] tabular-nums opacity-70">{opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
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
        "surface flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
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
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted"
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
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25 transition-all";

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

export const SearchInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function SearchInput({ className, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input ref={ref} {...props} className={cn(fieldClass, "pl-9")} />
    </div>
  );
});

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
      className="group/check -mx-1 flex cursor-pointer items-start gap-3 rounded-sm px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
    >
      <span
        className={cn(
          "mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-[background-color,border-color,transform] duration-150",
          checked
            ? "scale-105 border-success bg-success text-primary-foreground"
            : "border-border-strong bg-background group-active/check:scale-95",
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
            "text-[13px] leading-snug transition-colors",
            strike && checked ? "text-muted-foreground line-through" : "text-foreground",
            !checked && "group-hover/check:text-primary",
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
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
      />
      {/* Phone: full-height bottom sheet. Desktop: right-side drawer. */}
      <aside
        className={cn(
          "relative flex w-full flex-col border-border bg-card shadow-[var(--shadow-raised)]",
          "h-[93vh] rounded-t-2xl border-t md:h-full md:rounded-none md:border-t-0 md:border-l",
          width,
        )}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-border bg-card px-4 py-3.5 md:rounded-none md:px-5 md:py-4">
          <div className="min-w-0">
            <h2 className="text-[15.5px] leading-snug font-semibold tracking-[-0.01em] break-words">
              {title}
            </h2>
            {subtitle ? (
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5 md:py-3.5">
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


/* ---------------- Searchable selector (canonical reference picker) ---------------- */

export type ComboOption = { value: string; label: string; hint?: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "No matches",
  allowClear = true,
  disabled,
  className,
  onCreate,
  createLabel = "Add",
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  onCreate?: (label: string) => void | Promise<void>;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(q))
      .slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        className={cn(
          fieldClass,
          "flex cursor-pointer items-center justify-between gap-2 text-left transition-colors duration-150 hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-raised)]">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search"
              className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowClear && selected ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted"
                >
                  Clear selection
                </button>
              </li>
            ) : null}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{o.label}</span>
                    {o.hint ? (
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {o.hint}
                      </span>
                    ) : null}
                  </span>
                  {o.value === value ? <Check className="size-3.5 text-primary" /> : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-muted-foreground">{emptyLabel}</li>
            ) : null}
          </ul>
          {onCreate && query.trim() ? (
            <button
              type="button"
              onClick={async () => {
                await onCreate(query.trim());
                setOpen(false);
              }}
              className="w-full border-t border-border px-3 py-2.5 text-left text-[12.5px] font-semibold text-primary hover:bg-accent"
            >
              {createLabel} “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Skeleton / Avatar ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 px-4 py-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Avatar({
  initials,
  tone = "blue",
  size = 28,
  title,
}: {
  initials: string;
  tone?: string;
  size?: number;
  title?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-info-soft text-info",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-danger",
    neutral: "bg-neutral-chip text-muted-foreground",
  };
  return (
    <span
      title={title}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold",
        tones[tone] ?? tones["blue"],
      )}
    >
      {initials || "?"}
    </span>
  );
}
