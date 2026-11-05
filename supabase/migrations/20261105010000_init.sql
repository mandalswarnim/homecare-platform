-- Home-care visit platform: core schema
--
-- Flow: a patient books a visit -> a doctor/nurse accepts it -> the clinician clocks in at the
-- patient's home (GPS checked on the server) -> clocks out with a short visit report -> admins
-- see everything. Clients never write tables directly: every state change goes through a
-- SECURITY DEFINER function below, so the business rules live in one place.

-- ─────────────────────────────── Types ───────────────────────────────
create type public.user_role as enum ('patient', 'doctor', 'nurse', 'admin');
create type public.visit_status as enum ('requested', 'accepted', 'declined', 'cancelled', 'in_progress', 'completed');
create type public.event_kind as enum ('clock_in', 'clock_out');

-- ─────────────────────────────── Tables ──────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null default '',
  phone text,
  specialty text,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key references public.profiles (id) on delete cascade,
  address text,
  home_lat double precision,
  home_lng double precision,
  home_accuracy_m double precision,
  home_set_at timestamptz,
  geofence_radius_m integer not null default 150 check (geofence_radius_m between 25 and 2000),
  date_of_birth date,
  emergency_contact text,
  notes text
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  clinician_id uuid references public.profiles (id) on delete set null,
  service_type text not null,
  scheduled_start timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 720),
  reason text,
  status public.visit_status not null default 'requested',
  decline_reason text,
  accepted_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_patient_idx on public.visits (patient_id, scheduled_start desc);
create index visits_clinician_idx on public.visits (clinician_id, scheduled_start desc);
create index visits_status_idx on public.visits (status, scheduled_start);

-- Append-only clock-in/out records. The id is generated on the phone so an offline retry
-- can never create a duplicate.
create table public.visit_events (
  id uuid primary key,
  visit_id uuid not null references public.visits (id) on delete cascade,
  clinician_id uuid not null references public.profiles (id) on delete cascade,
  kind public.event_kind not null,
  occurred_at timestamptz not null,      -- effective time (server clock when online)
  device_time timestamptz,               -- what the phone said, kept for audits
  received_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  is_mocked boolean,
  distance_m double precision,
  flags text[] not null default '{}',
  verified boolean not null default false,
  note text,
  was_offline boolean not null default false,
  platform text,
  unique (visit_id, kind)
);
create index visit_events_clinician_idx on public.visit_events (clinician_id, occurred_at desc);

-- Ranges are deliberately wide: the app validates, the database only rejects impossible values.
create table public.visit_reports (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  bp_systolic smallint check (bp_systolic between 40 and 300),
  bp_diastolic smallint check (bp_diastolic between 20 and 200),
  pulse_bpm smallint check (pulse_bpm between 20 and 250),
  temperature_c numeric(4, 1) check (temperature_c between 25 and 45),
  spo2_pct smallint check (spo2_pct between 40 and 100),
  glucose_mmol numeric(4, 1) check (glucose_mmol between 0.5 and 50),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  visit_id uuid references public.visits (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_visit_idx on public.activity_log (visit_id, created_at);

-- ───────────────────────────── Helpers ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger visits_touch_updated_at
before update on public.visits
for each row execute function public.touch_updated_at();

-- Great-circle distance in metres (spherical; error < 0.5%, i.e. < 1 m at street scale).
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_clinician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('doctor', 'nurse') from public.profiles where id = auth.uid()), false);
$$;

