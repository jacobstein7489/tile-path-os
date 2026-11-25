/* Reminders that reach a phone with the app closed. Every minute the database asks the app's server (/api/remind) what's
 * due; the server reads the company's to-dos, meetings and notices and sends each person's phones what's for them, once:
 *   - a to-do set for a time (5 PM), at that time: "Due now"
 *   - a meeting or walkthrough, 15 minutes before
 *   - on a work-day morning, once: what's still open from before (late), so nothing just sits there
 *   - right away: someone reminded you, gave you something urgent, needs something brought, or what you asked for is on
 *     the way or dropped off
 *   - the crew list at its time (6 PM unless it was changed), to whoever sends it, until it's sent
 *   - at 5 PM, the daily updates still not sent for the jobs being worked that day
 * Only the person it's for (and anyone it's shared with), never everyone watching it. What was sent is kept, so a thing
 * is never sent twice. Everything about the person's day is in their own time zone (the phone says which). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { newVapidKeys, sendPush, type VapidKeys, type PushTarget } from "./webpush";

const db = () => supabaseAdmin as any;
export const SUBJECT = "https://cobblestone.lovable.app";

/* ---------------- our push keys: made once, kept on the server ---------------- */
let keysCache: VapidKeys | null = null;
export async function vapidKeys(): Promise<VapidKeys> {
  if (keysCache) return keysCache;
  const { data, error } = await db().from("tileos_push_keys").select("public_key, private_jwk").eq("id", "main").maybeSingle();
  if (error) throw new Error(error.message || "push keys");
  if (data?.public_key && data.private_jwk) return (keysCache = { publicKey: data.public_key, privateJwk: data.private_jwk });
  const fresh = await newVapidKeys();
  /* two at once: the first one kept wins, both read it back */
  await db().from("tileos_push_keys").upsert({ id: "main", public_key: fresh.publicKey, private_jwk: fresh.privateJwk }, { onConflict: "id", ignoreDuplicates: true });
  const again = await db().from("tileos_push_keys").select("public_key, private_jwk").eq("id", "main").maybeSingle();
  if (!again.data?.public_key) throw new Error(again.error?.message || "push keys");
  return (keysCache = { publicKey: again.data.public_key, privateJwk: again.data.private_jwk });
}

export type Device = PushTarget & { user_id: string; person: string; tz?: string | null };
export type PushMessage = { title: string; body: string; tag: string; open?: { t: string; id?: string; [k: string]: any } };

/** send to some devices; a device that's gone (404/410) is taken off the list */
export async function sendTo(devices: Device[], m: PushMessage): Promise<number> {
  const keys = await vapidKeys();
  let n = 0;
  for (const d of devices) {
    try {
      const st = await sendPush(d, m, keys, SUBJECT);
      if (st === 404 || st === 410) await db().from("tileos_push").delete().eq("endpoint", d.endpoint);
      else if (st >= 200 && st < 300) { n++; await db().from("tileos_push").update({ last_sent: new Date().toISOString() }).eq("endpoint", d.endpoint); }
      else console.error("push said", st, d.endpoint.slice(0, 60));
    } catch (e) {
      console.error("push failed", e);
    }
  }
  return n;
}

