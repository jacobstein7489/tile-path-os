/**
 * The locked OPERATING lifecycle. Pre-award (estimating / proposal) is out of
 * product scope; legacy rows that still carry those stages are mapped for
 * display but the rail only ever shows these seven.
 *
 * Stage is a CONTROLLED state, not a derived one: it advances through explicit
 * user action or a clearly defined system event, and it never moves backward
 * because a readiness blocker appeared. Readiness lives in
 * `readiness_requirement` and is derived separately.
 */
export const LIFECYCLE_STAGES = [
  "Approved",
  "Setup",
  "Ready",
  "Scheduled",
  "Installation",
  "Punch / Return",
  "Complete",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const EXCEPTION_STATES = ["On Hold", "Cancelled"] as const;
export type ExceptionState = (typeof EXCEPTION_STATES)[number];

/** Stored values from earlier versions of the product. */
const LEGACY_STAGE_MAP: Record<string, LifecycleStage> = {
  "New Submission": "Approved",
  Estimating: "Approved",
  Proposal: "Approved",
  Awarded: "Approved",
  "Closeout / Return": "Punch / Return",
  Closeout: "Punch / Return",
};

/** Normalises any stored stage onto the seven operating stages. */
export function normalizeStage(stage: string): LifecycleStage {
  if ((LIFECYCLE_STAGES as readonly string[]).includes(stage)) return stage as LifecycleStage;
  return LEGACY_STAGE_MAP[stage] ?? "Approved";
}

export function stageIndex(stage: string) {
  return LIFECYCLE_STAGES.indexOf(normalizeStage(stage));
}

/** The next operating stage, or null at Complete. */
export function nextStage(stage: string): LifecycleStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= LIFECYCLE_STAGES.length - 1) return null;
  return LIFECYCLE_STAGES[i + 1]!;
}

/**
 * Gates for entering a stage. Readiness may BLOCK entry to Ready, but a
 * blocker never pushes a project backward out of Installation.
 */
export function canEnterStage(
  target: LifecycleStage,
  facts: { blockers: number; hasScheduleAssignment: boolean },
): { ok: boolean; reason?: string } {
  if (target === "Ready" && facts.blockers > 0) {
    return { ok: false, reason: `${facts.blockers} readiness blocker(s) still open` };
  }
  if (target === "Scheduled" && !facts.hasScheduleAssignment) {
    return { ok: false, reason: "No schedule assignment yet" };
  }
  return { ok: true };
}

/** Installation percentages are only meaningful once physical work starts. */
export function showsInstallationProgress(stage: string) {
  return stageIndex(stage) >= stageIndex("Installation");
}

export const PROJECT_FILTERS = [
  "All",
  "Setup",
  "Ready",
  "Scheduled",
  "Installation",
  "Punch / Return",
  "On Hold",
  "Complete",
] as const;

/** Filters shown on the Projects page by default. */
export const PRIMARY_PROJECT_FILTERS = [
  "All",
  "Setup",
  "Ready",
  "Scheduled",
  "Installation",
] as const;

/** Everything else lives behind More filters. */
export const MORE_PROJECT_FILTERS = ["Punch / Return", "On Hold", "Complete"] as const;

export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

const FILTER_STAGES: Record<Exclude<ProjectFilter, "All" | "On Hold">, LifecycleStage[]> = {
  Setup: ["Approved", "Setup"],
  Ready: ["Ready"],
  Scheduled: ["Scheduled"],
  Installation: ["Installation"],
  "Punch / Return": ["Punch / Return"],
  Complete: ["Complete"],
};

export function matchesFilter(
  filter: ProjectFilter,
  stage: string,
  exceptionState: string | null,
): boolean {
  if (filter === "All") return true;
  if (filter === "On Hold") return exceptionState === "On Hold";
  if (exceptionState === "On Hold") return false;
  return FILTER_STAGES[filter].includes(normalizeStage(stage));
}
