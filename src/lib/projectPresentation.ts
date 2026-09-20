import { normalizeStage, showsInstallationProgress } from "@/lib/lifecycle";

export type ReadinessPresentation = {
  visible: boolean;
  prominent: boolean;
  label: string;
  detail: string | null;
  tone: "green" | "amber" | "red" | "neutral";
};

export function readinessPresentation(project: {
  lifecycle_stage: string;
  readiness_pct?: number | null;
  readiness_note?: string | null;
}): ReadinessPresentation {
  const stage = normalizeStage(project.lifecycle_stage);
  const pct = Math.max(0, Math.min(100, project.readiness_pct ?? 0));
  const detail = project.readiness_note?.trim() || null;
  const state = pct >= 100 ? "Ready" : pct > 0 ? "Partial" : "Not ready";

  if (stage === "Complete" || stage === "Punch / Return") {
    return { visible: false, prominent: false, label: state, detail, tone: "neutral" };
  }
  if (stage === "Installation") {
    if (pct >= 100 && !detail) {
      return { visible: false, prominent: false, label: "Ready", detail: null, tone: "green" };
    }
    return {
      visible: true,
      prominent: false,
      label: "Upcoming work at risk",
      detail,
      tone: pct <= 0 ? "red" : "amber",
    };
  }
  if (stage === "Scheduled") {
    if (pct >= 100 && !detail) {
      return { visible: true, prominent: false, label: "Ready", detail: null, tone: "green" };
    }
    return {
      visible: true,
      prominent: true,
      label: pct >= 100 ? "Start needs review" : `${state} for scheduled start`,
      detail,
      tone: pct <= 0 ? "red" : "amber",
    };
  }
  return {
    visible: true,
    prominent: true,
    label: state,
    detail,
    tone: pct >= 100 ? "green" : pct <= 0 ? "red" : "amber",
  };
}

export function projectPrimaryMetric(project: {
  lifecycle_stage: string;
  installation_progress?: number | null;
}) {
  if (!showsInstallationProgress(project.lifecycle_stage)) return null;
  const stage = normalizeStage(project.lifecycle_stage);
  if (stage === "Complete") return null;
  return {
    label: stage === "Punch / Return" ? "Installed" : "Installation progress",
    value: Math.max(0, Math.min(100, project.installation_progress ?? 0)),
  };
}