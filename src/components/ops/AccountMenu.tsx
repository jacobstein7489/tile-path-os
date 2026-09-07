import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Package, Percent, Settings } from "lucide-react";
import { Avatar } from "@/components/kit";
import { Popover } from "@/components/ops/Popover";
import { ROLE_LABELS, signOut, useMyProfile, useMyRoles } from "@/hooks/useAuth";

/** On a phone the secondary destinations live behind the profile avatar. */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useMyRoles();
  const primaryRole = roles[0];

  const links = [
    { label: "Deliveries", to: "/materials", icon: Package },
    { label: "Commissions", to: "/commissions", icon: Percent },
    { label: "Settings", to: "/settings", icon: Settings },
  ] as const;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account and more"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Avatar
          initials={profile?.initials || profile?.full_name?.slice(0, 1) || "?"}
          tone={profile?.avatar_tone ?? "blue"}
          size={32}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" width="md:w-60">
        <div className="px-2.5 pt-1 pb-2.5">
          <div className="text-[14px] font-bold">{profile?.full_name ?? "Signed in"}</div>
          <div className="text-[12px] text-muted-foreground">
            {primaryRole ? ROLE_LABELS[primaryRole] : "No role assigned"}
          </div>
        </div>
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[14.5px] font-medium hover:bg-muted md:min-h-9 md:text-[13.5px]"
          >
            <l.icon className="size-4 text-muted-foreground" />
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[14.5px] font-medium text-muted-foreground hover:bg-muted md:min-h-9 md:text-[13.5px]"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </Popover>
    </div>
  );
}
