import type { Tone } from './theme';
import type { VisitStatus } from './types';

export const STATUS: Record<VisitStatus, { patient: string; clinician: string; tone: Tone }> = {
  requested: { patient: 'Waiting for confirmation', clinician: 'New request', tone: 'info' },
  accepted: { patient: 'Confirmed', clinician: 'Confirmed', tone: 'primary' },
  declined: { patient: 'Declined', clinician: 'Declined', tone: 'danger' },
  cancelled: { patient: 'Cancelled', clinician: 'Cancelled', tone: 'neutral' },
  in_progress: { patient: 'Clinician on site', clinician: 'In progress', tone: 'warning' },
  completed: { patient: 'Completed', clinician: 'Completed', tone: 'success' },
};

const FLAG_TEXT: Record<string, string> = {
  outside_area: "Outside the patient's home area",
  weak_gps: 'Weak GPS signal',
  mock_location: 'Fake-GPS app detected',
  no_home_pin: "Patient's home isn't pinned yet",
  no_gps: 'No GPS reading',
  clock_mismatch: "Phone clock doesn't match the server",
};
export const flagText = (flag: string) => FLAG_TEXT[flag] ?? flag.replace(/_/g, ' ');

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatTime(iso: string | null | undefined) {
  return iso ? timeFmt.format(new Date(iso)) : '—';
}

export function formatDay(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return dayFmt.format(d);
}

export const formatLongDay = (date: Date) => longDayFmt.format(date);
export const formatWhen = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDistance(m: number | null | undefined) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Dr. Amara Okafor" → "Dr. Okafor", "Grace Wanjiru" → "Grace" */
export function shortName(full: string | null | undefined) {
  const name = (full ?? '').trim();
  if (!name) return '';
  const parts = name.split(/\s+/);
  if (/^dr\.?$/i.test(parts[0]) && parts.length > 1) return `Dr. ${parts[parts.length - 1]}`;
  return parts[0];
}

export function initials(full: string | null | undefined) {
  const parts = (full ?? '').replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '');
}

export function errorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return String(err ?? 'Something went wrong');
}
