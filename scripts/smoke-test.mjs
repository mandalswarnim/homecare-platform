// End-to-end check of the live backend: sign-up, booking, accept, clock in/out, verification
// flags, idempotent retries and the security rules. Creates a throwaway patient and deletes it.
//
//   npm run smoke      (needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD)
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY or DEMO_PASSWORD in .env');
  process.exit(1);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const patient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const doctor = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const otherPatient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  →  ${detail}`}`);
  if (!ok) failures++;
}
const HOME = { lat: 5.6037, lng: -0.187 };
const nearby = (m) => ({ lat: HOME.lat + m / 111320, lng: HOME.lng });

let patientId;
try {
  // 1. Patient self-signup
  const email = `smoke-${Date.now()}@example.com`;
  const { data: su, error: suErr } = await patient.auth.signUp({
    email,
    password: DEMO_PASSWORD,
    options: { data: { full_name: 'Smoke Test Patient', phone: '070 000 9999', role: 'admin' } },
  });
  patientId = su?.user?.id;
  check('patient signs up and gets a session straight away', !suErr && !!su?.session, suErr?.message ?? 'no session — turn off "Confirm email"');
  if (!su?.session) throw new Error('cannot continue without a session');

  const { data: me } = await patient.from('profiles').select('role, full_name').eq('id', patientId).single();
  check('self-signup is always a patient (role in user metadata ignored)', me?.role === 'patient', JSON.stringify(me));

  // 2. Security rules
  const { error: escalate } = await patient.from('profiles').update({ role: 'admin' }).eq('id', patientId);
  check('patient cannot change their own role', !!escalate, 'update succeeded!');
  const { error: directInsert } = await patient.from('visits').insert({ patient_id: patientId, service_type: 'x', scheduled_start: new Date().toISOString() });
  check('patient cannot write visits directly', !!directInsert, 'insert succeeded!');
  const { data: anonVisits } = await anon.from('visits').select('id').limit(1);
  check('signed-out users see no visits', !anonVisits || anonVisits.length === 0, JSON.stringify(anonVisits));
  const { data: log } = await patient.from('activity_log').select('id').limit(1);
  check('patients cannot read the activity log', (log ?? []).length === 0);

  const { error: homeErr } = await patient.rpc('set_home_location', { p_lat: HOME.lat, p_lng: HOME.lng, p_accuracy_m: 10, p_address: '1 Smoke Street' });
  check('patient sets home location', !homeErr, homeErr?.message);

  // 3. Booking → accept
  const { error: drErr } = await doctor.auth.signInWithPassword({ email: 'dr.amara@example.com', password: DEMO_PASSWORD });
  check('doctor signs in', !drErr, drErr?.message);
  const { data: drProfile } = await doctor.from('profiles').select('id, role').eq('role', 'doctor').limit(5);
  const doctorId = (await doctor.auth.getUser()).data.user?.id;
  check('patient-visible clinician directory exists', (drProfile ?? []).length > 0);

  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: visit, error: reqErr } = await patient.rpc('request_visit', {
    p_service_type: 'Doctor home visit',
    p_scheduled_start: start,
    p_clinician_id: doctorId,
    p_reason: 'Smoke test',
  });
  check('patient books a visit with a specific doctor', !reqErr && visit?.status === 'requested', reqErr?.message);

  const { data: inbox } = await doctor.from('visits').select('id, status').eq('id', visit.id);
  check('doctor sees the new request', inbox?.length === 1);
  const { data: hidden } = await (async () => {
    await otherPatient.auth.signInWithPassword({ email: 'adaeze@example.com', password: DEMO_PASSWORD });
    return otherPatient.from('visits').select('id').eq('id', visit.id);
  })();
  check('another patient cannot see it', (hidden ?? []).length === 0);

  const { data: accepted, error: accErr } = await doctor.rpc('respond_to_visit', { p_visit_id: visit.id, p_accept: true });
  check('doctor accepts', !accErr && accepted?.status === 'accepted', accErr?.message);

  // 4. Clock in at the home (verified), retry is idempotent
  const inId = randomUUID();
  const here = nearby(30);
  const clockIn = {
    p_event_id: inId, p_visit_id: visit.id, p_kind: 'clock_in', p_occurred_at: new Date().toISOString(),
    p_lat: here.lat, p_lng: here.lng, p_accuracy_m: 12, p_is_mocked: false, p_platform: 'smoke',
  };
  const { data: ev1, error: inErr } = await doctor.rpc('record_visit_event', clockIn);
  check('clock-in 30 m from home is verified', !inErr && ev1?.verified === true && ev1?.flags?.length === 0, inErr?.message ?? JSON.stringify(ev1));
  const { data: ev1again, error: retryErr } = await doctor.rpc('record_visit_event', clockIn);
  check('retrying the same clock-in returns the stored event', !retryErr && ev1again?.id === inId, retryErr?.message);
  const { data: dupe, error: dupeErr } = await doctor.rpc('record_visit_event', { ...clockIn, p_event_id: randomUUID() });
  check('a double tap does not create a second clock-in', !dupeErr && dupe?.id === inId, dupeErr?.message);

  // 5. Clock out with a report (one bad value must not lose the clock-out)
  const { data: ev2, error: outErr } = await doctor.rpc('record_visit_event', {
    p_event_id: randomUUID(), p_visit_id: visit.id, p_kind: 'clock_out', p_occurred_at: new Date().toISOString(),
    p_lat: here.lat, p_lng: here.lng, p_accuracy_m: 10, p_is_mocked: false, p_platform: 'smoke',
    p_report: { bp_systolic: 128, bp_diastolic: 82, pulse_bpm: 74, temperature_c: 36.8, spo2_pct: 97, notes: 'All good' },
  });
  check('clock-out recorded', !outErr && ev2?.kind === 'clock_out', outErr?.message);
  const { data: done } = await patient.from('visits').select('status, started_at, ended_at, report:visit_reports(bp_systolic, notes)').eq('id', visit.id).single();
  const report = Array.isArray(done?.report) ? done.report[0] : done?.report;
  check('patient sees completed visit with arrival/departure times', done?.status === 'completed' && !!done?.started_at && !!done?.ended_at, JSON.stringify(done));
  check('patient sees the visit report', report?.bp_systolic === 128, JSON.stringify(report));
  const { data: rawEvents } = await patient.from('visit_events').select('id').eq('visit_id', visit.id);
  check('patient cannot read raw GPS events', (rawEvents ?? []).length === 0);

  // 6. Flags: far away + fake GPS, and a bad vitals value
  const { data: v2 } = await patient.rpc('request_visit', { p_service_type: 'Vitals check', p_scheduled_start: start, p_clinician_id: null });
  const { data: openSeen } = await doctor.from('visits').select('id').eq('id', v2.id);
  check('open request is visible to clinicians', openSeen?.length === 1);
  const { error: declineOpen } = await doctor.rpc('respond_to_visit', { p_visit_id: v2.id, p_accept: false });
  check('open requests cannot be declined', !!declineOpen);
  await doctor.rpc('respond_to_visit', { p_visit_id: v2.id, p_accept: true });
  const far = nearby(2400);
  const { data: ev3 } = await doctor.rpc('record_visit_event', {
    p_event_id: randomUUID(), p_visit_id: v2.id, p_kind: 'clock_in', p_occurred_at: new Date().toISOString(),
    p_lat: far.lat, p_lng: far.lng, p_accuracy_m: 15, p_is_mocked: true, p_note: 'Testing flags',
  });
  check('clock-in 2.4 km away is flagged outside_area + mock_location',
    ev3?.verified === false && ev3?.flags?.includes('outside_area') && ev3?.flags?.includes('mock_location'),
    JSON.stringify(ev3?.flags));
  const { data: ev4, error: badVitalsErr } = await doctor.rpc('record_visit_event', {
    p_event_id: randomUUID(), p_visit_id: v2.id, p_kind: 'clock_out', p_occurred_at: new Date().toISOString(),
    p_lat: far.lat, p_lng: far.lng, p_accuracy_m: 15, p_report: { pulse_bpm: 999 },
  });
  check('impossible vitals value does not block the clock-out', !badVitalsErr && ev4?.kind === 'clock_out', badVitalsErr?.message);

  // 6. Office console
  const { error: adErr } = await admin.auth.signInWithPassword({ email: 'admin@example.com', password: DEMO_PASSWORD });
  check('office admin signs in', !adErr, adErr?.message);
  const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', (await admin.auth.getUser()).data.user?.id).single();
  check('staff role comes from app_metadata', adminProfile?.role === 'admin', JSON.stringify(adminProfile));
  const { data: adminSees } = await admin.from('visits').select('id').in('id', [visit.id, v2.id]);
  check('admin sees every visit', adminSees?.length === 2);
  const { data: adminLog } = await admin.from('activity_log').select('id').eq('visit_id', visit.id);
  check('admin reads the activity log', (adminLog ?? []).length > 0);
  const { data: adminEvents } = await admin.from('visit_events').select('id').eq('visit_id', visit.id);
  check('admin reads raw GPS events', adminEvents?.length === 2);
} catch (err) {
  check('unexpected error', false, err.message);
} finally {
  if (patientId) {
    // visits (and their events/log rows) cascade with the user; the home-pin log row has no visit
    await service.from('activity_log').delete().eq('actor_id', patientId);
    await service.auth.admin.deleteUser(patientId);
  }
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
