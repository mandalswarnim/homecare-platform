"use client";

import { HeartPulse } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { formatDistance, formatDuration, formatTime, formatWhen, shortName } from "@/lib/format";
import type { VisitFull } from "@/lib/types";
import { actualMs, eventOf, patientName, reportOf, verificationOf, visitFlags } from "@/lib/visits";

import { StatusBadge, VerificationBadge } from "./status";
import { Avatar, cx } from "./ui";

export type VisitColumn = "when" | "time" | "patient" | "service" | "clinician" | "status" | "check" | "clock" | "duration" | "vitals";

const HEAD: Record<VisitColumn, string> = {
  when: "Scheduled",
  time: "Time",
  patient: "Patient",
  service: "Service",
  clinician: "Clinician",
  status: "Status",
  check: "Location check",
  clock: "Clock in / out",
  duration: "Duration",
  vitals: "Vitals",
};

function ClockCell({ v }: { v: VisitFull }) {
  const cin = eventOf(v, "clock_in");
  const cout = eventOf(v, "clock_out");
  if (!cin && !cout) return <span className="text-faint">—</span>;
  return (
    <span className="text-[13px] whitespace-nowrap text-ink-2 tabular-nums">
      {cin ? formatTime(cin.occurred_at) : "—"} – {cout ? formatTime(cout.occurred_at) : "…"}
      {cin?.distance_m != null ? <span className="text-muted"> · {formatDistance(cin.distance_m)}</span> : null}
    </span>
  );
}

function cell(col: VisitColumn, v: VisitFull, now: number): ReactNode {
  switch (col) {
    case "when":
      return <span className="whitespace-nowrap tabular-nums">{formatWhen(v.scheduled_start, now)}</span>;
    case "time":
      return <span className="whitespace-nowrap tabular-nums">{formatTime(v.scheduled_start)}</span>;
    case "patient":
      return (
        <Link href={`/visits/${v.id}`} className="font-medium whitespace-nowrap text-ink hover:underline">
          {patientName(v)}
        </Link>
      );
    case "service":
      return <span className="whitespace-nowrap">{v.service_type}</span>;
    case "clinician":
      return v.clinician ? (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <Avatar name={v.clinician.full_name} size={22} />
          {shortName(v.clinician.full_name)}
        </span>
      ) : (
        <span className="text-muted italic">Unassigned</span>
      );
    case "status":
      return <StatusBadge status={v.status} />;
    case "check":
      return <VerificationBadge value={verificationOf(v)} flags={visitFlags(v)} />;
    case "clock":
      return <ClockCell v={v} />;
    case "duration":
      return v.status === "completed" ? (
        <span className="whitespace-nowrap tabular-nums">{formatDuration(actualMs(v))}</span>
      ) : (
        <span className="whitespace-nowrap text-muted tabular-nums">{v.duration_minutes} min booked</span>
      );
    case "vitals":
      return reportOf(v) ? (
        <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">
          <HeartPulse className="size-3.5" aria-hidden /> Recorded
        </span>
      ) : (
        <span className="text-faint">—</span>
      );
  }
}

export function VisitTable({
  visits,
  columns,
  now,
  empty,
  caption,
}: {
  visits: VisitFull[];
  columns: VisitColumn[];
  now: number;
  empty: ReactNode;
  caption: string;
}) {
  const router = useRouter();
  if (visits.length === 0) return <>{empty}</>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-medium first:pl-5 last:pr-5">
                {HEAD[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr
              key={v.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a,button,select,input")) return;
                router.push(`/visits/${v.id}`);
              }}
              className={cx("cursor-pointer border-b border-line last:border-0 hover:bg-surface-2", v.status === "cancelled" && "text-muted")}
            >
              {columns.map((c) => (
                <td key={c} className="px-3 py-2.5 align-middle first:pl-5 last:pr-5">
                  {cell(c, v, now)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