-- Every new auth user gets a profile. Staff roles can only come from app_metadata, which only
-- the service role can set; anyone who signs up from the app is a patient.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role public.user_role := 'patient';
begin
  if new.raw_app_meta_data ? 'role' then
    new_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
  end if;

  insert into public.profiles (id, role, full_name, phone, specialty)
  values (
    new.id,
    new_role,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    case when new_role in ('doctor', 'nurse') then new.raw_user_meta_data ->> 'specialty' end
  );

  if new_role = 'patient' then
    insert into public.patients (id, address)
    values (new.id, nullif(trim(new.raw_user_meta_data ->> 'address'), ''));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- The auth service can insert a user first and write app_metadata in a follow-up update (the
-- admin API does this), and the office may promote an existing account later. Either way, keep
-- the profile's role in step with app_metadata — still only settable with the service role.
create or replace function public.sync_role_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_role public.user_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role, 'patient');
begin
  update public.profiles
     set role = next_role,
         specialty = case
           when next_role in ('doctor', 'nurse') then coalesce(specialty, nullif(trim(new.raw_user_meta_data ->> 'specialty'), ''))
         end
   where id = new.id
     and role is distinct from next_role;

  if next_role = 'patient' then
    insert into public.patients (id) values (new.id) on conflict (id) do nothing;
  else
    -- staff don't keep the patient record created at sign-up (unless it already has visits)
    delete from public.patients p
     where p.id = new.id
       and not exists (select 1 from public.visits v where v.patient_id = p.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_metadata_changed
after update of raw_app_meta_data on auth.users
for each row
when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
execute function public.sync_role_from_app_metadata();

-- ───────────────────────── Row level security ────────────────────────
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.visit_events enable row level security;
alter table public.visit_reports enable row level security;
alter table public.activity_log enable row level security;

create policy "profiles: own, clinician directory, people you have visits with, admin"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or role in ('doctor', 'nurse')
  or public.is_admin()
  or exists (
    select 1 from public.visits v
    where v.patient_id = profiles.id
      and (
        v.clinician_id = (select auth.uid())
        or (v.clinician_id is null and v.status = 'requested' and public.is_clinician())
      )
  )
);

create policy "profiles: update own contact details"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "patients: own, their clinician, admin"
on public.patients for select to authenticated
using (
  id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.visits v
    where v.patient_id = patients.id
      and (
        v.clinician_id = (select auth.uid())
        or (v.clinician_id is null and v.status = 'requested' and public.is_clinician())
      )
  )
);

create policy "patients: update own details"
on public.patients for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "visits: patient, assigned clinician, open requests for clinicians, admin"
on public.visits for select to authenticated
using (
  patient_id = (select auth.uid())
  or clinician_id = (select auth.uid())
  or public.is_admin()
  or (clinician_id is null and status = 'requested' and public.is_clinician())
);

create policy "visit_events: the clinician who recorded it, admin"
on public.visit_events for select to authenticated
using (clinician_id = (select auth.uid()) or public.is_admin());

create policy "visit_reports: the patient, the clinician, admin"
on public.visit_reports for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.visits v
    where v.id = visit_reports.visit_id
      and (v.patient_id = (select auth.uid()) or v.clinician_id = (select auth.uid()))
  )
);

create policy "activity_log: admin only"
on public.activity_log for select to authenticated
using (public.is_admin());

-- Table privileges: signed-out users get nothing; signed-in users read through RLS and can
-- only edit harmless contact columns (never their role).
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (address, date_of_birth, emergency_contact) on public.patients to authenticated;

-- ──────────────────────────── Workflow RPCs ──────────────────────────

-- Patient books a visit, optionally with a specific clinician (null = first available).
create or replace function public.request_visit(
  p_service_type text,
  p_scheduled_start timestamptz,
  p_clinician_id uuid default null,
  p_reason text default null,
  p_duration_minutes integer default 60
)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
begin
  if public.my_role() is distinct from 'patient' then
    raise exception 'Only patients can book visits from the app';
  end if;
  if coalesce(trim(p_service_type), '') = '' then
    raise exception 'Choose a service';
  end if;
  if p_scheduled_start is null or p_scheduled_start < now() - interval '10 minutes' then
    raise exception 'Choose a time in the future';
  end if;
  if p_clinician_id is not null and not exists (
    select 1 from public.profiles where id = p_clinician_id and role in ('doctor', 'nurse')
  ) then
    raise exception 'That clinician is not available';
  end if;

  insert into public.visits (patient_id, clinician_id, service_type, scheduled_start, duration_minutes, reason, created_by)
  values (
    auth.uid(), p_clinician_id, trim(p_service_type), p_scheduled_start,
    coalesce(p_duration_minutes, 60), nullif(trim(p_reason), ''), auth.uid()
  )
  returning * into v;

  insert into public.activity_log (visit_id, actor_id, action, details)
  values (v.id, auth.uid(), 'requested', jsonb_build_object(
    'service_type', v.service_type, 'scheduled_start', v.scheduled_start, 'clinician_id', v.clinician_id
  ));
  return v;
end;
$$;

