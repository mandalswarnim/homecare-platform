import type { VisitEvent, VisitFull, VisitReport, VisitStatus } from "./types";

/** How each visit status reads in the console. Status is shown with an icon + label, never colour alone. */
export const STATUS_LABEL: Record<VisitStatus, string> = {
  requested: "Requested",
  accepted: "Confirmed",
  in_progress: "On visit",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const STATUS_ORDER: VisitStatus[] = ["in_progress", "requested", "declined", "accepted", "completed", "cancelled"];

const FLAG_TEXT: Record<string, string> = {
  outside_area: "Outside the patient's home area",
  weak_gps: "Weak GPS signal",
  mock_location: "Fake-GPS app detected",
  no_home_pin: "Patient's home isn't pinned",
  no_gps: "No GPS reading",
  clock_mismatch: "Phone clock didn't match the server",
};

const FLAG_SHORT: Record<string, string> = {
  outside_area: "Outside home area",
  weak_gps: "Weak GPS",
  mock_location: "Fake GPS",
  no_home_pin: "Home not pinned",
  no_gps: "No GPS",
  clock_mismatch: "Clock mismatch",
};

export const flagText = (flag: string) => FLAG_TEXT[flag] ?? flag.replace(/_/g, " ");
export const flagShort = (flag: string) => FLAG_SHORT[flag] ?? flag.replace(/_/g, " ");

export const VISIT_SELECT = [
  "*",
  "patient:patients(id, address, home_lat, home_lng, home_accuracy_m, home_set_at, geofence_radius_m, profile:profiles(full_name, phone))",
  "clinician:profiles!visits_clinician_id_fkey(id, full_name, role, specialty, phone)",
  "report:visit_reports(*)",
  "events:visit_events(*)",
].join(", ");

export const ACTIVITY_SELECT =
  "*, actor:profiles(full_name, role), visit:visits(id, service_type, patient:patients(profile:profiles(full_name)))";

/** PostgREST returns one-to-one embeds as an object, but be tolerant of arrays. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const reportOf = (v: VisitFull): VisitReport | null => one(v.report);
export const eventOf = (v: VisitFull, kind: VisitEvent["kind"]) => (v.events ?? []).find((e) => e.kind === kind) ?? null;
export const patientName = (v: VisitFull) => v.patient?.profile?.full_name ?? "Unknown patient";
export const clinicianName = (v: VisitFull) => v.clinician?.full_name ?? null;

export type Verification = "verified" | "flagged" | "pending" | "none";

/** A visit is verified when every clock event it has was inside the home area with good GPS. */
export function verificationOf(v: VisitFull): Verification {
  const events = v.events ?? [];
  if (events.length === 0) return v.status === "completed" || v.status === "in_progress" ? "pending" : "none";
  if (events.some((e) => !e.verified)) return "flagged";
  if (v.status === "completed" && events.length < 2) return "pending";
  return "verified";
}

export const visitFlags = (v: VisitFull) => Array.from(new Set((v.events ?? []).flatMap((e) => e.flags)));

/** The moment a visit "happened" for reporting: when it started, else when it was scheduled. */
export const visitTime = (v: VisitFull) => v.started_at ?? v.scheduled_start;

export const actualMs = (v: VisitFull) =>
  v.started_at && v.ended_at ? Math.max(0, new Date(v.ended_at).getTime() - new Date(v.started_at).getTime()) : 0;

/** Minutes late (positive) or early (negative) against the scheduled start. */
export const lateMinutes = (v: VisitFull) =>
  v.started_at ? Math.round((new Date(v.started_at).getTime() - new Date(v.scheduled_start).getTime()) / 60_000) : null;

export const ON_TIME_GRACE_MIN = 15;

export function sortVisits(visits: VisitFull[], dir: "asc" | "desc" = "asc") {
  const sign = dir === "asc" ? 1 : -1;
  return visits.slice().sort((a, b) => sign * a.scheduled_start.localeCompare(b.scheduled_start));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
