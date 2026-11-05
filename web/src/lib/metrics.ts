import { addDays, dayKey, MS, startOfDay } from "./format";
import type { Clinician, VisitFull } from "./types";
import { actualMs, lateMinutes, ON_TIME_GRACE_MIN, verificationOf, visitTime } from "./visits";

export type RangeKey = "7d" | "30d" | "90d";

export const RANGES: { key: RangeKey; label: string; short: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", short: "7 days", days: 7 },
  { key: "30d", label: "Last 30 days", short: "30 days", days: 30 },
  { key: "90d", label: "Last 90 days", short: "90 days", days: 90 },
];

export const rangeOf = (key: string | null | undefined) => RANGES.find((r) => r.key === key) ?? RANGES[0];

export type Period = { start: number; end: number; prevStart: number; days: Date[] };

/** The last `n` calendar days including today, and the `n` days before that for comparison. */
export function periodOf(n: number, now: number): Period {
  const first = addDays(startOfDay(now), -(n - 1));
  const days = Array.from({ length: n }, (_, i) => addDays(first, i));
  return { start: first.getTime(), end: addDays(startOfDay(now), 1).getTime(), prevStart: addDays(first, -n).getTime(), days };
}

const within = (v: VisitFull, from: number, to: number) => {
  const t = new Date(visitTime(v)).getTime();
  return t >= from && t < to;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type Summary = {
  completed: number;
  careMs: number;
  verified: number;
  needsReview: number;
  verifiedRate: number | null;
  onTimeRate: number | null;
  medianAcceptMin: number | null;
  declined: number;
  cancelled: number;
  patientsServed: number;
};

export function summarize(visits: VisitFull[], from: number, to: number): Summary {
  const inRange = visits.filter((v) => within(v, from, to));
  const completed = inRange.filter((v) => v.status === "completed");
  const verified = completed.filter((v) => verificationOf(v) === "verified").length;
  const started = completed.filter((v) => v.started_at);
  const onTime = started.filter((v) => (lateMinutes(v) ?? 0) <= ON_TIME_GRACE_MIN).length;
  const acceptMins = inRange
    .filter((v) => v.accepted_at)
    .map((v) => (new Date(v.accepted_at!).getTime() - new Date(v.created_at).getTime()) / MS.MIN)
    .filter((m) => m >= 0);

  return {
    completed: completed.length,
    careMs: completed.reduce((sum, v) => sum + actualMs(v), 0),
    verified,
    needsReview: completed.length - verified,
    verifiedRate: completed.length ? verified / completed.length : null,
    onTimeRate: started.length ? onTime / started.length : null,
    medianAcceptMin: median(acceptMins),
    declined: inRange.filter((v) => v.status === "declined").length,
    cancelled: inRange.filter((v) => v.status === "cancelled").length,
    patientsServed: new Set(completed.map((v) => v.patient_id)).size,
  };
}

export type DayPoint = { date: Date; key: string; verified: number; review: number; careMs: number };

export function dailySeries(visits: VisitFull[], days: Date[]): DayPoint[] {
  const points = new Map<string, DayPoint>(days.map((d) => [dayKey(d), { date: d, key: dayKey(d), verified: 0, review: 0, careMs: 0 }]));
  for (const v of visits) {
    if (v.status !== "completed") continue;
    const p = points.get(dayKey(visitTime(v)));
    if (!p) continue;
    if (verificationOf(v) === "verified") p.verified += 1;
    else p.review += 1;
    p.careMs += actualMs(v);
  }
  return Array.from(points.values());
}

export type Ranked = { key: string; label: string; value: number; detail?: string };

export function byService(visits: VisitFull[], from: number, to: number): Ranked[] {
  const counts = new Map<string, number>();
  for (const v of visits) {
    if (v.status !== "completed" || !within(v, from, to)) continue;
    counts.set(v.service_type, (counts.get(v.service_type) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export type ClinicianStats = {
  clinician: Clinician;
  completed: number;
  careMs: number;
  verifiedRate: number | null;
  onTimeRate: number | null;
  medianAcceptMin: number | null;
  declined: number;
  current: VisitFull | null;
  next: VisitFull | null;
};

export function clinicianStats(clinicians: Clinician[], visits: VisitFull[], from: number, to: number, now: number): ClinicianStats[] {
  return clinicians.map((c) => {
    const mine = visits.filter((v) => v.clinician_id === c.id);
    const s = summarize(mine, from, to);
    const declined = mine.filter((v) => v.status === "declined" && within(v, from, to)).length;
    const current = mine.find((v) => v.status === "in_progress") ?? null;
    const next =
      mine
        .filter((v) => (v.status === "accepted" || v.status === "requested") && new Date(v.scheduled_start).getTime() >= now - 2 * MS.HOUR)
        .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0] ?? null;
    return {
      clinician: c,
      completed: s.completed,
      careMs: s.careMs,
      verifiedRate: s.verifiedRate,
      onTimeRate: s.onTimeRate,
      medianAcceptMin: s.medianAcceptMin,
      declined,
      current,
      next,
    };
  });
}

/** Signed change and whether it's an improvement, for stat tile deltas. */
export function delta(current: number, previous: number) {
  return { value: current - previous, previous };
}
