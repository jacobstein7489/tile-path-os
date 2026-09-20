import type { Project } from "@/lib/data";

export const VNEXT_STAGES = [
  "New Job / Price Request",
  "Estimate",
  "Proposal Sent",
  "Awarded",
  "Setup",
  "Design / Decisions",
  "Ready",
  "Scheduled",
  "Installation",
  "Punch / Return",
  "Billing / Closeout",
  "Complete",
] as const;
export type VNextStage = (typeof VNEXT_STAGES)[number];

const STORED_TO_DISPLAY: Record<string, VNextStage> = {
  "New Submission": "New Job / Price Request",
  Estimating: "Estimate",
  Proposal: "Proposal Sent",
  Approved: "Awarded",
  Awarded: "Awarded",
  Setup: "Setup",
  Design: "Design / Decisions",
  "Design / Decisions": "Design / Decisions",
  Ready: "Ready",
  Scheduled: "Scheduled",
  Installation: "Installation",
  "Punch / Return": "Punch / Return",
  "Closeout / Return": "Punch / Return",
  Closeout: "Billing / Closeout",
  "Billing / Closeout": "Billing / Closeout",
  Complete: "Complete",
};
const DISPLAY_TO_STORED: Record<VNextStage, string> = {
  "New Job / Price Request": "New Submission",
  Estimate: "Estimating",
  "Proposal Sent": "Proposal",
  Awarded: "Approved",
  Setup: "Setup",
  "Design / Decisions": "Design / Decisions",
  Ready: "Ready",
  Scheduled: "Scheduled",
  Installation: "Installation",
  "Punch / Return": "Punch / Return",
  "Billing / Closeout": "Billing / Closeout",
  Complete: "Complete",
};

export function vnextStage(
  project: Pick<Project, "lifecycle_stage" | "exception_state">,
): VNextStage {
  return STORED_TO_DISPLAY[project.lifecycle_stage] ?? "Awarded";
}
export function storedVNextStage(stage: VNextStage) {
  return DISPLAY_TO_STORED[stage];
}
export function vnextStageIndex(project: Pick<Project, "lifecycle_stage" | "exception_state">) {
  return VNEXT_STAGES.indexOf(vnextStage(project));
}
export function isPreAwardStage(stage: VNextStage) {
  return VNEXT_STAGES.indexOf(stage) <= VNEXT_STAGES.indexOf("Proposal Sent");
}
export function readinessRelevant(stage: VNextStage) {
  return ["Awarded", "Setup", "Design / Decisions", "Ready", "Scheduled"].includes(stage);
}
export function stageFamily(stage: VNextStage) {
  if (isPreAwardStage(stage)) return "preaward" as const;
  if (["Awarded", "Setup", "Design / Decisions", "Ready"].includes(stage)) return "setup" as const;
  if (stage === "Scheduled") return "scheduled" as const;
  if (stage === "Installation") return "installation" as const;
  if (stage === "Punch / Return") return "punch" as const;
  if (stage === "Billing / Closeout") return "billing" as const;
  return "complete" as const;
}
export function nextVNextStage(stage: VNextStage): VNextStage | null {
  const index = VNEXT_STAGES.indexOf(stage);
  const next = index >= 0 && index < VNEXT_STAGES.length - 1 ? VNEXT_STAGES[index + 1] : undefined;
  return next ?? null;
}
