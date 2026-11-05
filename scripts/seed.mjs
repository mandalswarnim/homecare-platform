// Seeds the demo project: an admin, 4 clinicians, 6 patients and ~2 weeks of realistic visits.
// Re-running it wipes and recreates every @example.com account (and their visits).
//
//   npm run seed                              # patients around the default city centre
//   SEED_CENTER=6.5244,3.3792 npm run seed    # or around any "lat,lng"
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD in the root .env file.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DEMO_PASSWORD in .env');
  process.exit(1);
}
const [CENTER_LAT, CENTER_LNG] = (process.env.SEED_CENTER || '5.6037,-0.1870').split(',').map(Number);
const DOMAIN = 'example.com';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── deterministic randomness so every seed looks the same ──
let state = 20261109;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.round(between(a, b));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function offsetMeters(lat, lng, north, east) {
  return [lat + north / 111320, lng + east / (111320 * Math.cos((lat * Math.PI) / 180))];
}
function distanceM(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

// ── people ──
const STAFF = [
  { key: 'admin', role: 'admin', email: `admin@${DOMAIN}`, full_name: 'Office Admin', phone: '070 000 0100' },
  { key: 'amara', role: 'doctor', email: `dr.amara@${DOMAIN}`, full_name: 'Dr. Amara Okafor', specialty: 'General practitioner', phone: '070 000 0101' },
  { key: 'kwame', role: 'doctor', email: `dr.kwame@${DOMAIN}`, full_name: 'Dr. Kwame Mensah', specialty: 'Family physician', phone: '070 000 0102' },
  { key: 'grace', role: 'nurse', email: `nurse.grace@${DOMAIN}`, full_name: 'Grace Wanjiru', specialty: 'Registered nurse', phone: '070 000 0103' },
  { key: 'fatou', role: 'nurse', email: `nurse.fatou@${DOMAIN}`, full_name: 'Fatou Diallo', specialty: 'Registered nurse', phone: '070 000 0104' },
];
const PATIENTS = [
  { key: 'adaeze', email: `adaeze@${DOMAIN}`, full_name: 'Adaeze Nwosu', address: '14 Palm Avenue', north: 1400, east: 900, dob: '1946-03-12' },
  { key: 'joseph', email: `joseph@${DOMAIN}`, full_name: 'Joseph Boateng', address: '7 Ring Road East', north: -2000, east: 1700, dob: '1951-08-30' },
  { key: 'esther', email: `esther@${DOMAIN}`, full_name: 'Esther Achieng', address: '22 Garden Close', north: 2800, east: -2200, dob: '1939-11-02' },
  { key: 'samuel', email: `samuel@${DOMAIN}`, full_name: 'Samuel Mwangi', address: '3 Hospital Road', north: -700, east: -3100, dob: '1958-01-19' },
  { key: 'mariam', email: `mariam@${DOMAIN}`, full_name: 'Mariam Sow', address: '9 Lagoon View', north: 3400, east: 2500, dob: '1944-06-25' },
  { key: 'peter', email: `peter@${DOMAIN}`, full_name: 'Peter Ochieng', address: '41 Market Street', north: -3300, east: -600, dob: '1949-09-07' },
];

const DOCTOR_SERVICES = ['Doctor home visit', 'Medication review', 'Vitals check'];
const NURSE_SERVICES = ['Nursing care', 'Wound dressing', 'Injection / IV therapy', 'Vitals check'];
const NOTES = [
  'Patient comfortable. Medication taken as prescribed.',
  'Dressing changed, wound healing well. Review in 3 days.',
  'BP slightly elevated, advised to reduce salt. Recheck next visit.',
  'Family present. Discussed mobility exercises.',
  'Mild cough, no fever. Fluids encouraged.',
  'Insulin administered. Glucose within target.',
  'Patient in good spirits, eating well.',
];

async function deleteDemoUsers() {
  const ids = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email?.endsWith(`@${DOMAIN}`)) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  return ids.length;
}

