"use client";

import { CircleCheck, Phone, TriangleAlert } from "lucide-react";
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
import { Avatar, Button, Card, cx, EmptyState, ErrorNote, PageHeader, Segmented, Spinner } from "@/components/ui";
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
      <PageHeader title="Overview" subtitle={`${formatLongDay(new Date(now))}, ${data.patients.length} patients and ${data.clinicians.length} clinicians`} />
      {error ? (
        <div className="mb-5">
          <ErrorNote message={`Couldn't refresh (${error}). Showing the last data loaded.`} onRetry={reload} />
        </div>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-12">
        <AttentionCard data={data} now={now} onChanged={reload} className="xl:col-span-8" />
        <div className="grid gap-5 xl:col-span-4">
          <OnVisitNow data={data} now={now} />
          <ActivityCard data={data} now={now} />
        </div>
      </div>
      <LiveMap data={data} now={now} />
      <TodayCard visits={data.visits} now={now} className="mt-5" />
      <Performance data={data} now={now} />
    </>
  );
}

/* ───────────────────────────── Right now ───────────────────────────── */

function OnVisitNow({ data, now, className }: { data: ConsoleData; now: number; className?: string }) {
  const active = data.visits.filter((v) => v.status === "in_progress");
  const today = data.visits.filter((v) => sameDay(v.scheduled_start, now) && v.status !== "cancelled");
  const done = today.filter((v) => v.status === "completed").length;
  const toGo = today.filter((v) => v.status === "accepted" || v.status === "requested").length;

  return (
    <Card title="On a visit now" className={className}>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[56px] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums">{active.length}</span>
        <span className="text-[15px] text-muted">of {data.clinicians.length} clinicians</span>
      </div>
      <dl className="mt-6 grid grid-cols-3 border-y border-line">
        {[
          ["Today", today.length],
          ["Done", done],
          ["To go", toGo],
        ].map(([label, value], i) => (
          <div key={label} className={cx("py-3.5", i > 0 && "border-l border-line pl-4")}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-[22px] leading-none font-medium text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <ActiveList visits={active} />
    </Card>
  );
}

function LiveMap({ data, now }: { data: ConsoleData; now: number }) {
  const router = useRouter();
  const pins = useMemo(() => buildPins(data.visits, now), [data.visits, now]);
  const fitKey = pins
    .map((p) => p.id)
    .sort()
    .join("|");

  return (
    <section aria-labelledby="map-title" className="mt-5 overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel">
      <div className="flex flex-col gap-3 px-6 pt-5 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 id="map-title" className="text-[16px] font-semibold text-ink">
            Live map
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">Clock-ins are checked against each patient&apos;s pinned home</p>
        </div>
        <MapLegend
          items={[
            { kind: "live", label: "On a visit now" },
            { kind: "home", label: "Visit later today" },
            { kind: "ok", label: "Done today, verified" },
            { kind: "flag", label: "Done today, needs review" },
          ]}
        />
      </div>
      <MapView
        pins={pins}
        ariaLabel="Map of clinicians on visits and today's patient homes"
        fitKey={fitKey}
        onSelect={(p) => p.visitId && router.push(`/visits/${p.visitId}`)}
        className="h-[360px] w-full overflow-hidden border-t border-line lg:h-[440px]"
      />
    </section>
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
        sublabel: `With ${patientName(v)} since ${formatTime(v.started_at)}`,
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
        sublabel: `Done ${formatTime(v.ended_at)}, ${ok ? "location verified" : "needs review"}`,
        visitId: v.id,
      });
    } else if ((v.status === "accepted" || v.status === "requested") && home) {
      pins.push({
        id: `home:${v.id}`,
        ...home,
        kind: "home",
        label: patientName(v),
        sublabel: `${formatTime(v.scheduled_start)}, ${v.service_type}, ${v.clinician ? shortName(v.clinician.full_name) : "unassigned"}`,
        visitId: v.id,
      });
    }
  }
  return pins;
}