-- Clinician accepts or declines. Open ("first available") requests can only be accepted.
create or replace function public.respond_to_visit(p_visit_id uuid, p_accept boolean, p_reason text default null)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
begin
  if not public.is_clinician() then
    raise exception 'Only doctors and nurses can respond to visit requests';
  end if;

  select * into v from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'Visit not found';
  end if;
  if v.status <> 'requested' then
    raise exception 'This request has already been handled';
  end if;
  if v.clinician_id is not null and v.clinician_id <> auth.uid() then
    raise exception 'This request was sent to another clinician';
  end if;

  if p_accept then
    update public.visits
       set status = 'accepted', clinician_id = auth.uid(), accepted_at = now(), decline_reason = null
     where id = p_visit_id
    returning * into v;
    insert into public.activity_log (visit_id, actor_id, action) values (v.id, auth.uid(), 'accepted');
  else
    if v.clinician_id is null then
      raise exception 'Open requests can only be accepted';
    end if;
    update public.visits
       set status = 'declined', decline_reason = nullif(trim(p_reason), '')
     where id = p_visit_id
    returning * into v;
    insert into public.activity_log (visit_id, actor_id, action, details)
    values (v.id, auth.uid(), 'declined', jsonb_build_object('reason', v.decline_reason));
  end if;
  return v;
end;
$$;

create or replace function public.cancel_visit(p_visit_id uuid, p_reason text default null)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
begin
  select * into v from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'Visit not found';
  end if;
  if not (v.patient_id = auth.uid() or public.is_admin()) then
    raise exception 'You can only cancel your own visits';
  end if;
  if v.status not in ('requested', 'accepted', 'declined') then
    raise exception 'This visit can no longer be cancelled';
  end if;

  update public.visits set status = 'cancelled', cancelled_at = now() where id = p_visit_id returning * into v;
  insert into public.activity_log (visit_id, actor_id, action, details)
  values (v.id, auth.uid(), 'cancelled', jsonb_build_object('reason', nullif(trim(p_reason), '')));
  return v;
end;
$$;

-- Admin (re)assigns a visit that hasn't started; the clinician then accepts it in the app.
create or replace function public.assign_visit(p_visit_id uuid, p_clinician_id uuid)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
begin
  if not public.is_admin() then
    raise exception 'Only admins can assign visits';
  end if;
  if not exists (select 1 from public.profiles where id = p_clinician_id and role in ('doctor', 'nurse')) then
    raise exception 'Clinician not found';
  end if;

  select * into v from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'Visit not found';
  end if;
  if v.status not in ('requested', 'accepted', 'declined') then
    raise exception 'Only visits that have not started can be reassigned';
  end if;

  update public.visits
     set clinician_id = p_clinician_id, status = 'requested', accepted_at = null, decline_reason = null
   where id = p_visit_id
  returning * into v;
  insert into public.activity_log (visit_id, actor_id, action, details)
  values (v.id, auth.uid(), 'assigned', jsonb_build_object('clinician_id', p_clinician_id));
  return v;
end;
$$;

-- Patient pins their home (normally while standing at home, using the phone's GPS).
create or replace function public.set_home_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null,
  p_address text default null
)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  pt public.patients;
begin
  if public.my_role() is distinct from 'patient' then
    raise exception 'Only patients can set a home location';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location';
  end if;

  update public.patients
     set home_lat = p_lat,
         home_lng = p_lng,
         home_accuracy_m = p_accuracy_m,
         home_set_at = now(),
         address = coalesce(nullif(trim(p_address), ''), address)
   where id = auth.uid()
  returning * into pt;

  insert into public.activity_log (actor_id, action, details)
  values (auth.uid(), 'home_location_set', jsonb_build_object('lat', p_lat, 'lng', p_lng, 'accuracy_m', p_accuracy_m));
  return pt;
end;
$$;

-- Clock in / clock out. The phone's own check is only feedback for the clinician: this function
-- recomputes everything, so a tampered app cannot mark itself verified. Never blocks the visit —
-- problems become flags for the office to review.
create or replace function public.record_visit_event(
  p_event_id uuid,
  p_visit_id uuid,
  p_kind public.event_kind,
  p_occurred_at timestamptz,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_is_mocked boolean default null,
  p_note text default null,
  p_was_offline boolean default false,
  p_platform text default null,
  p_report jsonb default null
)
returns public.visit_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
  pt public.patients;
  ev public.visit_events;
  dist double precision;
  slack double precision;
  flags text[] := '{}';
  at_time timestamptz;
  offline boolean := coalesce(p_was_offline, false);
