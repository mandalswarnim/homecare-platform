"use client";

import { CircleCheck, Phone, Receipt, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ActivityFeed } from "@/components/activity-feed";
import { AssignControl } from "@/components/assign-control";
import { ChartFrame } from "@/components/charts/core";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StackedColumns } from "@/components/charts/stacked-columns";
import { Meter, Sparkline, StatTile, type MeterLevel } from "@/components/charts/stat-tile";
import { useConsole } from "@/components/console-data";
import { MapLegend, MapView, type MapPin } from "@/components/map";
import { SeverityTag, VerificationBadge } from "@/components/status";
import { Avatar, Button, Card, EmptyState, ErrorNote, PageHeader, Segmented, Spinner } from "@/components/ui";
import { VisitTable } from "@/components/visit-table";
import { needsAttention, type AttentionItem } from "@/lib/attention";
import {
  formatDuration,
  formatHours,
  formatInt,
  formatLongDay,
  formatPct,
  formatShortDay,
  formatTime,
  formatWeekday,
  initials,
  MS,
  sameDay,
  shortName,
} from "@/lib/format";
import { useNow } from "@/lib/live";
import { byService, clinicianStats, dailySeries, periodOf, RANGES, summarize, type RangeKey } from "@/lib/metrics";
import type { ConsoleData } from "@/lib/queries";
import type { Clinician, VisitFull } from "@/lib/types";
import { eventOf, patientName, verificationOf } from "@/lib/visits";

export function OverviewView() {
  const { data, error, loading, reload } = useConsole();
  const now = useNow(30_000);

  if (loading) return <Spinner label="Loading the console" />;
  if (!data) return <ErrorNote message={error ?? "Couldn't load the console."} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Overview" subtitle={`${formatLongDay(new Date(now))} · ${data.patients.length} patients · ${data.clinicians.length} clinicians`} />
      {error ? (
        <div className="mb-4">
          <ErrorNote message={`Couldn't refresh (${error}). Showing the last data loaded.`} onRetry={reload} />
        </div>
      ) : null}
      <RightNow data={data} now={now} />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        <AttentionCard data={data} now={now} onChanged={reload} className="xl:col-span-2" />
        <Card title="Activity" subtitle="Updates as it happens">
          <ActivityFeed items={data.activity} clinicians={data.clinicians} now={now} />
        </Card>
      </div>
      <TodayCard visits={data.visits} now={now} />
      <Performance data={data} now={now} />
    </>
  );
}

/* ───────────────────────────── Right now ───────────────────────────── */

