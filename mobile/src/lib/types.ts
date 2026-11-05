export type Role = 'patient' | 'doctor' | 'nurse' | 'admin';
export type VisitStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'in_progress' | 'completed';
export type EventKind = 'clock_in' | 'clock_out';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  specialty: string | null;
};

export type Patient = {
  id: string;
  address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_accuracy_m: number | null;
  home_set_at: string | null;
  geofence_radius_m: number;
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
  kind: EventKind;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  is_mocked: boolean | null;
  flags: string[];
  verified: boolean;
  was_offline: boolean;
  note: string | null;
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
};

export type ClinicianSummary = Pick<Profile, 'id' | 'full_name' | 'role' | 'specialty' | 'phone'>;
export type PatientWithProfile = Patient & { profile: Pick<Profile, 'full_name' | 'phone'> | null };

export type VisitDetail = Visit & {
  clinician?: ClinicianSummary | null;
  patient?: PatientWithProfile | null;
  report?: VisitReport | VisitReport[] | null;
  events?: VisitEvent[];
};

/** Raw text from the vitals form; converted to numbers on the server. */
export type ReportInput = {
  bp_systolic: string;
  bp_diastolic: string;
  pulse_bpm: string;
  temperature_c: string;
  spo2_pct: string;
  glucose_mmol: string;
  notes: string;
};