/* ---------------- days and times, in the person's own time zone ---------------- */
const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay();
/** the day and the minute of the day it is (or was, for a time) where they are */
export function localAt(tz: string, at: Date = new Date()): { day: string; min: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** the day a to-do is due: its words ("Today", "Fri", "Nov 24") as they were meant the day it was saved */
export function dueDay(label: string | undefined, saved: string): string | undefined {
  if (!label) return undefined;
  const l = label.trim().toLowerCase();
  if (/^\d{4}-\d\d-\d\d$/.test(l)) return l;
  if (l === "today" || l === "now" || l === "just now") return saved;
  if (l === "tomorrow") return addDays(saved, 1);
  if (l === "yesterday") return addDays(saved, -1);
  if (l === "next mon" || l === "next week") { let d = addDays(saved, 1); while (dow(d) !== 1) d = addDays(d, 1); return d; }
  if (l === "in 2 weeks") return addDays(saved, 14);
  if (l === "this week") { let d = saved; while (dow(d) !== 5) d = addDays(d, 1); return d; }
  const late = l.match(/^(\d+) days? late$/);
  if (late) return addDays(saved, -Number(late[1]));
  const wd = WD.findIndex((k) => l.startsWith(k));
  if (wd >= 0 && l.length <= 9) { let d = saved; while (dow(d) !== wd) d = addDays(d, 1); return d; }
  const m = l.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:,? (\d{4}))?$/);
  if (m) return `${m[3] || saved.slice(0, 4)}-${pad(MON.indexOf(m[1]) + 1)}-${pad(Number(m[2]))}`;
  return undefined;
}
/** "5 PM", "4:30 pm", "9:00 AM" → minutes from midnight (no AM/PM and before 7: the afternoon) */
export function minOf(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/\b(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3]?.toLowerCase();
  if (h > 12 || min > 59) return null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 7) h += 12;
  return h * 60 + min;
}
/** "5 PM", "4:30 PM": the way the app writes a time */
const clock = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}${min % 60 ? ":" + pad(min % 60) : ""} ${min >= 720 ? "PM" : "AM"}`;

/* ---------------- what's due for one person, now ---------------- */
type Task = { id: string; jobId?: string; title: string; owner: string; also?: string[]; state: string; due?: string; at?: string; repeatAt?: string; step?: string; hold?: boolean; paused?: boolean; nudge?: { by: string; at: string; day?: string }; log?: { date: string; time?: string; text: string }[] };
const MON_NAME = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 24": how the app writes a day on a to-do's lines */
const mdOf = (iso: string) => `${MON_NAME[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
/* given its time after that time had already passed ("call him at 5", typed at 5:40): nothing to remind */
const setAfter = (t: Task, day: string, time: number) => {
  const l = [...(t.log || [])].reverse().find((x) => x.date === mdOf(day) && (/^Created/.test(x.text) || /^Time: /.test(x.text)));
  const at = l?.time ? minOf(l.time) : null;
  return at != null && at > time;
};
type Meeting = { id: string; jobId?: string; title: string; date: string; start: number; people?: string[]; where?: string; done?: boolean };
type Notice = { id: string; jobId?: string; text: string; unread?: boolean; open?: { t: string; [k: string]: any }; for?: string[] };
/** a record and when it was saved: its day (where the person is) and the moment */
export type Rec<T> = { data: T; saved: string; at?: number };
/* what someone sent you that can't wait: said the way a phone shows it, a title and a line under it */
const NOTICE_PUSH: [RegExp, (m: RegExpMatchArray) => { title: string; body: string }][] = [
  [/^Urgent from ([^:]+): (.+)$/, (m) => ({ title: `Urgent from ${m[1]}`, body: m[2] })],
  [/^(.+?) needs (.+) at (.+?) · by (.+)$/, (m) => ({ title: `${m[1]} needs ${m[2]}`, body: `${m[3]} · by ${m[4]}` })],
  [/^On the way · (.+)$/, (m) => ({ title: "On the way", body: m[1] })],
  [/^Dropped off · (.+)$/, (m) => ({ title: "Dropped off", body: m[1] })],
  /* the admin's Remind on a line that has no reminder of its own (the crew list, the daily updates, a step…) */
  [/^(.+?) reminded you: (.+)$/, (m) => ({ title: `${m[1]} reminded you`, body: m[2] })],
];
/** every thing for this person at this minute (in their time zone), each with the tag it's sent under once */
export function dueFor(person: string, tasks: Rec<Task>[], meetings: Meeting[], jobName: (id?: string) => string, now: { day: string; min: number }, more: { notices?: Rec<Notice>[]; nameOf?: (k: string) => string; nowMs?: number } = {}): PushMessage[] {
  const out: PushMessage[] = [];
  const mine = (t: Task) => t.state === "now" && !t.hold && !t.paused && (t.owner === person || !!t.also?.includes(person));
  const where = (id?: string) => { const n = jobName(id); return n ? ` · ${n}` : ""; };
  const nowMs = more.nowMs ?? Date.now();
  for (const { data: t, saved } of tasks) {
    if (!mine(t)) continue;
    const time = minOf(t.at || t.repeatAt);
    const day = dueDay(t.due, saved);
    /* at its time, and not hours later (the check was down): only within two hours */
    if (time == null || day !== now.day || time > now.min || now.min - time > 120 || setAfter(t, day, time)) continue;
    out.push({ title: `Due now · ${clock(time)}`, body: `${t.title}${where(t.jobId)}`, tag: `t:${person}:${t.id}:${day}:${time}`, open: { t: "task", id: t.id, seen: `due:${t.id}:${day}:${time}` } });
  }
  for (const e of meetings) {
    if (e.done || !e.people?.includes(person) || e.date !== now.day) continue;
    /* 15 minutes before, until it starts */
    if (now.min < e.start - 15 || now.min > e.start) continue;
    out.push({ title: `In ${Math.max(1, e.start - now.min)} min · ${clock(e.start)}`, body: `${e.title}${where(e.jobId)}`, tag: `e:${person}:${e.id}:${e.date}:${e.start}`, open: { t: "event", id: e.id, seen: `soon:${e.id}:${e.date}:${e.start}` } });
  }
  /* someone reminded you (the admin's Remind): right away, once for each time they tapped it */
  const nudged = new Map<string, Task[]>();
  for (const { data: t } of tasks) {
    const n = t.nudge;
    if (!mine(t) || t.owner !== person || !n || n.by === person) continue;
    const at = parseInt(n.at, 36);
    if (!at || nowMs - at > 30 * 60e3 || at - nowMs > 5 * 60e3) continue;
    nudged.set(`${n.by}:${n.at}`, [...(nudged.get(`${n.by}:${n.at}`) || []), t]);
  }
  for (const [k, ts] of nudged) {
    const by = k.split(":")[0];
    const who = more.nameOf?.(by) || "Someone";
    out.push({ title: `${who} reminded you`, body: ts.length === 1 ? `${ts[0].title}${where(ts[0].jobId)}` : `${ts.length} things · ${ts.slice(0, 2).map((t) => t.title).join(" · ")}${ts.length > 2 ? " · and more" : ""}`, tag: `r:${person}:${k}`, open: ts.length === 1 ? { t: "task", id: ts[0].id } : { t: "late" } });
  }
  /* urgent for you, something to bring, on the way, dropped off: right away (only what came in the last few minutes) */
  for (const { data: n, at } of more.notices || []) {
    if (!n?.for?.includes(person) || n.unread === false || !at || nowMs - at > 20 * 60e3) continue;
    for (const [re, say] of NOTICE_PUSH) {
      const m = String(n.text || "").match(re);
      if (!m) continue;
      out.push({ ...say(m), tag: `n:${person}:${n.id}`, open: n.open?.t ? { ...n.open } : undefined });
      break;
    }
  }
  /* a work-day morning (7:30 to 11), once: what's still open from before */
  if (dow(now.day) >= 1 && dow(now.day) <= 5 && now.min >= 450 && now.min < 660) {
    /* the latest first: what's been waiting longest is what matters most */
    const late = tasks
      .map(({ data: t, saved }) => ({ t, day: dueDay(t.due, saved) || "9999" }))
      .filter(({ t, day }) => mine(t) && t.owner === person && !t.step && day < now.day)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((x) => x.t);
    if (late.length) out.push({ title: late.length === 1 ? "Still open from before" : `${late.length} still open from before`, body: late.slice(0, 3).map((t) => t.title).join(" · ") + (late.length > 3 ? ` · and ${late.length - 3} more` : ""), tag: `l:${person}:${now.day}`, open: { t: "late" } });
  }
  return out;
}

/* ---------------- the crew list: at its time, to whoever sends it ---------------- */
type CrewJob = { stage?: string; hold?: unknown; kind?: string; onSite?: { day?: string }; crewPlan?: { day?: string } };
export type CrewRules = { crewAt?: number; autoOff?: string[]; autoWho?: Record<string, string> };
const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** the next work day after this one (Friday, Saturday, Sunday: Monday) */
const nextWorkDay = (iso: string) => { let d = addDays(iso, 1); while (dow(d) === 0 || dow(d) === 6) d = addDays(d, 1); return d; };
/** the next work day's crew list at its time (Settings → Automations → Crew list; 6 PM unless it was changed), while
 *  it isn't sent: to the one it's set for there, else whoever is the site manager. The same as the line on his Today:
 *  every project in progress, sent once each has its people for that day. Not on a Saturday (Friday's is Monday's) */
export function crewDue(person: string, now: { day: string; min: number }, ctx: { rules: CrewRules; jobs: CrewJob[]; roleOf: (k: string) => string | undefined }): PushMessage | null {
  const r = ctx.rules || {};
  if ((r.autoOff || []).includes("crew-morning")) return null;
  const to = r.autoWho?.["crew-morning"];
  if (to ? person !== to : ctx.roleOf(person) !== "site") return null;
  if (dow(now.day) === 6) return null;
  const at = (typeof r.crewAt === "number" ? r.crewAt : 18) * 60;
  /* at its time, and not hours later (the check was down): only within two hours */
  if (now.min < at || now.min - at > 120) return null;
  const day = nextWorkDay(now.day);
  const open = ctx.jobs.filter((j) => j && j.stage === "installation" && !j.hold && j.kind !== "repair");
  if (!open.length || open.every((j) => j.onSite?.day === day || j.crewPlan?.day === day)) return null;
  const whose = day === addDays(now.day, 1) ? "tomorrow’s" : `${DAY_NAME[dow(day)]}’s`;
  return { title: `Due now · ${clock(at)}`, body: `Send ${whose} crew list · ${open.length} ${open.length === 1 ? "project" : "projects"}`, tag: `c:${person}:${day}`, open: { t: "crewreport", day, seen: `crew:${day}` } };
}
/* ---------------- the daily updates: at 5 PM, for every job still without today's ---------------- */
type Booking = { jobId: string; crew?: string; start: string; end: string; label?: string };
export type DailyJob = CrewJob & { name?: string; dates?: { start?: string } };
const DAILY_AT = 17 * 60;
const MD = MON_NAME;
/** "Oct 20" → its date (last year's when it would be more than a month ahead); a daily update keeps its day as mdOf's */
const isoOfMd = (label: string | undefined, today: string) => {
  const m = (label || "").match(/^([A-Z][a-z]{2}) (\d{1,2})$/);
  if (!m || MD.indexOf(m[1]) < 0) return undefined;
  const y = +today.slice(0, 4);
  const iso = `${y}-${pad(MD.indexOf(m[1]) + 1)}-${pad(+m[2])}`;
  return iso > addDays(today, 31) ? `${y - 1}${iso.slice(4)}` : iso;
};
/** the jobs with a crew working that day, the same as the app's Today: booked that day, or being installed with no
 *  days booked (a work day, once it has started) */
export function workingJobs(day: string, jobs: Record<string, DailyJob>, bookings: Booking[]): string[] {
  const live = (j?: DailyJob) => !!j && j.stage === "installation" && !j.hold;
  const real = bookings.filter((b) => b && b.label !== "Return visit");
  const booked = real.filter((b) => b.start <= day && b.end >= day && live(jobs[b.jobId])).map((b) => b.jobId);
  const have = new Set(booked);
  const workDay = dow(day) !== 0 && dow(day) !== 6;
  const rest = !workDay ? [] : Object.entries(jobs).filter(([id, j]) => {
    if (!live(j) || have.has(id)) return false;
    const last = real.filter((b) => b.jobId === id).sort((a, b) => b.start.localeCompare(a.start))[0];
    if (last && last.start > day) return false;
    const start = last?.start || isoOfMd(j.dates?.start, day);
    return !(!last && start && start > day);
  }).map(([id]) => id);
  return Array.from(new Set([...booked, ...rest]));
}
/** at 5 PM (the time it's on Today), whoever sends the daily updates (the one set in Automations, else the site
 *  manager) gets the jobs still without today's — once. `sent` says which of them have today's already */
export function dailyDueFor(person: string, now: { day: string; min: number }, ctx: { rules: CrewRules; jobs: Record<string, DailyJob>; bookings: Booking[]; roleOf: (k: string) => string | undefined; sent: (jobId: string, md: string) => boolean }): PushMessage | null {
  const r = ctx.rules || {};
  if ((r.autoOff || []).includes("daily-update")) return null;
  const to = r.autoWho?.["daily-update"];
  if (to ? person !== to : ctx.roleOf(person) !== "site") return null;
  if (now.min < DAILY_AT || now.min - DAILY_AT > 120) return null;
  const left = workingJobs(now.day, ctx.jobs, ctx.bookings).filter((id) => !ctx.sent(id, mdOf(now.day)));
  if (!left.length) return null;
  const one = left.length === 1 ? ctx.jobs[left[0]] : undefined;
  return {
    title: `Due now · ${clock(DAILY_AT)}`,
    body: one ? `Send today’s daily update · ${one.name || "the job"}` : `Send today’s daily updates · ${left.length} projects`,
    tag: `du:${person}:${now.day}`,
    open: one ? { t: "daily", jobId: left[0], seen: `daily:${now.day}` } : { t: "dailies", who: person, jobs: left, seen: `daily:${now.day}` },
  };
}

/** the company's settings: the old whole copy, then each setting saved on its own on top (as the app reads them) */
async function rulesNow(): Promise<CrewRules> {
  const { data } = await db().from("tileos_records").select("id,data").eq("collection", "rules");
  const rows = (data || []) as { id: string; data: any }[];
  const all = rows.find((r) => r.id === "__all")?.data;
  const o: any = { ...(all && typeof all === "object" && !Array.isArray(all) ? all : {}) };
  for (const r of rows) {
    if (!String(r.id).startsWith("k:")) continue;
    const k = String(r.id).slice(2);
    if (r.data == null) delete o[k]; else o[k] = r.data;
  }
  return o;
}

/* ---------------- the every-minute check ---------------- */
async function records(collections: string[]): Promise<{ collection: string; id: string; data: any; updated_at: string }[]> {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await db().from("tileos_records").select("collection,id,data,updated_at").in("collection", collections).order("collection").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out.filter((r) => r.data && !Array.isArray(r.data) && !String(r.id).startsWith("__"));
}
/** the every-minute check ran just now (kept as one row) — a test notification says whether it's running */
const TICK = "tick";
export async function lastTick(): Promise<string | null> {
  const { data } = await db().from("tileos_push_sent").select("sent_at").eq("tag", TICK).maybeSingle();
  return (data?.sent_at as string) || null;
}
export async function remindNow(): Promise<{ ok: boolean; sent: number; due: number; devices: number; why?: string }> {
  await db().from("tileos_push_sent").upsert({ tag: TICK, sent_at: new Date().toISOString() }, { onConflict: "tag" }).then(() => undefined, () => undefined);
  const { data: devs, error } = await db().from("tileos_push").select("endpoint, p256dh, auth, user_id, person, tz");
  if (error) return { ok: false, sent: 0, due: 0, devices: 0, why: error.message };
  const devices = (devs || []) as Device[];
  if (!devices.length) return { ok: true, sent: 0, due: 0, devices: 0 };
  const rows = await records(["tasks", "events", "jobs", "notices", "team", "bookings"]);
  const jobs = new Map(rows.filter((r) => r.collection === "jobs").map((r) => [r.id, r.data?.name as string]));
  const jobName = (id?: string) => (id && jobs.get(id)) || "";
  /* a person's first name, the way the app says it ("Jacob reminded you") */
  const team = new Map(rows.filter((r) => r.collection === "team").map((r) => [String(r.data?.key || r.id), String(r.data?.first || r.data?.name || "").trim()]));
  const nameOf = (k: string) => team.get(k) || "";
  /* the crew list: the settings, the projects, who's the site manager */
  const rules = await rulesNow().catch(() => ({}) as CrewRules);
  const jobList = rows.filter((r) => r.collection === "jobs").map((r) => r.data as CrewJob);
  const roles = new Map(rows.filter((r) => r.collection === "team" && r.data?.status !== "off").map((r) => [String(r.data?.key || r.id), String(r.data?.role || "")]));
  const roleOf = (k: string) => roles.get(k);
  /* the daily updates: the jobs and their days on the schedule; a job's updates are read only when it's time */
  const jobMap = Object.fromEntries(rows.filter((r) => r.collection === "jobs").map((r) => [r.id, r.data as DailyJob]));
  const bookings = rows.filter((r) => r.collection === "bookings").map((r) => r.data as Booking);
  const diaryDays = new Map<string, Set<string>>();
  const loadDiary = async (ids: string[]) => {
    const need = ids.filter((id) => !diaryDays.has(id));
    if (!need.length) return;
    const { data } = await db().from("tileos_records").select("id,data").eq("collection", "diary").in("id", need);
    need.forEach((id) => diaryDays.set(id, new Set()));
    ((data || []) as { id: string; data: any }[]).forEach((r) => { if (Array.isArray(r.data)) diaryDays.set(r.id, new Set(r.data.map((e: { date?: string }) => String(e?.date || "")))); });
  };
  const nowMs = Date.now();
  const byPerson = new Map<string, Device[]>();
  devices.forEach((d) => byPerson.set(d.person, [...(byPerson.get(d.person) || []), d]));
  let sent = 0, due = 0;
  for (const [person, ds] of byPerson) {
    const tz = ds.find((d) => d.tz)?.tz || "America/New_York";
    const now = localAt(tz);
    const tasks = rows.filter((r) => r.collection === "tasks").map((r) => ({ data: r.data as Task, saved: localAt(tz, new Date(r.updated_at)).day }));
    const meetings = rows.filter((r) => r.collection === "events").map((r) => r.data as Meeting);
    const notices = rows.filter((r) => r.collection === "notices").map((r) => ({ data: r.data as Notice, saved: "", at: Date.parse(r.updated_at) }));
    const list = dueFor(person, tasks, meetings, jobName, now, { notices, nameOf, nowMs });
    const crew = crewDue(person, now, { rules, jobs: jobList, roleOf });
    if (crew) list.push(crew);
    /* (the updates are read only in the 5 PM window, and only the jobs being worked) */
    if (now.min >= DAILY_AT && now.min - DAILY_AT <= 120) {
      await loadDiary(workingJobs(now.day, jobMap, bookings)).catch(() => undefined);
      const daily = dailyDueFor(person, now, { rules, jobs: jobMap, bookings, roleOf, sent: (id, md) => !!diaryDays.get(id)?.has(md) });
      if (daily) list.push(daily);
    }
    if (!list.length) continue;
    const { data: done } = await db().from("tileos_push_sent").select("tag").in("tag", list.map((m) => m.tag));
    const already = new Set((done || []).map((x: { tag: string }) => x.tag));
    for (const m of list.filter((x) => !already.has(x.tag))) {
      due++;
      /* kept first: two checks at once never send it twice */
      const { error: e2 } = await db().from("tileos_push_sent").insert({ tag: m.tag });
      if (e2) continue;
      sent += await sendTo(ds, m);
    }
  }
  /* what was sent more than three days ago isn't needed to know anymore */
  await db().from("tileos_push_sent").delete().lt("sent_at", new Date(Date.now() - 3 * 864e5).toISOString());
  return { ok: true, sent, due, devices: devices.length };
}
