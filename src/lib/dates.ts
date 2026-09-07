/** Small date helpers shared by the quick date picker and task rows. */

export function isoDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export function today() {
  return isoDay(new Date());
}

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/** Next occurrence of a weekday (0 = Sunday). Always in the future. */
export function nextWeekday(weekday: number) {
  const d = new Date();
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** The nearest useful "end of week" target — Friday, or Monday once it passes. */
export function nextBusinessMilestone() {
  const day = new Date().getDay();
  const weekday = day >= 5 || day === 0 ? 1 : 5;
  return { iso: nextWeekday(weekday), label: WEEKDAY_NAMES[weekday] ?? "Friday" };
}

/** "Today", "Tomorrow", "Friday" or "Sep 12" — whichever a person would say. */
export function humanDate(value: string | null | undefined) {
  if (!value) return "";
  if (value === today()) return "Today";
  if (value === addDays(1)) return "Tomorrow";
  if (value === addDays(-1)) return "Yesterday";
  const d = new Date(value + "T12:00:00");
  const within = (Number(d) - Number(new Date(today() + "T12:00:00"))) / 86400000;
  if (within > 0 && within < 7) return WEEKDAY_NAMES[d.getDay()] ?? "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function humanDateTime(value: string) {
  const d = new Date(value);
  const dayIso = isoDay(d);
  const dayLabel =
    dayIso === today()
      ? "TODAY"
      : dayIso === addDays(-1)
        ? "YESTERDAY"
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return `${dayLabel} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function firstName(full: string | null | undefined) {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}
