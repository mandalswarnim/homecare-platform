# CareRound office console (Next.js)

The office dashboard: live map, needs-attention queue, schedule, KPIs, and full visit and patient records. Only accounts with the `admin` role can sign in.

```sh
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

Checks: `npx tsc --noEmit`, `npm run lint` and `npm run build`. See the [root README](../README.md) for the database and demo accounts.
