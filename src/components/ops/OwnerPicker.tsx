import { useMemo, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Avatar, SearchInput } from "@/components/kit";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import { useProfiles } from "@/lib/people";
import { firstName } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Owner as a small avatar + first name. Clicking it opens a compact picker and
 * the choice saves immediately — accountability without a dropdown everywhere.
 */
export function OwnerPicker({
  ownerUserId,
  fallbackName,
  onChange,
  align = "right",
  size = "sm",
}: {
  ownerUserId: string | null;
  fallbackName?: string | null;
  onChange: (userId: string | null, name: string | null) => void;
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: profiles = [] } = useProfiles();

  const team = useMemo(() => profiles.filter((p) => p.is_active), [profiles]);
  const current = team.find((p) => p.user_id === ownerUserId);
  const label = current ? firstName(current.full_name) : firstName(fallbackName) || "Assign";
  const matches = query
    ? team.filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()))
    : team;

  return (
    <div className="relative">
      <button
        type="button"
        title={current ? `Owner: ${current.full_name}` : "Assign owner"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-full py-1 pr-2.5 pl-1 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
          size === "md" ? "min-h-10 text-[14px]" : "min-h-8 text-[13px]",
        )}
      >
        {current ? (
          <Avatar
            initials={current.initials || current.full_name.slice(0, 1)}
            tone={current.avatar_tone}
            size={size === "md" ? 28 : 24}
          />
        ) : (
          <span
            className={cn(
              "grid place-items-center rounded-full border border-dashed border-border-strong text-muted-foreground",
              size === "md" ? "size-7" : "size-6",
            )}
          >
            <UserPlus className="size-3.5" />
          </span>
        )}
        <span className={cn("font-medium", current ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} align={align} title="Owner">
        {team.length > 6 ? (
          <div className="px-1 pb-1.5">
            <SearchInput
              value={query}
              autoFocus
              placeholder="Search people"
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
        <div className="max-h-72 overflow-y-auto">
          {matches.map((p) => (
            <PopoverItem
              key={p.user_id}
              active={p.user_id === ownerUserId}
              onClick={() => {
                onChange(p.user_id, p.full_name);
                setOpen(false);
              }}
            >
              <Avatar
                initials={p.initials || p.full_name.slice(0, 1)}
                tone={p.avatar_tone}
                size={24}
              />
              <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
              {p.user_id === ownerUserId ? <Check className="size-4 shrink-0" /> : null}
            </PopoverItem>
          ))}
          <PopoverItem
            tone="muted"
            active={!ownerUserId}
            onClick={() => {
              onChange(null, null);
              setOpen(false);
            }}
          >
            <span className="grid size-6 place-items-center rounded-full border border-dashed border-border-strong">
              <UserPlus className="size-3.5" />
            </span>
            Unassigned
          </PopoverItem>
        </div>
      </Popover>
    </div>
  );
}
