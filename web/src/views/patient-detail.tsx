"use client";

import { CalendarClock, FileText, HeartPulse, MapPinOff, Phone, Receipt, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ChartFrame } from "@/components/charts/core";
import { TrendChart, type TrendSeries } from "@/components/charts/trend-chart";
import { MapView } from "@/components/map";
import { StatusBadge } from "@/components/status";
import { BackLink, Card, cx, EmptyState, ErrorNote, Field, PageHeader, Spinner } from "@/components/ui";
import { VisitTable } from "@/components/visit-table";
import { readings } from "@/components/vitals";
import { age, formatFullDate, formatShortDay, formatWhen, shortName } from "@/lib/format";
import { useLiveQuery, useNow } from "@/lib/live";
import { loadPatient, type PatientDetailData } from "@/lib/queries";
import type { VisitFull, VisitReport } from "@/lib/types";
import { isUuid, reportOf } from "@/lib/visits";

const EMPTY: PatientDetailData = { patient: null, visits: [] };

export function PatientDetailView() {
  const { id } = useParams<{ id: string }>();
  const valid = isUuid(id);
  const query = useLiveQuery(`patient:${id}`, () => (valid ? loadPatient(id) : Promise.resolve(EMPTY)), valid ? [{ table: "visits", filter: `patient_id=eq.${id}` }] : []);
  const now = useNow(60_000);

  if (query.loading) return <Spinner label="Loading the patient" />;
  if (!query.data) return <ErrorNote message={query.error ?? "Couldn't load the patient."} onRetry={query.reload} />;
  const { patient: p, visits } = query.data;
  if (!p) {
    return (
      <>
        <PageHeader title="Patient not found" back={<BackLink href="/patients">Patients</BackLink>} />
        <Card>
          <EmptyState icon={UserRound} title="This patient doesn't exist" />
        </Card>
      </>
    );
  }

  const name = p.profile?.full_name || "Unnamed patient";
  const years = age(p.date_of_birth, now);
  const withReports = visits
    .filter((v) => v.status === "completed" && reportOf(v))
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const upcoming = visits
    .filter((v) => ["requested", "accepted", "in_progress", "declined"].includes(v.status) && new Date(v.scheduled_start).getTime() > now - 3 * 3_600_000)
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const history = visits.filter((v) => !upcoming.includes(v));

  return (
    <>
      <PageHeader
        back={<BackLink href="/patients">Patients</BackLink>}
        title={name}
        subtitle={[years != null ? `${years} years old` : null, p.profile?.phone, p.address].filter(Boolean).join(" · ") || "Patient"}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <VisitResults visits={withReports.slice().reverse()} now={now} />
          <VitalsTrends visits={withReports} />
          <Card title="Visit history" subtitle={`${history.length} visit${history.length === 1 ? "" : "s"}`}>
            <VisitTable
              visits={history}
              now={now}
              caption={`${name}'s visit history`}
              columns={["when", "service", "clinician", "status", "check", "duration"]}
              empty={<EmptyState icon={CalendarClock} title="No visits yet" />}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Home" subtitle={p.home_lat != null && p.home_set_at ? `Pinned ${formatFullDate(p.home_set_at)} · verified area ${p.geofence_radius_m} m` : undefined}>
            {p.home_lat != null && p.home_lng != null ? (
              <MapView
                pins={[{ id: "home", lat: p.home_lat, lng: p.home_lng, kind: "home", label: `${name}'s home`, sublabel: p.address ?? undefined }]}
                circles={[{ id: "fence", lat: p.home_lat, lng: p.home_lng, radius: p.geofence_radius_m, kind: "geofence" }]}
                ariaLabel={`${name}'s pinned home`}
                fitKey={p.id}
                className="h-[220px] w-full overflow-hidden rounded-lg"
              />
            ) : (
              <EmptyState icon={MapPinOff} title="Home not pinned yet" body="Ask the patient to open the app at home and tap “Pin my home”. Until then clock-ins can't be location-verified." />
            )}
          </Card>

          <Card title="Details">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
              <Field label="Date of birth">{p.date_of_birth ? formatFullDate(`${p.date_of_birth}T00:00:00`) : "—"}</Field>
              <Field label="Registered">{p.profile?.created_at ? formatFullDate(p.profile.created_at) : "—"}</Field>
              <div className="col-span-2">
                <Field label="Emergency contact">{p.emergency_contact ?? "—"}</Field>
              </div>
              {p.profile?.phone ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Phone</dt>
                  <dd>
                    <a href={`tel:${p.profile.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                      <Phone className="size-3.5" aria-hidden /> {p.profile.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {p.notes ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Office notes</dt>
                  <dd className="mt-0.5 text-sm whitespace-pre-line text-ink">{p.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Coming up">
            {upcoming.length ? (
              <ul className="space-y-1">
                {upcoming.map((v) => (
                  <li key={v.id}>
                    <Link href={`/visits/${v.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{v.service_type}</span>
                        <span className="block text-xs text-muted">
                          {formatWhen(v.scheduled_start, now)} · {v.clinician ? shortName(v.clinician.full_name) : "Unassigned"}
                        </span>
                      </span>
                      <StatusBadge status={v.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Nothing booked.</p>
            )}
          </Card>

          <Card title="Invoices" subtitle="Next phase">
            <div className="flex gap-3">
              <Receipt className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <p className="text-[13px] text-ink-2">Invoices will be generated from completed visits once service prices are set, and the patient will see them in the app.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────── Visit results (vitals table) ───────────────────────────── */

function VisitResults({ visits, now }: { visits: VisitFull[]; now: number }) {
  return (
    <Card title="Visit results" subtitle="Vitals recorded at each visit — what the patient sees in their app">
      {visits.length === 0 ? (
        <EmptyState icon={HeartPulse} title="No results yet" body="Vitals appear here after a clinician completes a visit." />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Visit results</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {["Visit", "Blood pressure", "Pulse", "Temp", "SpO₂", "Glucose", "Notes"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const r = reportOf(v) as VisitReport;
                const list = readings(r);
                const get = (label: string) => list.find((x) => x.label === label);
                return (
                  <tr key={v.id} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-2.5 pl-5">
                      <Link href={`/visits/${v.id}`} className="font-medium whitespace-nowrap text-ink hover:underline">
                        {formatWhen(v.scheduled_start, now)}
                      </Link>
                      <div className="text-xs text-muted">
                        {v.service_type} · {shortName(v.clinician?.full_name)}
                      </div>
                    </td>
                    {["Blood pressure", "Pulse", "Temperature", "Oxygen (SpO₂)", "Blood glucose"].map((label) => {
                      const x = get(label);
                      return (
                        <td key={label} className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                          {x ? (
                            <span className={cx("inline-flex items-center gap-1", x.outside ? "font-medium text-warning-text" : "text-ink")} title={x.outside ? `Outside typical range (${x.range})` : undefined}>
                              {x.outside ? <TriangleAlert className="size-3.5" aria-label="Outside typical range" /> : null}
                              {x.value} <span className="text-xs font-normal text-muted">{x.unit}</span>
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="max-w-64 px-3 py-2.5 pr-5 text-[13px] text-ink-2">
                      {r.notes ? (
                        <span className="line-clamp-2" title={r.notes}>
                          <FileText className="mr-1 inline size-3.5 text-muted" aria-hidden />
                          {r.notes}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────────── Vitals over time (small multiples) ───────────────────────────── */

function VitalsTrends({ visits }: { visits: VisitFull[] }) {
  const reports = visits.map((v) => ({ v, r: reportOf(v) as VisitReport }));
  const labels = reports.map(({ v }) => formatShortDay(v.scheduled_start));
  const titles = reports.map(({ v }) => `${formatWhen(v.scheduled_start)} · ${v.service_type}`);
  const pick = (f: (r: VisitReport) => number | null) => reports.map(({ r }) => (f(r) == null ? null : Number(f(r))));
  const count = (vals: (number | null)[]) => vals.filter((x) => x != null).length;

  type ChartDef = { key: string; title: string; unit: string; series: TrendSeries[]; format?: (n: number) => string };
  const defs: ChartDef[] = [
    {
      key: "bp",
      title: "Blood pressure",
      unit: "mmHg",
      series: [
        { key: "sys", label: "Systolic", color: "var(--series-1)", values: pick((r) => r.bp_systolic) },
        { key: "dia", label: "Diastolic", color: "var(--series-2)", values: pick((r) => r.bp_diastolic) },
      ],
    },
    { key: "pulse", title: "Pulse", unit: "bpm", series: [{ key: "pulse", label: "Pulse", color: "var(--series-1)", values: pick((r) => r.pulse_bpm) }] },
    { key: "spo2", title: "Oxygen (SpO₂)", unit: "%", series: [{ key: "spo2", label: "SpO₂", color: "var(--series-1)", values: pick((r) => r.spo2_pct) }] },
    {
      key: "temp",
      title: "Temperature",
      unit: "°C",
      format: (n) => n.toFixed(1),
      series: [{ key: "temp", label: "Temperature", color: "var(--series-1)", values: pick((r) => r.temperature_c) }],
    },
    {
      key: "glucose",
      title: "Blood glucose",
      unit: "mmol/L",
      format: (n) => n.toFixed(1),
      series: [{ key: "glucose", label: "Glucose", color: "var(--series-1)", values: pick((r) => r.glucose_mmol) }],
    },
  ];
  const charts = defs.filter((c) => c.series.some((s) => count(s.values) >= 2));

  if (charts.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {charts.map((c) => (
        <ChartFrame
          key={c.key}
          title={c.title}
          subtitle={`${c.unit} · per visit`}
          legend={c.series.length > 1 ? c.series.map((s) => ({ label: s.label, color: s.color, mark: "line" as const })) : undefined}
          table={{
            columns: ["Visit", ...c.series.map((s) => `${s.label} (${c.unit})`)],
            numeric: [false, ...c.series.map(() => true)],
            rows: titles.map((t, i) => [t, ...c.series.map((s) => (s.values[i] == null ? "—" : (c.format ?? String)(s.values[i] as number)))]),
          }}
        >
          <TrendChart
            series={c.series}
            labels={labels}
            titles={titles}
            unit={c.unit}
            format={c.format}
            ariaLabel={`${c.title} across ${labels.length} visits`}
          />
        </ChartFrame>
      ))}
    </div>
  );
}
