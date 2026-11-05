import { formatDistance, formatDuration, formatWhen, MS, shortName, timeAgo } from "./format";
import type { VisitFull } from "./types";
import { flagShort, patientName } from "./visits";

export type Severity = "critical" | "serious" | "warning";

export type AttentionItem = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  visit: VisitFull;
  /** what the office can do about it */
  action: "assign" | "call" | "review";
  at: number;
};

const RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };

/**
 * Things the office should act on now. Each rule is deliberately simple so it's easy to explain
 * in a demo — and easy to tune once the pilot shows which ones matter.
 */
export function needsAttention(visits: VisitFull[], now: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  const recent = now - 7 * MS.DAY;

  for (const v of visits) {
    const start = new Date(v.scheduled_start).getTime();
    const patient = patientName(v);
    const clinician = shortName(v.clinician?.full_name) || "the clinician";
    const when = formatWhen(v.scheduled_start, now);

    if (v.status === "declined" && start > recent) {
      items.push({
        id: `${v.id}:declined`,
        severity: start - now < 6 * MS.HOUR ? "critical" : "serious",
        title: `Declined by ${clinician} — needs someone else`,
        detail: `${patient} · ${v.service_type} · ${when}${v.decline_reason ? ` · “${v.decline_reason}”` : ""}`,
        visit: v,
        action: "assign",
        at: start,
      });
    } else if (v.status === "requested" && v.clinician_id === null && start > recent) {
      items.push({
        id: `${v.id}:open`,
        severity: start - now < 3 * MS.HOUR ? "critical" : "warning",
        title: "Open request — no clinician has accepted yet",
        detail: `${patient} · ${v.service_type} · ${when} · asked ${timeAgo(v.created_at, now)}`,
        visit: v,
        action: "assign",
        at: start,
      });
    } else if (v.status === "requested" && v.clinician_id !== null && now - new Date(v.updated_at).getTime() > 30 * MS.MIN && start > recent) {
      // updated_at moves when the office re-assigns, so "sent" is the latest hand-off
      items.push({
        id: `${v.id}:unanswered`,
        severity: start - now < 3 * MS.HOUR ? "serious" : "warning",
        title: `Waiting for ${clinician} to accept`,
        detail: `${patient} · ${v.service_type} · ${when} · sent ${timeAgo(v.updated_at, now)}`,
        visit: v,
        action: "assign",
        at: start,
      });
    } else if (v.status === "accepted" && now - start > 15 * MS.MIN && start > recent) {
      items.push({
        id: `${v.id}:late`,
        severity: "critical",
        title: `${clinician} hasn't clocked in — ${formatDuration(now - start)} late`,
        detail: `${patient} · ${v.service_type} · was due ${when}`,
        visit: v,
        action: "call",
        at: start,
      });
    } else if (v.status === "in_progress" && v.started_at) {
      const onSite = now - new Date(v.started_at).getTime();
      if (onSite > (v.duration_minutes + 30) * MS.MIN) {
        items.push({
          id: `${v.id}:overrun`,
          severity: "warning",
          title: `Running long — ${clinician} on site for ${formatDuration(onSite)}`,
          detail: `${patient} · ${v.service_type} · booked for ${v.duration_minutes} min`,
          visit: v,
          action: "call",
          at: new Date(v.started_at).getTime(),
        });
      }
    }

    for (const e of v.events ?? []) {
      const t = new Date(e.occurred_at).getTime();
      if (e.verified || now - t > 2 * MS.DAY) continue;
      const what = e.kind === "clock_in" ? "Clock-in" : "Clock-out";
      const flags = e.flags.map(flagShort).join(", ") || "not verified";
      const dist = e.flags.includes("outside_area") && e.distance_m != null ? ` (${formatDistance(e.distance_m)} from home)` : "";
      items.push({
        id: `${e.id}:flag`,
        severity: e.flags.includes("mock_location") || e.flags.includes("outside_area") ? "serious" : "warning",
        title: `${what} flagged: ${flags}${dist}`,
        detail: `${shortName(v.clinician?.full_name) || "Clinician"} at ${patient} · ${timeAgo(e.occurred_at, now)}`,
        visit: v,
        action: "review",
        at: t,
      });
    }
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.at - b.at);
}
