"use client";

import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  CircleX,
  LogIn,
  LogOut,
  MapPin,
  ShieldAlert,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { formatDistance, shortName, timeAgo } from "@/lib/format";
import type { ActivityItem, Clinician } from "@/lib/types";
import { flagShort, isUuid } from "@/lib/visits";

import { cx } from "./ui";

export type Line = { icon: LucideIcon; text: string; warn?: boolean; note?: string };

export function describe(a: ActivityItem, clinicians: Clinician[]): Line {
  const actor = a.actor?.full_name ?? "Someone";
  const patient = a.visit?.patient?.profile?.full_name ?? "a patient";
  const service = a.visit?.service_type?.toLowerCase() ?? "a visit";
  const d = a.details ?? {};
  const flags = Array.isArray(d.flags) ? (d.flags as string[]) : [];
  const verified = d.verified === true;
  const dist = typeof d.distance_m === "number" ? formatDistance(d.distance_m) : null;
  const offline = d.was_offline === true ? " · synced after reconnecting" : "";

  switch (a.action) {
    case "requested":
      return { icon: CalendarPlus, text: `${actor} booked ${service}` };
    case "accepted":
      return { icon: CalendarCheck, text: `${shortName(actor)} accepted ${patient}'s ${service}` };
    case "declined":
      return { icon: CircleX, text: `${shortName(actor)} declined ${patient}'s ${service}`, warn: true, note: typeof d.reason === "string" ? `“${d.reason}”` : undefined };
    case "cancelled":
      return { icon: Ban, text: `${actor} cancelled ${patient === actor ? "their" : `${patient}'s`} ${service}` };
    case "assigned": {
      const to = clinicians.find((c) => c.id === d.clinician_id)?.full_name;
      return { icon: UserPlus, text: `${actor} sent ${patient}'s ${service} to ${to ?? "a clinician"}` };
    }
    case "clock_in":
    case "clock_out": {
      const verb = a.action === "clock_in" ? "clocked in at" : "clocked out of";
      return {
        icon: verified ? (a.action === "clock_in" ? LogIn : LogOut) : ShieldAlert,
        text: `${shortName(actor)} ${verb} ${patient}'s home`,
        warn: !verified,
        note: verified ? `Verified${dist ? ` · ${dist} from home` : ""}${offline}` : `${flags.map(flagShort).join(", ") || "Not verified"}${dist ? ` · ${dist} from home` : ""}${offline}`,
      };
    }
    case "home_location_set":
      return { icon: MapPin, text: `${actor} pinned their home location` };
    case "report_rejected":
      return { icon: TriangleAlert, text: `Vitals from ${shortName(actor)} were rejected (values out of range)`, warn: true };
    default:
      return { icon: CalendarCheck, text: `${actor}: ${a.action.replace(/_/g, " ")}` };
  }
}

export function ActivityFeed({ items, clinicians, now, limit = 12 }: { items: ActivityItem[]; clinicians: Clinician[]; now: number; limit?: number }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="space-y-1">
      {items.slice(0, limit).map((a) => {
        const line = describe(a, clinicians);
        const Icon = line.icon;
        const body = (
          <>
            <Icon className={cx("mt-0.5 size-4 shrink-0", line.warn ? "text-warning-text" : "text-faint")} aria-hidden strokeWidth={1.8} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] leading-snug text-ink">{line.text}</span>
              {line.note ? (
                <span className={cx("mt-0.5 flex flex-wrap gap-x-2.5 text-xs", line.warn ? "text-warning-text" : "text-muted")}>
                  {line.note.split(" · ").map((part) => (
                    <span key={part}>{part}</span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-faint tabular-nums">{timeAgo(a.created_at, now)}</span>
          </>
        );
        return (
          <li key={a.id}>
            {isUuid(a.visit_id) ? (
              <Link href={`/visits/${a.visit_id}`} className="-mx-2.5 flex gap-3 rounded-[9px] px-2.5 py-2 transition-colors hover:bg-surface-2">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
