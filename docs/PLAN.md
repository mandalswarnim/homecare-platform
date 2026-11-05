# Technical plan

## Goal of the pilot

Prove one thing reliably: **clinicians clock in and out at the patient's home, and the office can trust where and when it happened** — even with patchy mobile signal. Everything else (booking, vitals, results, KPIs) supports that loop.

## Architecture

```
 Patient app ─┐                          ┌─ Office console (Next.js, browser)
              ├─ Supabase (Postgres, Auth, Realtime) ─┤
 Clinician app┘   RLS on every table      └─ seed / smoke-test scripts
 (one Expo app,   writes only via
  role-based UI)  SECURITY DEFINER functions
```

- **One mobile app** for patients and clinicians; the signed-in role decides which screens appear. Built with Expo, so the same code runs on Android, iPhone and the web.
- **Office console** is a browser app: no install, works on a laptop or a phone.
- **Supabase** provides the database, sign-in, and realtime updates. The free tier is enough for the pilot. Everything is standard Postgres, so it can move to another host later without rewriting the apps.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | Everyone who signs in: role (patient / doctor / nurse / admin), name, phone, specialty |
| `patients` | Patient details and the **pinned home** (lat/lng, GPS accuracy when pinned, geofence radius) |
| `visits` | A booking: patient, clinician (empty = open request), service, time, status, timestamps for each transition |
| `visit_events` | Clock-in / clock-out: the phone's GPS fix and accuracy, distance from home computed on the server, flags, verified yes/no, device time vs received time, offline flag. ID generated on the phone so retries are idempotent |
| `visit_reports` | Vitals recorded at clock-out (blood pressure, pulse, temperature, SpO₂, glucose, notes), range-checked by the database |
| `activity_log` | Audit trail of every action, shown as the console's live feed and each visit's timeline |

Visit lifecycle: `requested → accepted → in_progress → completed`, with `declined` (the office reassigns) and `cancelled`.

## Location verification

Done on the server in `record_visit_event`, never trusted from the phone:

| Check | Rule | Flag |
|---|---|---|
| Distance | haversine distance to the pinned home ≤ geofence (150 m) + min(GPS accuracy, 50 m) | `outside_area` |
| GPS quality | accuracy ≤ 100 m | `weak_gps` |
| Position present | the phone sent a fix | `no_gps` |
| Fake GPS | OS mock-location signal (Android + iOS) | `mock_location` |
| Clock | online: server time is used, > 5 min skew is flagged; offline: device time, capped at "now" | `clock_mismatch` |
| Home pinned | the patient has pinned their home | `no_home_pin` |

Flags mark a visit for review in the console; they don't block the clinician. Rules are deliberately simple and explainable, and every threshold lives in one SQL function, so it can be tuned once the pilot shows real-world GPS behaviour.

## Offline behaviour

Clock events are saved on the phone first (outbox), then sent. The outbox retries on reconnect, when the app comes to the foreground, and every 20 seconds. Each event carries a phone-generated UUID and the database allows one clock-in and one clock-out per visit, so a retry or a double tap can never create a duplicate. The UI shows queued events immediately ("waiting for signal").

## Office console

- **Overview:** clinicians on a visit right now (live), map of today's activity, *needs attention* queue with one-click reassignment, live activity feed, today's schedule, KPIs (visits completed, care hours, % location-verified, on-time arrivals, time to accept, patients served) with period-over-period comparison, and charts by day, service and clinician.
- **Visits:** filterable list (date range, status, clinician, needs-review), CSV export with GPS evidence and vitals.
- **Visit record:** map of the pinned home, the verified area and each clock point with its GPS accuracy, a check-by-check verdict, vitals, timeline, reassign / cancel.
- **Patients / team:** per-patient results and vitals trends; per-clinician completion, hours, verification and punctuality.

Charts follow an accessibility-checked palette (validated for colour-blind separation and contrast in light and dark mode). Every chart has a table view, and status is always shown with an icon and a label, never colour alone.

## Security

- Self sign-up always creates a patient; staff roles are assigned server-side.
- Row-level security on every table; signed-out users have no access.
- No direct table writes from the apps — only validated functions. Users can edit only harmless contact fields (never their role).
- The secret key is used only by local scripts and never ships in an app; all `.env*` files are git-ignored.

## Roadmap

**Pilot (now):** booking, accept/decline, GPS-verified clock in/out with offline sync, vitals, patient results, office console with live map and KPIs.

**Next:**

1. Push notifications when the app is closed (new request, visit confirmed, clinician on the way). In-app live updates already work.
2. Pricing per service → invoices from completed visits → revenue in the console and invoices in the patient app; mobile-money payments.
3. Office tools: create staff accounts, edit patient details and geofence radius, review/approve flagged visits with a comment.
4. Recurring visits (e.g. daily nursing care) and clinician availability.
5. Store builds (Play Store, then App Store) once devices and accounts are decided.

## Open questions

- Country of operation: data-protection rules, where data should be hosted, language(s), currency.
- Devices: company phones or staff's own (affects fake-GPS policy and app distribution).
- Geofence size for dense urban areas vs rural homes.
- Who reviews flagged visits, and what happens to them (payroll, billing).
