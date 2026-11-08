# CareRound — home-care visit platform (MVP)

> "CareRound" is a placeholder name.

Three apps share one database:

| App | Who | What it does |
|---|---|---|
| **Mobile app** (`mobile/`, Expo) | Patients | Sign up, pin their home, book a visit with a specific clinician or the first one available, follow its status live, see visit results |
| | Doctors & nurses | Get visit requests, accept or decline them, get directions, **clock in and out with GPS verification** (works offline), record vitals |
| **Office console** (`web/`, Next.js) | Office admins | Live map of who is on a visit, a "needs attention" queue (declined/unanswered requests, late arrivals, flagged clock-ins) with one-click reassignment, today's schedule, KPIs and charts, full visit records with GPS evidence, CSV export |
| **Backend** (`supabase/`) | — | Postgres + Auth + Realtime. Row-level security on every table; every state change goes through a server-side function that validates it |

## Repository layout

```
supabase/migrations/   database schema, security policies and workflow functions
scripts/seed.mjs       creates demo accounts and ~2 weeks of realistic visits
scripts/smoke-test.mjs end-to-end check of the booking → clock-in → clock-out flow and the security rules
mobile/                Expo (React Native) app for patients and clinicians — iOS, Android and web
web/                   Next.js office console
```

## Running it

You need Node 20+, and either Docker (to run Supabase locally) or a free Supabase project.

### 1. Database

**Local (Docker):**

```sh
npm install
npx supabase start          # applies supabase/migrations automatically
npx supabase status -o env  # shows the local URL and keys
```

**Hosted (free Supabase project):**

```sh
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote   # without --remote the CLI targets the local stack
```

In the hosted project, turn off **Authentication → Sign In / Providers → Email → Confirm email** for the demo (patients can then sign up and use the app straight away).

### 2. Environment files (all git-ignored)

| File | From | Contents |
|---|---|---|
| `.env` | `.env.example` | URL, publishable key, **secret key** (seeding only — never put it in an app), a `DEMO_PASSWORD` you choose |
| `mobile/.env` | `mobile/.env.example` | URL + publishable key |
| `web/.env.local` | `web/.env.example` | URL + publishable key |

The publishable key is designed to be public: the database only returns what each signed-in account is allowed to see.

Using the local Docker stack instead? Put the values from `npx supabase status -o env` in `.env.local` and use `npm run seed:local` / `npm run smoke:local`.

### 3. Demo data and checks

```sh
npm run seed    # demo accounts + visits around "now"
npm run smoke   # end-to-end test; prints PASS/FAIL per step and cleans up after itself
```

Seeded accounts (all use `DEMO_PASSWORD`): `admin@example.com` (office), `dr.aya@example.com`, `dr.yao@example.com`, `nurse.adjoua@example.com`, `nurse.awa@example.com` (clinicians), and patients `amenan@example.com`, `koffi@example.com`, `affoue@example.com`, `seydou@example.com`, `aminata@example.com`, `jean@example.com`.

Re-run `npm run seed` right before a demo so "today" has live activity (it wipes and recreates only the `@example.com` accounts).

### 4. Apps

```sh
npm --prefix web run dev        # office console → http://localhost:3000
cd mobile && npx expo start     # scan the QR code with Expo Go (same Wi-Fi), or add --tunnel
```

`npx expo start --web` runs the mobile app in a browser too — handy for showing the patient and clinician side by side. (A phone can't reach a database on `127.0.0.1`; use the hosted project, or your computer's LAN address, when testing on a device.)

## How a clock-in is verified

The phone sends its GPS fix; the server — not the phone — decides:

- **Inside the home area:** within the patient's geofence (150 m by default) of the home they pinned, plus a GPS-accuracy margin of up to 50 m. Outside → `outside_area`.
- **GPS quality:** accuracy worse than 100 m → `weak_gps`; no fix → `no_gps`.
- **Fake GPS:** the OS reports mock locations (Android and iOS) → `mock_location`.
- **Clock tampering:** online events use the server's clock; offline events keep the phone's time but can't be in the future. More than 5 minutes of skew while online → `clock_mismatch`.
- **No home pinned yet** → `no_home_pin`.

Each clock event keeps a copy of the home pin and radius it was checked against, so the evidence stays correct if the patient moves their pin later.

Flags never block a clock-in (a nurse at a hospital bedside still needs to record the visit); they mark it for review in the console. Offline clock-ins are queued on the phone with a unique ID and synced when signal returns, so retries can never double-count.

## Security model

- Signing up always creates a **patient**. Staff roles are set by the office (server-side `app_metadata`), and users can't edit their own role.
- Row-level security: patients see their own records; clinicians see visits assigned to them and open requests; admins see everything. Signed-out users see nothing.
- Apps can't write to tables directly — only through server functions (`request_visit`, `respond_to_visit`, `record_visit_event`, `assign_visit`, …) that check who is calling and whether the change is allowed.
- Secrets stay out of git: every `.env*` file except the examples is ignored.

See [docs/PLAN.md](docs/PLAN.md) for the architecture and roadmap.
