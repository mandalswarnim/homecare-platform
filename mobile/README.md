# CareRound mobile app (Expo)

One app for patients and clinicians — the screens depend on the signed-in account's role.

```sh
cp .env.example .env   # Supabase URL + publishable key
npm install
npx expo start         # scan the QR code with Expo Go, or press w for the web version
```

Checks: `npx tsc --noEmit` and `npx expo lint`. See the [root README](../README.md) for the database, demo data and how clock-ins are verified.
