import type { ReactNode } from "react";
import { ArrowUpRight, Building2, CircleAlert, Clock3, MapPin } from "lucide-react";
import type { Project } from "@/lib/data";
import type { WorkItemRow } from "@/lib/workitems";
import { actionDate, isOverdue, isWaiting } from "@/lib/workitems";
import { cn } from "@/lib/utils";
import { type VNextStage } from "@/lib/vnext";

export function VNextPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-vnext-line pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="vnext-kicker">{eyebrow}</p><h1 className="mt-2 font-display text-[30px] leading-[1.05] font-bold sm:text-[38px]">{title}</h1><p className="mt-2 max-w-[660px] text-[12.5px] leading-5 text-vnext-muted sm:text-[13px]">{description}</p></div>{action}</header>;
}
export function VNextMark({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "amber" | "green" | "ink" }) {
  return <span className={cn("grid size-11 shrink-0 place-items-center rounded-[13px] border", tone === "ink" ? "border-vnext-ink bg-vnext-ink text-vnext-surface" : tone === "amber" ? "border-vnext-amber/20 bg-vnext-amber-soft text-vnext-amber" : tone === "green" ? "border-vnext-green/20 bg-vnext-green-soft text-vnext-green" : "border-vnext-blue/15 bg-vnext-blue-soft text-vnext-blue")}>{children}</span>;
}
export function StageBadge({ stage, exception }: { stage: VNextStage; exception?: string | null }) {
  const label = exception ?? stage;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[9.5px] font-extrabold uppercase", exception === "Cancelled" ? "bg-vnext-red-soft text-vnext-red" : exception === "On Hold" || stage === "Proposal Sent" ? "bg-vnext-amber-soft text-vnext-amber" : stage === "Ready" || stage === "Complete" ? "bg-vnext-green-soft text-vnext-green" : "bg-vnext-blue-soft text-vnext-blue")}>{label}</span>;
}
export function JobIdentity({ project, customer, stage }: { project: Project; customer?: string | null; stage: VNextStage }) {
  return <div className="flex min-w-0 items-start gap-3.5"><VNextMark tone="ink"><Building2 className="size-5" /></VNextMark><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StageBadge stage={stage} exception={project.exception_state} />{project.job_number ? <span className="text-[10px] font-bold text-vnext-faint">#{project.job_number}</span> : null}</div><h2 className="mt-1.5 truncate font-display text-[19px] leading-tight font-bold sm:text-[21px]">{project.name}</h2><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-vnext-muted"><span>{customer ?? project.customer ?? "Customer not set"}</span><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{project.address ?? "Address not set"}</span></div></div></div>;
}
export function WorkRow({ item, onClick }: { item: WorkItemRow; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-vnext-line bg-vnext-surface px-3 py-2.5 text-left shadow-[var(--vnext-shadow-row)] transition hover:-translate-y-px hover:border-vnext-blue/30"><span className={cn("grid size-8 place-items-center rounded-lg", isOverdue(item) ? "bg-vnext-red-soft text-vnext-red" : isWaiting(item) ? "bg-vnext-amber-soft text-vnext-amber" : "bg-vnext-blue-soft text-vnext-blue")}>{isOverdue(item) ? <CircleAlert className="size-4" /> : <Clock3 className="size-4" />}</span><span className="min-w-0"><strong className="block truncate text-[12.5px]">{item.title}</strong><span className="mt-0.5 block truncate text-[10.5px] text-vnext-muted">{item.owner ?? item.waiting_on ?? item.category ?? "Open action"}{actionDate(item) ? ` · ${formatDate(actionDate(item))}` : ""}</span></span><ArrowUpRight className="size-4 text-vnext-faint transition group-hover:text-vnext-blue" /></button>;
}
export function VNextPanel({ title, eyebrow, action, children, className }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-[15px] border border-vnext-line bg-vnext-surface shadow-[var(--vnext-shadow-panel)]", className)}><header className="flex items-center justify-between gap-3 border-b border-vnext-line px-4 py-3.5 sm:px-5"><div>{eyebrow ? <p className="vnext-kicker">{eyebrow}</p> : null}<h3 className="font-display text-[14px] font-bold">{title}</h3></div>{action}</header>{children}</section>;
}
export function formatDate(value?: string | null) { if (!value) return "Not set"; return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(value).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }); }
