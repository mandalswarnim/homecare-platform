import { addDays, startOfDay } from "./format";
import { supabase } from "./supabase";
import type { ActivityItem, Clinician, PatientRecord, VisitFull } from "./types";
import { ACTIVITY_SELECT, VISIT_SELECT } from "./visits";

export const MAX_RANGE_DAYS = 90;

export type ConsoleData = {
  visits: VisitFull[];
  clinicians: Clinician[];
  patients: PatientRecord[];
  activity: ActivityItem[];
};

const PATIENT_SELECT = "*, profile:profiles(full_name, phone, created_at)";
const CLINICIAN_SELECT = "id, role, full_name, phone, specialty, created_at";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/**
 * Everything the overview, visit list and team pages need, in one round trip: visits from twice
 * the longest reporting range (so every range has a previous period to compare against) plus all
 * upcoming visits, anything still in progress, staff, patients and recent activity.
 */
export async function loadConsole(): Promise<ConsoleData> {
  const sb = supabase();
  const since = addDays(startOfDay(Date.now()), -(MAX_RANGE_DAYS * 2)).toISOString();
  const [visits, ongoing, clinicians, patients, activity] = await Promise.all([
    sb.from("visits").select(VISIT_SELECT).gte("scheduled_start", since).order("scheduled_start").limit(5000),
    sb.from("visits").select(VISIT_SELECT).eq("status", "in_progress"),
    sb.from("profiles").select(CLINICIAN_SELECT).in("role", ["doctor", "nurse"]).order("full_name"),
    sb.from("patients").select(PATIENT_SELECT),
    sb.from("activity_log").select(ACTIVITY_SELECT).order("created_at", { ascending: false }).limit(50),
  ]);

  const byId = new Map<string, VisitFull>();
  for (const v of [...check(visits), ...check(ongoing)] as unknown as VisitFull[]) byId.set(v.id, v);
  const patientList = (check(patients) as unknown as PatientRecord[]).sort((a, b) =>
    (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""),
  );

  return {
    visits: Array.from(byId.values()).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)),
    clinicians: check(clinicians) as unknown as Clinician[],
    patients: patientList,
    activity: check(activity) as unknown as ActivityItem[],
  };
}

export type VisitDetailData = { visit: VisitFull | null; activity: ActivityItem[] };

export async function loadVisit(id: string): Promise<VisitDetailData> {
  const sb = supabase();
  const [visit, activity] = await Promise.all([
    sb.from("visits").select(VISIT_SELECT).eq("id", id).maybeSingle(),
    sb.from("activity_log").select(ACTIVITY_SELECT).eq("visit_id", id).order("created_at"),
  ]);
  if (visit.error) throw new Error(visit.error.message);
  return { visit: (visit.data as unknown as VisitFull | null) ?? null, activity: check(activity) as unknown as ActivityItem[] };
}

export type PatientDetailData = { patient: PatientRecord | null; visits: VisitFull[] };

export async function loadPatient(id: string): Promise<PatientDetailData> {
  const sb = supabase();
  const [patient, visits] = await Promise.all([
    sb.from("patients").select(PATIENT_SELECT).eq("id", id).maybeSingle(),
    sb.from("visits").select(VISIT_SELECT).eq("patient_id", id).order("scheduled_start", { ascending: false }).limit(500),
  ]);
  if (patient.error) throw new Error(patient.error.message);
  return {
    patient: (patient.data as unknown as PatientRecord | null) ?? null,
    visits: check(visits) as unknown as VisitFull[],
  };
}

export async function assignVisit(visitId: string, clinicianId: string) {
  const { error } = await supabase().rpc("assign_visit", { p_visit_id: visitId, p_clinician_id: clinicianId });
  if (error) throw new Error(error.message);
}

export async function cancelVisit(visitId: string, reason: string | null) {
  const { error } = await supabase().rpc("cancel_visit", { p_visit_id: visitId, p_reason: reason });
  if (error) throw new Error(error.message);
}
