"use client";

import { ClipboardList, Download, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useConsole } from "@/components/console-data";
import { Button, Card, cx, EmptyState, ErrorNote, PageHeader, Segmented, Select, Spinner } from "@/components/ui";
import { VisitTable } from "@/components/visit-table";
import { downloadCsv } from "@/lib/csv";
import { addDays, dayKey, MS, startOfDay } from "@/lib/format";
import { useNow } from "@/lib/live";
import type { VisitFull, VisitStatus } from "@/lib/types";
import { actualMs, eventOf, patientName, reportOf, STATUS_LABEL, STATUS_ORDER, verificationOf } from "@/lib/visits";

type When = "upcoming" | "today" | "7d" | "30d" | "all";

const WHEN: { value: When; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All" },
];

const asWhen = (v: string | null): When => (WHEN.some((w) => w.value === v) ? (v as When) : "upcoming");

function inWhen(v: VisitFull, when: When, now: number) {
  const t = new Date(v.scheduled_start).getTime();
  const today = startOfDay(now).getTime();
  const tomorrow = addDays(startOfDay(now), 1).getTime();
  switch (when) {
    case "upcoming":
      return v.status === "in_progress" || (t >= now - 2 * MS.HOUR && v.status !== "completed" && v.status !== "cancelled");
    case "today":
      return (t >= today && t < tomorrow) || v.status === "in_progress";
    case "7d":
      return t >= addDays(startOfDay(now), -6).getTime() && t < tomorrow;
    case "30d":
      return t >= addDays(startOfDay(now), -29).getTime() && t < tomorrow;
    case "all":
      return true;
  }
}

const stamp = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function exportCsv(visits: VisitFull[]) {
  const header = [
    "Visit ID",
    "Scheduled",
    "Status",
    "Patient",
    "Service",
    "Clinician",
    "Clock-in",
    "Clock-in distance (m)",
    "Clock-in GPS accuracy (m)",
    "Clock-in flags",
    "Clock-out",
    "Clock-out distance (m)",
    "Clock-out flags",
    "Minutes on site",
    "Location check",
    "BP systolic",
    "BP diastolic",
    "Pulse (bpm)",
    "Temperature (°C)",
    "SpO2 (%)",
    "Glucose (mmol/L)",
    "Clinician notes",
  ];
  const rows = visits.map((v) => {
    const cin = eventOf(v, "clock_in");
    const cout = eventOf(v, "clock_out");
    const r = reportOf(v);
    const round = (n: number | null | undefined) => (n == null ? "" : Math.round(n));
    return [
      v.id,
      stamp(v.scheduled_start),
      STATUS_LABEL[v.status],
      patientName(v),
      v.service_type,
      v.clinician?.full_name ?? "",
      stamp(cin?.occurred_at),
      round(cin?.distance_m),
      round(cin?.accuracy_m),
      cin?.flags.join(" ") ?? "",
      stamp(cout?.occurred_at),
      round(cout?.distance_m),
      cout?.flags.join(" ") ?? "",
      v.status === "completed" ? Math.round(actualMs(v) / MS.MIN) : "",
      { verified: "Verified", flagged: "Needs review", pending: "Awaiting sync", none: "" }[verificationOf(v)],
      r?.bp_systolic ?? "",
      r?.bp_diastolic ?? "",
      r?.pulse_bpm ?? "",
      r?.temperature_c ?? "",
      r?.spo2_pct ?? "",
      r?.glucose_mmol ?? "",
      r?.notes ?? "",
    ];
  });
  downloadCsv(`visits-${dayKey(new Date())}.csv`, header, rows);
}

export function VisitsView() {
  const { data, error, loading, reload } = useConsole();
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow(60_000);
  const [q, setQ] = useState("");

  const when = asWhen(params.get("when"));
  const status = (params.get("status") ?? "all") as VisitStatus | "all";
  const clinician = params.get("clinician") ?? "all";
  const reviewOnly = params.get("review") === "1";

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/visits?${qs}` : "/visits", { scroll: false });
  }

  if (loading) return <Spinner label="Loading visits" />;
  if (!data) return <ErrorNote message={error ?? "Couldn't load visits."} onRetry={reload} />;

  const needle = q.trim().toLowerCase();
  const filtered = data.visits.filter(
    (v) =>
      inWhen(v, when, now) &&
      (status === "all" || v.status === status) &&
      (clinician === "all" || (clinician === "unassigned" ? v.clinician_id === null : v.clinician_id === clinician)) &&
      (!reviewOnly || verificationOf(v) === "flagged" || verificationOf(v) === "pending") &&
      (!needle ||
        patientName(v).toLowerCase().includes(needle) ||
        v.service_type.toLowerCase().includes(needle) ||
        (v.clinician?.full_name ?? "").toLowerCase().includes(needle)),
  );
  const ascending = when === "upcoming" || when === "today";
  const visits = filtered.sort((a, b) => (ascending ? 1 : -1) * a.scheduled_start.localeCompare(b.scheduled_start));

  return (
    <>
      <PageHeader
        title="Visits"
        subtitle="Every booking, with its clock-in record and visit report"
        actions={
          <Button icon={Download} onClick={() => exportCsv(visits)} disabled={visits.length === 0}>
            Export CSV
          </Button>
        }
      />

      {/* one filter row, above everything it scopes */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">When</span>
          <Segmented label="When" value={when} onChange={(v) => setParam("when", v === "upcoming" ? null : v)} options={WHEN} />
        </div>
        <Select label="Status" value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select label="Clinician" value={clinician} onChange={(e) => setParam("clinician", e.target.value)}>
          <option value="all">Everyone</option>
          <option value="unassigned">Unassigned</option>
          {data.clinicians.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </Select>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink">
          <input type="checkbox" checked={reviewOnly} onChange={(e) => setParam("review", e.target.checked ? "1" : null)} className="size-4 accent-[var(--brand)]" />
          Needs review only
        </label>
        <label className="relative flex-1 basis-56">
          <span className="sr-only">Search visits</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, clinician or service"
            className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-faint"
          />
        </label>
      </div>

      <Card
        title={`${visits.length} visit${visits.length === 1 ? "" : "s"}`}
        subtitle={WHEN.find((w) => w.value === when)?.label}
        className={cx(error && "opacity-90")}
      >
        <VisitTable
          visits={visits}
          now={now}
          caption="Visits"
          columns={["when", "patient", "service", "clinician", "status", "clock", "check", "duration", "vitals"]}
          empty={<EmptyState icon={ClipboardList} title="No visits match these filters" body="Try a wider date range or clear a filter." />}
        />
      </Card>
    </>
  );
}