function ActiveList({ visits }: { visits: VisitFull[] }) {
  const now = useNow(15_000);
  if (visits.length === 0) return <p className="mt-5 text-sm text-muted">No one is on a visit right now.</p>;
  return (
    <ul className="mt-4 -mb-2 space-y-0.5">
      {visits.map((v) => {
        const clockIn = eventOf(v, "clock_in");
        return (
          <li key={v.id}>
            <Link href={`/visits/${v.id}`} className="-mx-2.5 flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 transition-colors hover:bg-surface-2">
              <Avatar name={v.clinician?.full_name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">
                  {shortName(v.clinician?.full_name)} <span className="font-normal text-muted">with</span> {patientName(v)}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-muted tabular-nums">
                  <span>{v.started_at ? `${formatDuration(now - new Date(v.started_at).getTime())} on site` : "Clocked in"}</span>
                  <span>{v.service_type}</span>
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
      title={
        <span className="flex items-center gap-2.5">
          Needs attention
          {items.length ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-xs font-semibold text-surface tabular-nums">
              <span className="sr-only">: </span>
              {items.length}
              <span className="sr-only"> item{items.length === 1 ? "" : "s"} for the office</span>
            </span>
          ) : null}
        </span>
      }
      subtitle={items.length ? undefined : "Requests, late arrivals and flagged clock-ins"}
      className={className}
    >
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="All clear" body="No unanswered requests, late arrivals or flagged clock-ins." />
      ) : (
        <ul className="-mt-1 divide-y divide-line">
          {shown.map((it) => (
            <AttentionRow key={it.id} item={it} clinicians={data.clinicians} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {items.length > 6 ? (
        <div className="mt-2 -mb-2 border-t border-line pt-2">
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
    <li className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 gap-4">
        <SeverityTag severity={item.severity} className="mt-px w-[5.75rem] shrink-0 justify-center" />
        <div className="min-w-0">
          <Link href={`/visits/${item.visit.id}`} className="text-[15px] leading-snug font-medium text-ink hover:underline">
            {item.title}
          </Link>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted">
            {item.detail.split(" · ").map((part, i) => (
              <span key={i} className={i === 0 ? "text-ink-2" : undefined}>
                {part}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="shrink-0 md:pl-4">
        {item.action === "assign" ? (
          <AssignControl visit={item.visit} clinicians={clinicians} onDone={onChanged} />
        ) : item.action === "call" && phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 active:bg-surface-3"
          >
            <Phone className="size-4" aria-hidden /> Call {shortName(item.visit.clinician?.full_name)}
          </a>
        ) : (
          <Link
            href={`/visits/${item.visit.id}`}
            className="inline-flex h-8 items-center rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 active:bg-surface-3"
          >
            Review
          </Link>
        )}
      </div>
    </li>
  );
}

/* ───────────────────────────── Today ───────────────────────────── */

function ActivityCard({ data, now, className }: { data: ConsoleData; now: number; className?: string }) {
  const [more, setMore] = useState(false);
  return (
    <Card title="Activity" className={className}>
      <ActivityFeed items={data.activity} clinicians={data.clinicians} now={now} limit={more ? 12 : 6} />
      {data.activity.length > 6 ? (
        <div className="mt-2 -mb-2 border-t border-line pt-2">
          <Button size="sm" variant="ghost" onClick={() => setMore((m) => !m)}>
            {more ? "Show less" : "Show more"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function TodayCard({ visits, now, className }: { visits: VisitFull[]; now: number; className?: string }) {
  const today = visits.filter((v) => sameDay(v.scheduled_start, now) || v.status === "in_progress");
  return (
    <Card
      title="Today's schedule"
      subtitle={`${today.length} visit${today.length === 1 ? "" : "s"}`}
      className={className}
      action={
        <Link href="/visits?when=today" className="inline-flex h-8 items-center rounded-[9px] px-2 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft">
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
    <section aria-labelledby="perf-title" className="mt-14 border-t border-line pt-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="perf-title" className="font-display text-[26px] font-medium tracking-[-0.012em] text-ink">
            Performance
          </h2>
          <p className="mt-1 text-[15px] text-muted">Completed visits, verification and response times, {range.label.toLowerCase()}</p>
        </div>
        <Segmented label="Date range" value={rangeKey} onChange={setRangeKey} options={RANGES.map((r) => ({ value: r.key, label: r.short }))} />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line shadow-panel md:grid-cols-3 xl:grid-cols-6 [&>*]:bg-surface">
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
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-warning-text">
              <TriangleAlert className="size-3" aria-hidden /> Below the 90% target
            </p>
          ) : null}
        </StatTile>
        <StatTile label="On-time arrivals" value={formatPct(cur.onTimeRate)} note="Clocked in within 15 min of the booking" />
        <StatTile
          label="Time to accept"
          value={cur.medianAcceptMin == null ? "None yet" : cur.medianAcceptMin < 90 ? `${Math.round(cur.medianAcceptMin)} min` : formatHours(cur.medianAcceptMin * MS.MIN)}
          note="Median, from booking to a clinician confirming"
        />
        <StatTile label="Patients served" value={formatInt(cur.patientsServed)} note={`of ${data.patients.length} registered`} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
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

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
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
          <dl className="grid grid-cols-2 border-y border-line">
            <div className="py-3.5">
              <dt className="text-xs text-muted">Billable visits</dt>
              <dd className="mt-1 text-[22px] leading-none font-medium text-ink tabular-nums">{formatInt(cur.completed)}</dd>
            </div>
            <div className="border-l border-line py-3.5 pl-4">
              <dt className="text-xs text-muted">Billable hours</dt>
              <dd className="mt-1 text-[22px] leading-none font-medium text-ink tabular-nums">{formatHours(cur.careMs)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">{range.label}</p>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Next phase: set a price for each service, and invoices are created from completed, verified visits. Then revenue shows here and
            patients see their invoices in the app.
          </p>
        </Card>
      </div>
    </section>
  );
}

