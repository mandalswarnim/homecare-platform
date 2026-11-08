"use client";

import { MapPin, MapPinOff, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useConsole } from "@/components/console-data";
import { Avatar, Badge, Card, EmptyState, ErrorNote, Nil, PageHeader, Spinner } from "@/components/ui";
import { formatFullDate, formatWhen } from "@/lib/format";
import { useNow } from "@/lib/live";
import type { PatientRecord, VisitFull } from "@/lib/types";
import { verificationOf } from "@/lib/visits";

type Row = {
  p: PatientRecord;
  completed: number;
  review: number;
  last: VisitFull | null;
  next: VisitFull | null;
};

export function PatientsView() {
  const { data, error, loading, reload } = useConsole();
  const router = useRouter();
  const now = useNow(60_000);
  const [q, setQ] = useState("");

  if (loading) return <Spinner label="Loading patients" />;
  if (!data) return <ErrorNote message={error ?? "Couldn't load patients."} onRetry={reload} />;

  const byPatient = new Map<string, VisitFull[]>();
  for (const v of data.visits) byPatient.set(v.patient_id, [...(byPatient.get(v.patient_id) ?? []), v]);

  const needle = q.trim().toLowerCase();
  const rows: Row[] = data.patients
    .filter((p) => !needle || (p.profile?.full_name ?? "").toLowerCase().includes(needle) || (p.address ?? "").toLowerCase().includes(needle) || (p.profile?.phone ?? "").includes(needle))
    .map((p) => {
      const visits = byPatient.get(p.id) ?? [];
      const done = visits.filter((v) => v.status === "completed");
      const upcoming = visits
        .filter((v) => (v.status === "accepted" || v.status === "requested" || v.status === "in_progress") && new Date(v.scheduled_start).getTime() > now - 3 * 3_600_000)
        .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
      return {
        p,
        completed: done.length,
        review: done.filter((v) => verificationOf(v) !== "verified").length,
        last: done.sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))[0] ?? null,
        next: upcoming[0] ?? null,
      };
    });
  const unpinned = data.patients.filter((p) => p.home_lat == null).length;

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${data.patients.length} registered in the app${unpinned ? `, ${unpinned} haven't pinned their home yet` : ""}`}
      />
      <div className="mb-5 max-w-md">
        <label className="relative block">
          <span className="sr-only">Search patients</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone or address"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pr-3 pl-10 text-sm text-ink shadow-panel transition-colors placeholder:text-faint hover:border-axis"
          />
        </label>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={UsersRound} title={needle ? "No patients match" : "No patients yet"} body={needle ? undefined : "Patients appear here when they sign up in the app."} />
        ) : (
          <div className="-mx-6 -mt-1 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Patients</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  {["Patient", "Address", "Home location", "Visits done", "Last visit", "Next visit"].map((h) => (
                    <th key={h} scope="col" className="px-3 pt-1 pb-2.5 font-medium first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, completed, review, last, next }) => (
                  <tr
                    key={p.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a")) router.push(`/patients/${p.id}`);
                    }}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.profile?.full_name} size={36} />
                        <div className="min-w-0">
                          <Link href={`/patients/${p.id}`} className="text-[15px] font-medium text-ink hover:underline">
                            {p.profile?.full_name || "Unnamed patient"}
                          </Link>
                          <div className="text-xs text-muted">{p.profile?.phone ?? "No phone"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-64 truncate px-3 py-3.5 text-ink-2">{p.address ?? <Nil />}</td>
                    <td className="px-3 py-3.5">
                      {p.home_lat != null ? (
                        <Badge tone="good" icon={MapPin} title={p.home_set_at ? `Pinned ${formatFullDate(p.home_set_at)}` : undefined}>
                          Pinned
                        </Badge>
                      ) : (
                        <Badge tone="warning" icon={MapPinOff}>
                          Not pinned
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums">
                      {completed}
                      {review ? <span className="ml-2.5 text-xs text-warning-text">{review} need review</span> : null}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-ink-2">{last ? formatWhen(last.scheduled_start, now) : <Nil />}</td>
                    <td className="px-3 py-3.5 pr-6 whitespace-nowrap text-ink-2">
                      {next ? (
                        <>
                          {formatWhen(next.scheduled_start, now)}
                          <div className="text-xs text-muted">{next.service_type}</div>
                        </>
                      ) : (
                        <Nil />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
