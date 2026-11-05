import type { VisitDetail, VisitReport } from './types';

export const PATIENT_VISIT_SELECT =
  '*, clinician:profiles!visits_clinician_id_fkey(id, full_name, role, specialty, phone), report:visit_reports(*)';

export const CLINICIAN_VISIT_SELECT =
  '*, patient:patients(id, address, home_lat, home_lng, home_accuracy_m, home_set_at, geofence_radius_m, profile:profiles(full_name, phone)), report:visit_reports(*), events:visit_events(*)';

/** PostgREST returns one-to-one embeds as an object, but be tolerant of arrays. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const reportOf = (visit: VisitDetail): VisitReport | null => one(visit.report);

export const isOpenRequest = (visit: VisitDetail) => visit.status === 'requested' && visit.clinician_id === null;

export const UPCOMING: VisitDetail['status'][] = ['requested', 'accepted', 'declined', 'in_progress'];
