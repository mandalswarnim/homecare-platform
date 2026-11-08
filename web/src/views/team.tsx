"use client";

import { Phone, Stethoscope, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChartFrame } from "@/components/charts/core";
import { RankedBars } from "@/components/charts/ranked-bars";
import { useConsole } from "@/components/console-data";
import { Avatar, Badge, Card, cx, EmptyState, ErrorNote, Meta, Nil, PageHeader, Segmented, Spinner } from "@/components/ui";
import { formatDuration, formatHours, formatPct, formatTime, formatWhen, roleLabel } from "@/lib/format";
import { useNow } from "@/lib/live";
import { clinicianStats, periodOf, RANGES, type RangeKey } from "@/lib/metrics";
import { patientName } from "@/lib/visits";

/** A rate against its target: below target shows an icon and amber text, never colour alone. */
function Rate({ value, target }: { value: number | null; target: number }) {
  if (value == null) return <Nil />;
  if (value >= target) return <span className="text-ink">{formatPct(value)}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-warning-text" title={`Below the ${Math.round(target * 100)}% target`}>
      <TriangleAlert className="size-3.5" aria-label={`below the ${Math.round(target * 100)}% target`} />
      {formatPct(value)}
    </span>
  );
}

export function TeamView() {
  const { data, error, loading, reload } = useConsole();
  const now = useNow(30_000);
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");

  if (loading) return <Spinner label="Loading the team" />;
  if (!data) return <ErrorNote message={error ?? "Couldn't load the team."} onRetry={reload} />;

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const period = periodOf(range.days, now);
  const stats = clinicianStats(data.clinicians, data.visits, period.start, period.end, now).sort(
    (a, b) => Number(Boolean(b.current)) - Number(Boolean(a.current)) || b.completed - a.completed || a.clinician.full_name.localeCompare(b.clinician.full_name),
  );
  const onVisit = stats.filter((s) => s.current).length;

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={`${data.clinicians.length} clinicians, ${onVisit} on a visit now`}
        actions={<Segmented label="Date range" value={rangeKey} onChange={setRangeKey} options={RANGES.map((r) => ({ value: r.key, label: r.short }))} />}
      />

      <Card title="Clinicians" subtitle={`Figures for the ${range.label.toLowerCase()}`}>
        {stats.length === 0 ? (
          <EmptyState icon={Stethoscope} title="No clinicians yet" body="Doctor and nurse accounts are created by the office." />
        ) : (
          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <caption className="sr-only">Clinicians</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  {[
                    ["Clinician", false],
                    ["Right now", false],
                    ["Visits done", true],
                    ["Hours on site", true],
                    ["Location-verified", true],
                    ["On time", true],
                    ["Time to accept", true],
                    ["Declined", true],
                  ].map(([h, num]) => (
                    <th key={h as string} scope="col" className={cx("px-3 pt-1 pb-2.5 font-medium whitespace-nowrap first:pl-6 last:pr-6", num && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.clinician.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.clinician.full_name} size={36} />
                        <div className="min-w-0">
                          <div className="text-[15px] font-medium text-ink">{s.clinician.full_name}</div>
                          <Meta
                            className="mt-0.5 text-xs text-muted"
                            parts={[
                              roleLabel(s.clinician.role),
                              s.clinician.specialty,
                              s.clinician.phone ? (
                                <a href={`tel:${s.clinician.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                                  <Phone className="size-3" aria-hidden />
                                  {s.clinician.phone}
                                </a>
                              ) : null,
                            ]}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      {s.current ? (
                        <Link href={`/visits/${s.current.id}`} className="group block">
                          <Badge tone="good" lead={<span className="live-dot mr-0.5" aria-hidden />}>
                            On visit
                          </Badge>
                          <Meta
                            className="mt-1 text-xs text-muted group-hover:underline"
                            parts={[patientName(s.current), s.current.started_at ? formatDuration(now - new Date(s.current.started_at).getTime()) : formatTime(s.current.started_at)]}
                          />
                        </Link>
                      ) : s.next ? (
                        <Link href={`/visits/${s.next.id}`} className="block text-[13px] text-ink-2 hover:underline">
                          Next: {formatWhen(s.next.scheduled_start, now)}
                          <Meta className="mt-0.5 flex text-xs text-muted" parts={[patientName(s.next), s.next.status === "requested" ? "not accepted yet" : null]} />
                        </Link>
                      ) : (
                        <span className="text-[13px] text-muted">Free</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right text-[15px] tabular-nums">{s.completed}</td>
                    <td className="px-3 py-4 text-right text-[15px] tabular-nums">{formatHours(s.careMs)}</td>
                    <td className="px-3 py-4 text-right text-[15px] tabular-nums">
                      <Rate value={s.verifiedRate} target={0.9} />
                    </td>
                    <td className="px-3 py-4 text-right text-[15px] tabular-nums">
                      <Rate value={s.onTimeRate} target={0.8} />
                    </td>
                    <td className="px-3 py-4 text-right text-[15px] tabular-nums">{s.medianAcceptMin == null ? <Nil /> : `${Math.round(s.medianAcceptMin)} min`}</td>
                    <td className="px-3 py-4 pr-6 text-right text-[15px] tabular-nums">{s.declined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 -mb-1 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Location-verified: both clock-ins inside the patient&apos;s home area with good GPS (target 90%). On time: clocked in within 15 minutes of the booking.
          Figures below target are marked with a warning sign.
        </p>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame
          title="Hours on site"
          subtitle={range.label}
          table={{ columns: ["Clinician", "Hours on site"], numeric: [false, true], rows: stats.map((s) => [s.clinician.full_name, formatHours(s.careMs)]) }}
        >
          <RankedBars
            items={stats
              .filter((s) => s.careMs > 0)
              .map((s) => ({ key: s.clinician.id, label: s.clinician.full_name, value: Math.round((s.careMs / 3_600_000) * 10) / 10 }))
              .sort((a, b) => b.value - a.value)}
            format={(n) => `${n} h`}
            unit="hours"
          />
        </ChartFrame>
        <ChartFrame
          title="Visits completed"
          subtitle={range.label}
          table={{ columns: ["Clinician", "Visits completed"], numeric: [false, true], rows: stats.map((s) => [s.clinician.full_name, s.completed]) }}
        >
          <RankedBars
            items={stats
              .filter((s) => s.completed > 0)
              .map((s) => ({ key: s.clinician.id, label: s.clinician.full_name, value: s.completed }))
              .sort((a, b) => b.value - a.value)}
            unit="visits"
          />
        </ChartFrame>
      </div>
    </>
  );
}
