// Formatting helpers. Everything here runs in the browser (the console renders after sign-in),
// so dates use the viewer's own locale and time zone.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const shortDayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const fullFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const secondsFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
const intFmt = new Intl.NumberFormat();
const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));

export function startOfDay(v: string | number | Date) {
  const d = new Date(toDate(v));
  d.setHours(0, 0, 0, 0);
  return d;
}

export const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

export const dayKey = (v: string | number | Date) => {
  const d = toDate(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const sameDay = (a: string | number | Date, b: string | number | Date) => dayKey(a) === dayKey(b);

export const formatTime = (v: string | null | undefined) => (v ? timeFmt.format(toDate(v)) : "—");
export const formatSeconds = (v: string | null | undefined) => (v ? secondsFmt.format(toDate(v)) : "—");
export const formatShortDay = (v: string | Date) => shortDayFmt.format(toDate(v));
export const formatWeekday = (v: string | Date) => weekdayFmt.format(toDate(v));
export const formatLongDay = (v: string | Date) => longDayFmt.format(toDate(v));
export const formatFullDate = (v: string | Date) => fullFmt.format(toDate(v));

export function formatDay(v: string | Date, now = Date.now()) {
  const diff = Math.round((startOfDay(v).getTime() - startOfDay(now).getTime()) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dayFmt.format(toDate(v));
}

export const formatWhen = (v: string, now = Date.now()) => `${formatDay(v, now)}, ${formatTime(v)}`;

export function timeAgo(v: string, now = Date.now()) {
  const ms = now - toDate(v).getTime();
  if (ms < 45_000) return "just now";
  if (ms < HOUR) return `${Math.round(ms / MIN)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)} d ago`;
  return formatShortDay(v);
}

/** "in 25 min", "in 3 h", "25 min ago" */
export function relative(v: string, now = Date.now()) {
  const ms = toDate(v).getTime() - now;
  if (ms < 0) return timeAgo(v, now);
  if (ms < 45_000) return "now";
  if (ms < HOUR) return `in ${Math.round(ms / MIN)} min`;
  if (ms < DAY) return `in ${Math.round(ms / HOUR)} h`;
  return `in ${Math.round(ms / DAY)} d`;
}

export function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} h ${String(mins % 60).padStart(2, "0")} min` : `${mins} min`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDistance(m: number | null | undefined) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export const formatInt = (n: number) => intFmt.format(Math.round(n));

/** 1,284 · 12.9K · 4.2M — full under 10,000 */
export const formatCompact = (n: number) => (Math.abs(n) < 10_000 ? intFmt.format(Math.round(n)) : compactFmt.format(n));

export const formatPct = (ratio: number | null) => (ratio == null ? "—" : `${Math.round(ratio * 100)}%`);

export function formatHours(ms: number) {
  const h = ms / HOUR;
  if (h === 0) return "0 h";
  return h < 10 ? `${h.toFixed(1)} h` : `${formatInt(h)} h`;
}

export function age(dob: string | null | undefined, now = Date.now()) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  const today = new Date(now);
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years -= 1;
  return years;
}

/** "Dr. Amara Okafor" → "Dr. Okafor", "Grace Wanjiru" → "Grace" */
export function shortName(full: string | null | undefined) {
  const name = (full ?? "").trim();
  if (!name) return "";
  const parts = name.split(/\s+/);
  if (/^dr\.?$/i.test(parts[0]) && parts.length > 1) return `Dr. ${parts[parts.length - 1]}`;
  return parts[0];
}

export function initials(full: string | null | undefined) {
  const parts = (full ?? "")
    .replace(/^dr\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "");
}

export const roleLabel = (role: string | null | undefined) =>
  role === "doctor" ? "Doctor" : role === "nurse" ? "Nurse" : role === "admin" ? "Office admin" : role === "patient" ? "Patient" : "—";

export function errorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  return String(err ?? "Something went wrong");
}

export const MS = { MIN, HOUR, DAY };
