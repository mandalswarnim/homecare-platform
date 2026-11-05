import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Fix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** true when the OS reports a fake/simulated location (Android mock provider, iOS simulated) */
  mocked: boolean | null;
  timestamp: number;
};

export async function ensureLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

function toFix(loc: Location.LocationObject): Fix {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    mocked: loc.mocked ?? null,
    timestamp: loc.timestamp,
  };
}

/**
 * Watches GPS for up to `timeoutMs` and keeps the most accurate reading, finishing early once it is
 * within `targetAccuracy` metres. Indoors the first reading is often 50–100 m off; a few seconds of
 * watching usually brings it under 20 m.
 */
export function getBestFix({
  timeoutMs = 15_000,
  targetAccuracy = 20,
  onUpdate,
}: { timeoutMs?: number; targetAccuracy?: number; onUpdate?: (fix: Fix) => void } = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    let best: Fix | null = null;
    let subscription: Location.LocationSubscription | null = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription?.remove();
      if (best) resolve(best);
      else reject(new Error('No GPS signal yet. Move near a window or step outside, then try again.'));
    };
    const timer = setTimeout(finish, timeoutMs);

    const consider = (loc: Location.LocationObject) => {
      const fix = toFix(loc);
      const accuracy = fix.accuracy ?? Number.POSITIVE_INFINITY;
      if (!best || accuracy < (best.accuracy ?? Number.POSITIVE_INFINITY)) {
        best = fix;
        onUpdate?.(fix);
      }
      if (accuracy <= targetAccuracy) finish();
    };

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      consider,
    )
      .then((sub) => {
        subscription = sub;
        if (done) sub.remove();
      })
      .catch(() => {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then(consider)
          .catch(() => undefined)
          .finally(finish);
      });
  });
}

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type Home = { lat: number; lng: number; radius: number };

export function homeOf(
  p: { home_lat: number | null; home_lng: number | null; geofence_radius_m: number } | null | undefined,
): Home | null {
  if (!p || p.home_lat == null || p.home_lng == null) return null;
  return { lat: p.home_lat, lng: p.home_lng, radius: p.geofence_radius_m };
}

/** Same rules as record_visit_event() on the server. Only used for instant feedback on the phone. */
export function previewCheck(fix: Fix, home: Home | null) {
  const flags: string[] = [];
  let distance: number | null = null;
  if (!home) {
    flags.push('no_home_pin');
  } else {
    distance = distanceM(home.lat, home.lng, fix.lat, fix.lng);
    if (distance > home.radius + Math.min(fix.accuracy ?? 0, 50)) flags.push('outside_area');
  }
  if ((fix.accuracy ?? 0) > 100) flags.push('weak_gps');
  if (fix.mocked) flags.push('mock_location');
  return { flags, distance };
}

export function directionsUrl(lat: number, lng: number) {
  return Platform.OS === 'ios'
    ? `http://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
