export type Role = "patient" | "doctor" | "nurse" | "admin";
export type VisitStatus = "requested" | "accepted" | "declined" | "cancelled" | "in_progress" | "completed";
export type EventKind = "clock_in" | "clock_out";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  specialty: string | null;
};

export type Clinician = Profile & { role: "doctor" | "nurse"; created_at: string };

export type Patient = {
  id: string;
  address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_accuracy_m: number | null;
  home_set_at: string | null;
  geofence_radius_m: number;
};

export type PatientRecord = Patient & {
  date_of_birth: string | null;
  emergency_contact: string | null;
  notes: string | null;
  profile: { full_name: string; phone: string | null; created_at: string } | null;
};

export type VisitReport = {
  visit_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  temperature_c: number | null;
  spo2_pct: number | null;
  glucose_mmol: number | null;
  notes: string | null;
  created_at: string;
};

export type VisitEvent = {
  id: string;
  visit_id: string;
  clinician_id: string;
  kind: EventKind;
  occurred_at: string;
  device_time: string | null;
  received_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  is_mocked: boolean | null;
  flags: string[];
  verified: boolean;
  was_offline: boolean;
  note: string | null;
  platform: string | null;
  /** the home pin and radius this fix was checked against (null on events recorded before this was kept) */
  home_lat: number | null;
  home_lng: number | null;
  geofence_radius_m: number | null;
};

export type Visit = {
  id: string;
  patient_id: string;
  clinician_id: string | null;
  service_type: string;
  scheduled_start: string;
  duration_minutes: number;
  reason: string | null;
  status: VisitStatus;
  decline_reason: string | null;
  accepted_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitFull = Visit & {
  patient: (Patient & { profile: { full_name: string; phone: string | null } | null }) | null;
  clinician: Pick<Profile, "id" | "full_name" | "role" | "specialty" | "phone"> | null;
  report: VisitReport | VisitReport[] | null;
  events: VisitEvent[] | null;
};

export type ActivityItem = {
  id: number;
  visit_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string; role: Role } | null;
  visit: {
    id: string;
    service_type: string;
    patient: { profile: { full_name: string } | null } | null;
  } | null;
};
