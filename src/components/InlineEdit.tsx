import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline editable text. Click → edit, Enter → save, Escape → cancel.
 * Saving is delegated to the caller, which saves optimistically.
 */
export function InlineText({
  value,
  onSave,
  placeholder = "—",
  className,
  inputClassName,
  multiline = false,
  type = "text",
  ariaLabel,
  query = "",
  strike = false,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  inputClassName?: string | undefined;
  multiline?: boolean | undefined;
  type?: ("text" | "date") | undefined;
  ariaLabel: string;
  /** Search term to highlight while not editing. */
  query?: string | undefined;
  strike?: boolean | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (type === "text") ref.current.select();
    }
  }, [editing, type]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === (value ?? "").trim()) return;
    onSave(next ? next : null);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    const shared = {
      value: draft,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onBlur: commit,
      "aria-label": ariaLabel,
      className: cn(
        "w-full rounded-md border border-ring bg-background px-2 py-1 text-[13px] outline-none ring-2 ring-ring/25",
        inputClassName,
      ),
    };
    return multiline ? (
      <textarea
        {...shared}
        ref={ref as React.Ref<HTMLTextAreaElement>}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
    ) : (
      <input
        {...shared}
        ref={ref as React.Ref<HTMLInputElement>}
        type={type}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Edit ${ariaLabel}`}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "-mx-1.5 block w-full cursor-text rounded-md px-1.5 py-1 text-left outline-none",
        "transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
    >
      {value ? (
        <span className={cn("block", strike && "text-muted-foreground line-through")}>
          <Highlight text={value} query={query} />
        </span>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </button>
  );
}

/** Subtle highlight of matching search text. */
export function Highlight({ text, query }: { text: string; query?: string | undefined }) {
  const q = (query ?? "").trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-warning-soft px-0.5 text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