begin
  -- A retried submission returns the stored result instead of failing.
  select * into ev from public.visit_events where id = p_event_id;
  if found then
    if ev.clinician_id <> auth.uid() then
      raise exception 'This event belongs to someone else';
    end if;
    return ev;
  end if;

  select * into v from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'Visit not found';
  end if;
  if v.clinician_id is distinct from auth.uid() then
    raise exception 'This visit is not assigned to you';
  end if;

  -- A double tap that produced a second id: return what is already recorded.
  select * into ev from public.visit_events where visit_id = p_visit_id and kind = p_kind;
  if found then
    return ev;
  end if;

  if p_kind = 'clock_in' and v.status <> 'accepted' then
    raise exception 'You can only clock in to an accepted visit (this one is %)', v.status;
  end if;
  if p_kind = 'clock_out' and v.status <> 'in_progress' then
    raise exception 'Clock in before clocking out (this visit is %)', v.status;
  end if;

  -- Online: trust the server clock. Offline: use the phone's time, but never a future time.
  at_time := case when offline then least(coalesce(p_occurred_at, now()), now()) else now() end;

  select * into pt from public.patients where id = v.patient_id;

  if p_lat is null or p_lng is null then
    flags := array_append(flags, 'no_gps');
  elsif pt.home_lat is null or pt.home_lng is null then
    flags := array_append(flags, 'no_home_pin');
  else
    dist := public.distance_m(pt.home_lat, pt.home_lng, p_lat, p_lng);
    slack := least(coalesce(p_accuracy_m, 0), 50);
    if dist > pt.geofence_radius_m + slack then
      flags := array_append(flags, 'outside_area');
    end if;
  end if;
  if p_accuracy_m is not null and p_accuracy_m > 100 then
    flags := array_append(flags, 'weak_gps');
  end if;
  if coalesce(p_is_mocked, false) then
    flags := array_append(flags, 'mock_location');
  end if;
  if p_occurred_at is not null and (
       p_occurred_at > now() + interval '5 minutes'
       or (not offline and abs(extract(epoch from (now() - p_occurred_at))) > 300)
     ) then
    flags := array_append(flags, 'clock_mismatch');
  end if;

  insert into public.visit_events (
    id, visit_id, clinician_id, kind, occurred_at, device_time, lat, lng, accuracy_m,
    is_mocked, distance_m, flags, verified, note, was_offline, platform
  )
  values (
    p_event_id, p_visit_id, auth.uid(), p_kind, at_time, p_occurred_at, p_lat, p_lng, p_accuracy_m,
    p_is_mocked, dist, flags, cardinality(flags) = 0, nullif(trim(p_note), ''), offline, p_platform
  )
  returning * into ev;

  if p_kind = 'clock_in' then
    update public.visits set status = 'in_progress', started_at = at_time where id = p_visit_id;
  else
    update public.visits set status = 'completed', ended_at = at_time where id = p_visit_id;

    if p_report is not null and p_report <> '{}'::jsonb then
      begin
        insert into public.visit_reports (
          visit_id, bp_systolic, bp_diastolic, pulse_bpm, temperature_c, spo2_pct, glucose_mmol, notes, created_by
        )
        values (
          p_visit_id,
          nullif(p_report ->> 'bp_systolic', '')::smallint,
          nullif(p_report ->> 'bp_diastolic', '')::smallint,
          nullif(p_report ->> 'pulse_bpm', '')::smallint,
          nullif(p_report ->> 'temperature_c', '')::numeric,
          nullif(p_report ->> 'spo2_pct', '')::smallint,
          nullif(p_report ->> 'glucose_mmol', '')::numeric,
          nullif(trim(p_report ->> 'notes'), ''),
          auth.uid()
        )
        on conflict (visit_id) do update set
          bp_systolic = excluded.bp_systolic,
          bp_diastolic = excluded.bp_diastolic,
          pulse_bpm = excluded.pulse_bpm,
          temperature_c = excluded.temperature_c,
          spo2_pct = excluded.spo2_pct,
          glucose_mmol = excluded.glucose_mmol,
          notes = excluded.notes;
      exception when others then
        -- Never lose a clock-out over a bad vitals value; keep the raw report for the office.
        insert into public.activity_log (visit_id, actor_id, action, details)
        values (p_visit_id, auth.uid(), 'report_rejected', jsonb_build_object('error', sqlerrm, 'report', p_report));
      end;
    end if;
  end if;

  insert into public.activity_log (visit_id, actor_id, action, details)
  values (p_visit_id, auth.uid(), p_kind::text, jsonb_build_object(
    'verified', ev.verified,
    'flags', to_jsonb(flags),
    'distance_m', round(dist::numeric),
    'accuracy_m', round(p_accuracy_m::numeric),
    'was_offline', offline
  ));

  return ev;
end;
$$;

-- Function privileges: nothing for signed-out users.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ───────────────────────────── Realtime ──────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime add table public.visits, public.visit_events, public.activity_log;