async function createUser(person, role) {
  const { data, error } = await db.auth.admin.createUser({
    email: person.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    app_metadata: role === 'patient' ? {} : { role },
    user_metadata: {
      full_name: person.full_name,
      phone: person.phone ?? `070 000 0${int(200, 999)}`,
      specialty: person.specialty,
      address: person.address,
    },
  });
  if (error) throw new Error(`${person.email}: ${error.message}`);
  return data.user.id;
}

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 200));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  const removed = await deleteDemoUsers();
  console.log(`Removed ${removed} existing demo accounts`);

  const id = {};
  for (const s of STAFF) id[s.key] = await createUser(s, s.role);
  for (const p of PATIENTS) id[p.key] = await createUser(p, 'patient');

  // accounts look like they joined before the visit history starts
  const DAY_MS = 24 * 3600 * 1000;
  for (const [i, person] of [...STAFF, ...PATIENTS].entries()) {
    const joined = new Date(Date.now() - (75 - i * 3) * DAY_MS).toISOString();
    const { error } = await db.from('profiles').update({ created_at: joined }).eq('id', id[person.key]);
    if (error) throw error;
  }

  const home = {};
  for (const p of PATIENTS) {
    const [lat, lng] = offsetMeters(CENTER_LAT, CENTER_LNG, p.north, p.east);
    home[p.key] = { lat, lng };
    const { error } = await db
      .from('patients')
      .update({
        home_lat: lat,
        home_lng: lng,
        home_accuracy_m: 8,
        home_set_at: new Date(Date.now() - int(30, 40) * 24 * 3600 * 1000).toISOString(),
        date_of_birth: p.dob,
        emergency_contact: `Family contact · 070 000 0${int(300, 999)}`,
      })
      .eq('id', id[p.key]);
    if (error) throw error;
  }
  console.log(`Created ${STAFF.length} staff and ${PATIENTS.length} patients around ${CENTER_LAT}, ${CENTER_LNG}`);

  const visits = [];
  const events = [];
  const reports = [];
  const activity = [];
  const now = Date.now();
  const doctors = ['amara', 'kwame'];
  const nurses = ['grace', 'fatou'];

  function addVisit({ patient, clinician, start, status, service, duration = 60, outcome = {} }) {
    const visitId = randomUUID();
    const isNurse = clinician ? nurses.includes(clinician) : rand() < 0.5;
    const serviceType = service ?? pick(isNurse ? NURSE_SERVICES : DOCTOR_SERVICES);
    const createdAt = start - between(20, 72) * HOUR;
    const v = {
      id: visitId,
      patient_id: id[patient],
      clinician_id: clinician ? id[clinician] : null,
      service_type: serviceType,
      scheduled_start: iso(start),
      duration_minutes: duration,
      reason: rand() < 0.6 ? pick(['Routine check', 'Follow-up after discharge', 'Weekly care plan', 'Feeling unwell since yesterday', 'Dressing change due']) : null,
      status,
      created_by: id[patient],
      created_at: iso(createdAt),
      updated_at: iso(createdAt),
    };
    activity.push({ visit_id: visitId, actor_id: id[patient], action: 'requested', created_at: iso(createdAt), details: { service_type: serviceType, scheduled_start: iso(start) } });

    const accepted = ['accepted', 'in_progress', 'completed'].includes(status);
    if (accepted) {
      const acceptedAt = createdAt + between(5, 90) * MIN;
      v.accepted_at = iso(acceptedAt);
      activity.push({ visit_id: visitId, actor_id: id[clinician], action: 'accepted', created_at: iso(acceptedAt), details: {} });
    }
    if (status === 'declined') {
      v.decline_reason = outcome.declineReason ?? 'Already booked at that time';
      activity.push({ visit_id: visitId, actor_id: id[clinician], action: 'declined', created_at: iso(createdAt + 40 * MIN), details: { reason: v.decline_reason } });
    }
    if (status === 'cancelled') {
      v.cancelled_at = iso(createdAt + 3 * HOUR);
      activity.push({ visit_id: visitId, actor_id: id[patient], action: 'cancelled', created_at: v.cancelled_at, details: { reason: 'Family will be away' } });
    }

    if (status === 'in_progress' || status === 'completed') {
      // most arrivals within a few minutes of the booking, the odd late one
      const startedAt = outcome.startedAt ?? start + (rand() < 0.85 ? between(-8, 12) : between(18, 40)) * MIN;
      v.started_at = iso(startedAt);
      events.push(makeEvent(visitId, clinician, patient, 'clock_in', startedAt, outcome));
      if (status === 'completed') {
        const endedAt = startedAt + (duration + between(-15, 20)) * MIN;
        v.ended_at = iso(endedAt);
        events.push(makeEvent(visitId, clinician, patient, 'clock_out', endedAt, {}));
        reports.push(makeReport(visitId, clinician, serviceType, endedAt));
      }
    }
    for (const e of events.filter((x) => x.visit_id === visitId && !x._logged)) {
      e._logged = true;
      activity.push({
        visit_id: visitId,
        actor_id: id[clinician],
        action: e.kind,
        created_at: e.received_at,
        details: { verified: e.verified, flags: e.flags, distance_m: Math.round(e.distance_m), accuracy_m: Math.round(e.accuracy_m), was_offline: e.was_offline },
      });
    }
    visits.push(v);
  }

  function makeEvent(visitId, clinician, patient, kind, at, outcome) {
    const h = home[patient];
    const far = outcome.flag === 'outside_area';
    const dist = far ? between(450, 900) : between(4, 55);
    const bearing = between(0, 2 * Math.PI);
    const [lat, lng] = offsetMeters(h.lat, h.lng, dist * Math.cos(bearing), dist * Math.sin(bearing));
    const accuracy = outcome.flag === 'weak_gps' ? between(120, 190) : between(5, 28);
    const offline = outcome.flag === 'offline';
    const flags = [];
    const d = distanceM(h.lat, h.lng, lat, lng);
    if (d > 150 + Math.min(accuracy, 50)) flags.push('outside_area');
    if (accuracy > 100) flags.push('weak_gps');
    return {
      id: randomUUID(),
      visit_id: visitId,
      clinician_id: id[clinician],
      kind,
      occurred_at: iso(at),
      device_time: iso(at),
      received_at: iso(offline ? at + between(25, 70) * MIN : at + between(1, 4) * 1000),
      lat,
      lng,
      accuracy_m: accuracy,
      is_mocked: false,
      distance_m: d,
      flags,
      verified: flags.length === 0,
      note: flags.includes('outside_area') && kind === 'clock_in' ? 'Patient was at a neighbour\'s house' : null,
      was_offline: offline,
      platform: pick(['android', 'android', 'ios']),
      // the pin and radius this fix was checked against (kept even if the patient re-pins later)
      home_lat: h.lat,
      home_lng: h.lng,
      geofence_radius_m: 150,
    };
  }

  function makeReport(visitId, clinician, serviceType, at) {
    return {
      visit_id: visitId,
      bp_systolic: int(112, 152),
      bp_diastolic: int(68, 96),
      pulse_bpm: int(60, 96),
      temperature_c: Math.round(between(36.2, 37.7) * 10) / 10,
      spo2_pct: int(93, 99),
      glucose_mmol: serviceType.includes('Injection') || rand() < 0.3 ? Math.round(between(4.6, 9.4) * 10) / 10 : null,
      notes: pick(NOTES),
      created_by: id[clinician],
      created_at: iso(at),
    };
  }

  function dayAt(daysAgo, hour, minute = 0) {
    const d = new Date(now - daysAgo * 24 * HOUR);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  }

  // History: 12 days of completed visits, with a few realistic problems mixed in.
  const flagPlan = { 2: 'outside_area', 5: 'weak_gps', 8: 'offline', 13: 'outside_area', 19: 'offline', 24: 'weak_gps' };
  let n = 0;
  for (let daysAgo = 12; daysAgo >= 1; daysAgo--) {
    const count = int(2, 4);
    for (let i = 0; i < count; i++) {
      const clinician = pick([...doctors, ...nurses]);
      addVisit({
        patient: pick(PATIENTS).key,
        clinician,
        start: dayAt(daysAgo, pick([8, 9, 10, 11, 13, 14, 15, 16]), pick([0, 30])),
        status: 'completed',
        duration: pick([45, 60, 60, 90]),
        outcome: { flag: flagPlan[n] },
      });
      n++;
    }
  }

  // Today and the next few days, relative to the moment you seed.
  const t = (hours) => now + hours * HOUR;
  addVisit({ patient: 'adaeze', clinician: 'grace', start: t(-6), status: 'completed', service: 'Nursing care' });
  addVisit({ patient: 'samuel', clinician: 'kwame', start: t(-3.5), status: 'completed', service: 'Doctor home visit', outcome: { flag: 'outside_area' } });
  addVisit({ patient: 'joseph', clinician: 'fatou', start: t(-0.7), status: 'in_progress', service: 'Wound dressing', outcome: { startedAt: t(-0.6) } });
  addVisit({ patient: 'esther', clinician: 'amara', start: t(2), status: 'accepted', service: 'Doctor home visit' });
  addVisit({ patient: 'mariam', clinician: 'grace', start: t(4), status: 'accepted', service: 'Injection / IV therapy' });
  addVisit({ patient: 'peter', clinician: 'amara', start: t(22), status: 'requested', service: 'Medication review' });
  addVisit({ patient: 'adaeze', clinician: null, start: t(5), status: 'requested', service: 'Vitals check' });
  addVisit({ patient: 'samuel', clinician: 'kwame', start: t(27), status: 'declined', service: 'Doctor home visit', outcome: { declineReason: 'Away at a conference that day' } });
  addVisit({ patient: 'joseph', clinician: 'amara', start: t(26), status: 'accepted', service: 'Doctor home visit' });
  addVisit({ patient: 'esther', clinician: 'fatou', start: t(30), status: 'accepted', service: 'Nursing care' });
  addVisit({ patient: 'peter', clinician: 'grace', start: t(-28), status: 'cancelled', service: 'Nursing care' });

  await insert('visits', visits);
  await insert('visit_events', events.map(({ _logged, ...e }) => e));
  await insert('visit_reports', reports);
  await insert('activity_log', activity.sort((a, b) => a.created_at.localeCompare(b.created_at)));

  console.log(`Seeded ${visits.length} visits, ${events.length} clock events, ${reports.length} visit reports`);
  console.log('\nDemo logins (password = DEMO_PASSWORD from .env):');
  for (const s of STAFF) console.log(`  ${s.role.padEnd(7)} ${s.email}`);
  console.log(`  patient ${PATIENTS[0].email}  (and ${PATIENTS.length - 1} more @${DOMAIN})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