function RightNow({ data, now }: { data: ConsoleData; now: number }) {
  const router = useRouter();
  const active = data.visits.filter((v) => v.status === "in_progress");
  const today = data.visits.filter((v) => sameDay(v.scheduled_start, now) && v.status !== "cancelled");
  const done = today.filter((v) => v.status === "completed").length;
  const toGo = today.filter((v) => v.status === "accepted" || v.status === "requested").length;

  const pins = useMemo(() => buildPins(data.visits, now), [data.visits, now]);
  const fitKey = pins
    .map((p) => p.id)
    .sort()
    .join("|");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="On a visit now" subtitle="Clinicians clocked in at a patient's home">
        <div className="flex items-end gap-3">
          <span className="text-6xl leading-none font-semibold tracking-tight text-ink">{active.length}</span>
          <span className="pb-1 text-sm text-muted">
            of {data.clinicians.length} clinicians
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-center">
          {[
            ["Today", today.length],
            ["Done", done],
            ["To go", toGo],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-lg font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <ActiveList visits={active} />
      </Card>

      <Card
        title="Live map"
        subtitle="Clock-ins are checked against each patient's pinned home"
        className="lg:col-span-2"
        bodyClassName="px-5 pt-3 pb-4"
      >
        <MapView
          pins={pins}
          ariaLabel="Map of clinicians on visits and today's patient homes"
          fitKey={fitKey}
          onSelect={(p) => p.visitId && router.push(`/visits/${p.visitId}`)}
          className="h-[340px] w-full overflow-hidden rounded-lg lg:h-[400px]"
        />
        <div className="mt-3">
          <MapLegend
            items={[
              { kind: "live", label: "On a visit now" },
              { kind: "home", label: "Visit later today" },
              { kind: "ok", label: "Done today · verified" },
              { kind: "flag", label: "Done today · needs review" },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

function buildPins(visits: VisitFull[], now: number): MapPin[] {
  const pins: MapPin[] = [];
  for (const v of visits) {
    const home = v.patient && v.patient.home_lat != null && v.patient.home_lng != null ? { lat: v.patient.home_lat, lng: v.patient.home_lng } : null;
    const clockIn = eventOf(v, "clock_in");
    const at = clockIn?.lat != null && clockIn.lng != null ? { lat: clockIn.lat, lng: clockIn.lng } : home;
    const who = v.clinician?.full_name ?? "Unassigned";
    if (v.status === "in_progress" && at) {
      pins.push({
        id: `live:${v.id}`,
        ...at,
        kind: "live",
        text: initials(who),
        label: who,
        sublabel: `With ${patientName(v)} · since ${formatTime(v.started_at)}`,
        visitId: v.id,
      });
    } else if (!sameDay(v.scheduled_start, now)) {
      continue;
    } else if (v.status === "completed" && at) {
      const ok = verificationOf(v) === "verified";
      pins.push({
        id: `done:${v.id}`,
        ...at,
        kind: ok ? "ok" : "flag",
        label: `${shortName(who)} at ${patientName(v)}`,
        sublabel: `Done ${formatTime(v.ended_at)} · ${ok ? "location verified" : "needs review"}`,
        visitId: v.id,
      });
    } else if ((v.status === "accepted" || v.status === "requested") && home) {
      pins.push({
        id: `home:${v.id}`,
        ...home,
        kind: "home",
        label: patientName(v),
        sublabel: `${formatTime(v.scheduled_start)} · ${v.service_type} · ${v.clinician ? shortName(v.clinician.full_name) : "unassigned"}`,
        visitId: v.id,
      });
    }
  }
  return pins;
}

function ActiveList({ visits }: { visits: VisitFull[] }) {
  const now = useNow(15_000);
  if (visits.length === 0) return <p className="mt-4 text-sm text-muted">No one is on a visit right now.</p>;
  return (
    <ul className="mt-4 space-y-1">
      {visits.map((v) => {
        const clockIn = eventOf(v, "clock_in");
        return (
          <li key={v.id}>
            <Link href={`/visits/${v.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
              <Avatar name={v.clinician?.full_name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {shortName(v.clinician?.full_name)} <span className="font-normal text-muted">with</span> {patientName(v)}
                </span>
                <span className="block text-xs text-muted tabular-nums">
                  {v.started_at ? `${formatDuration(now - new Date(v.started_at).getTime())} on site` : "Clocked in"} · {v.service_type}
                </span>
              </span>
              {clockIn ? <VerificationBadge value={clockIn.verified ? "verified" : "flagged"} flags={clockIn.flags} /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────────── Needs attention ───────────────────────────── */

function AttentionCard({ data, now, onChanged, className }: { data: ConsoleData; now: number; onChanged: () => void; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const items = needsAttention(data.visits, now);
  const shown = expanded ? items : items.slice(0, 6);
  return (
    <Card
      title="Needs attention"
      subtitle={items.length ? `${items.length} item${items.length === 1 ? "" : "s"} for the office` : "Requests, late arrivals and flagged clock-ins"}
      className={className}
    >
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="All clear" body="No unanswered requests, late arrivals or flagged clock-ins." />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((it) => (
            <AttentionRow key={it.id} item={it} clinicians={data.clinicians} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {items.length > 6 ? (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show fewer" : `Show all ${items.length}`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function AttentionRow({ item, clinicians, onChanged }: { item: AttentionItem; clinicians: Clinician[]; onChanged: () => void }) {
  const phone = item.visit.clinician?.phone;
  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 gap-3">
        <SeverityTag severity={item.severity} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <Link href={`/visits/${item.visit.id}`} className="text-sm font-medium text-ink hover:underline">
            {item.title}
          </Link>
          <p className="mt-0.5 text-[13px] text-muted">{item.detail}</p>
        </div>
      </div>
      <div className="shrink-0 md:pl-4">
        {item.action === "assign" ? (
          <AssignControl visit={item.visit} clinicians={clinicians} onDone={onChanged} />
        ) : item.action === "call" && phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2"
          >
            <Phone className="size-4" aria-hidden /> Call {shortName(item.visit.clinician?.full_name)}
          </a>
        ) : (
          <Link
            href={`/visits/${item.visit.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2"
          >
            Review
          </Link>
        )}
      </div>
    </li>
  );
}

/* ───────────────────────────── Today ───────────────────────────── */

function TodayCard({ visits, now }: { visits: VisitFull[]; now: number }) {
  const today = visits.filter((v) => sameDay(v.scheduled_start, now) || v.status === "in_progress");
  return (
    <Card
      title="Today's schedule"
      subtitle={`${today.length} visit${today.length === 1 ? "" : "s"}`}
      className="mt-4"
      action={
        <Link href="/visits?when=today" className="text-[13px] font-medium text-brand hover:underline">
          Open in visits
        </Link>
      }
    >
      <VisitTable
        visits={today}
        columns={["time", "patient", "service", "clinician", "status", "clock", "check"]}
        now={now}
        caption="Today's visits"
        empty={<EmptyState icon={CircleCheck} title="Nothing scheduled today" />}
      />
    </Card>
  );
}

/* ───────────────────────────── Performance ───────────────────────────── */

const SERIES = [
  { key: "verified", label: "Location verified", color: "var(--series-1)" },
  { key: "review", label: "Needs review", color: "var(--series-2)" },
];

function meterLevel(rate: number | null): MeterLevel {
  if (rate == null || rate >= 0.9) return "accent";
  return rate >= 0.75 ? "warning" : "critical";
}

function signed(n: number, suffix = "") {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}${suffix}`;
}

function Performance({ data, now }: { data: ConsoleData; now: number }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0];
  const period = periodOf(range.days, now);
  const cur = summarize(data.visits, period.start, period.end);
  const prev = summarize(data.visits, period.prevStart, period.start);
  const days = dailySeries(data.visits, period.days);
  const services = byService(data.visits, period.start, period.end);
  const team = clinicianStats(data.clinicians, data.visits, period.start, period.end, now)
    .filter((s) => s.completed > 0)
    .sort((a, b) => b.completed - a.completed);
  const dayLabel = (d: Date) => (range.days <= 7 ? formatWeekday(d) : formatShortDay(d));
  const level = meterLevel(cur.verifiedRate);
  const prevName = `previous ${range.short}`;

  return (
    <section aria-labelledby="perf-title" className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="perf-title" className="text-lg font-semibold text-ink">
            Performance
          </h2>
          <p className="text-sm text-muted">Completed visits, verification and response times · {range.label.toLowerCase()}</p>
        </div>
        <Segmented label="Date range" value={rangeKey} onChange={setRangeKey} options={RANGES.map((r) => ({ value: r.key, label: r.short }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Visits completed" value={formatInt(cur.completed)} delta={{ value: cur.completed - prev.completed, text: signed(cur.completed - prev.completed), upIsGood: true, period: prevName }}>
          <Sparkline values={days.map((d) => d.verified + d.review)} labels={days.map((d) => dayLabel(d.date))} />
        </StatTile>
        <StatTile
          label="Care delivered"
          value={formatHours(cur.careMs)}
          delta={{ value: cur.careMs - prev.careMs, text: signed((cur.careMs - prev.careMs) / MS.HOUR, " h"), upIsGood: true, period: prevName }}
        >
          <Sparkline values={days.map((d) => Math.round((d.careMs / MS.HOUR) * 10) / 10)} labels={days.map((d) => dayLabel(d.date))} format={(n) => `${n} h`} />
        </StatTile>
        <StatTile label="Location-verified" value={formatPct(cur.verifiedRate)} note={cur.needsReview ? `${cur.needsReview} visit${cur.needsReview === 1 ? "" : "s"} need review` : "Every visit verified"}>
          <Meter value={cur.verifiedRate ?? 0} level={level} label="Share of completed visits with verified clock-in and clock-out" />
          {level !== "accent" ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-warning-text">
              <TriangleAlert className="size-3" aria-hidden /> Below the 90% target
            </p>
          ) : null}
        </StatTile>
        <StatTile label="On-time arrivals" value={formatPct(cur.onTimeRate)} note="Clocked in within 15 min of the booking" />
        <StatTile
          label="Time to accept"
          value={cur.medianAcceptMin == null ? "—" : cur.medianAcceptMin < 90 ? `${Math.round(cur.medianAcceptMin)} min` : formatHours(cur.medianAcceptMin * MS.MIN)}
          note="Median, from booking to a clinician confirming"
        />
        <StatTile label="Patients served" value={formatInt(cur.patientsServed)} note={`of ${data.patients.length} registered`} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Completed visits per day"
          subtitle="Split by whether both clock-ins were verified at the patient's home"
          className="lg:col-span-2"
          legend={SERIES.map((s) => ({ label: s.label, color: s.color }))}
          table={{
            columns: ["Day", "Location verified", "Needs review", "Total"],
            numeric: [false, true, true, true],
            rows: days.map((d) => [formatShortDay(d.date), d.verified, d.review, d.verified + d.review]),
          }}
        >
          <StackedColumns
            series={SERIES}
            ariaLabel={`Completed visits per day, ${range.label.toLowerCase()}: ${cur.completed} in total, ${cur.needsReview} needing review`}
            data={days.map((d) => ({ key: d.key, axisLabel: dayLabel(d.date), title: formatLongDay(d.date), values: [d.verified, d.review] }))}
          />
        </ChartFrame>
        <ChartFrame
          title="Visits by service"
          subtitle="Completed visits"
          table={{ columns: ["Service", "Completed visits"], numeric: [false, true], rows: services.map((s) => [s.label, s.value]) }}
        >
          {services.length ? <RankedBars items={services} unit="visits" /> : <p className="py-8 text-center text-sm text-muted">No completed visits in this range.</p>}
        </ChartFrame>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Visits by clinician"
          subtitle="Completed visits and hours on site"
          className="lg:col-span-2"
          table={{
            columns: ["Clinician", "Completed visits", "Hours on site", "Location-verified"],
            numeric: [false, true, true, true],
            rows: team.map((t) => [t.clinician.full_name, t.completed, formatHours(t.careMs), formatPct(t.verifiedRate)]),
          }}
          footer={
            <Link href="/team" className="font-medium text-brand hover:underline">
              Team details
            </Link>
          }
        >
          {team.length ? (
            <RankedBars items={team.map((t) => ({ key: t.clinician.id, label: t.clinician.full_name, value: t.completed, detail: `${formatHours(t.careMs)} on site` }))} unit="visits" />
          ) : (
            <p className="py-8 text-center text-sm text-muted">No completed visits in this range.</p>
          )}
        </ChartFrame>
        <Card title="Revenue" subtitle="Not connected yet">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
              <Receipt className="size-4" aria-hidden />
            </span>
            <p className="text-[13px] text-ink-2">
              Next phase: set a price for each service, and invoices are created from completed, verified visits — then revenue shows here and
              patients see their invoices in the app.
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            <div>
              <dt className="text-xs text-muted">Billable visits</dt>
              <dd className="text-lg font-semibold text-ink">{formatInt(cur.completed)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Billable hours</dt>
              <dd className="text-lg font-semibold text-ink">{formatHours(cur.careMs)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">{range.label}</p>
        </Card>
      </div>
    </section>
  );
}

