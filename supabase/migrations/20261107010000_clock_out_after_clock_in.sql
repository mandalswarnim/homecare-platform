-- An offline clock-out uses the phone's clock. If that clock runs behind the server (or the
-- clinician clocked in online and out offline), the clock-out could land before the clock-in
-- and the visit showed a negative duration. Clamp it: a clock-out is never earlier than the
-- visit's start. The phone's own time is still kept in device_time for audits.

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
  flags text[] := '{}'::text[];
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
  if p_kind = 'clock_out' and v.started_at is not null and at_time < v.started_at then
    at_time := v.started_at;
  end if;

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
    is_mocked, distance_m, flags, verified, note, was_offline, platform,
    home_lat, home_lng, geofence_radius_m
  )
  values (
    p_event_id, p_visit_id, auth.uid(), p_kind, at_time, p_occurred_at, p_lat, p_lng, p_accuracy_m,
    p_is_mocked, dist, flags, cardinality(flags) = 0, nullif(trim(p_note), ''), offline, p_platform,
    pt.home_lat, pt.home_lng, case when pt.home_lat is not null then pt.geofence_radius_m end
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
