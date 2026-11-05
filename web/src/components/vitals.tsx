"use client";

import { TriangleAlert } from "lucide-react";

import type { VisitReport } from "@/lib/types";

import { cx } from "./ui";

type Reading = { label: string; value: string; unit: string; outside: boolean; range: string };

/**
 * Typical adult reference ranges — a prompt to look closer, not a diagnosis. Values outside are
 * marked with an icon + "Outside typical range", never colour alone.
 */
export function readings(r: VisitReport): Reading[] {
  const out: Reading[] = [];
  if (r.bp_systolic != null && r.bp_diastolic != null)
    out.push({
      label: "Blood pressure",
      value: `${r.bp_systolic}/${r.bp_diastolic}`,
      unit: "mmHg",
      outside: r.bp_systolic >= 140 || r.bp_systolic < 90 || r.bp_diastolic >= 90 || r.bp_diastolic < 60,
      range: "90–139 / 60–89",
    });
  if (r.pulse_bpm != null) out.push({ label: "Pulse", value: String(r.pulse_bpm), unit: "bpm", outside: r.pulse_bpm < 50 || r.pulse_bpm > 100, range: "50–100" });
  if (r.temperature_c != null)
    out.push({ label: "Temperature", value: Number(r.temperature_c).toFixed(1), unit: "°C", outside: r.temperature_c < 35.5 || r.temperature_c >= 38, range: "35.5–37.9" });
  if (r.spo2_pct != null) out.push({ label: "Oxygen (SpO₂)", value: String(r.spo2_pct), unit: "%", outside: r.spo2_pct < 94, range: "94–100" });
  if (r.glucose_mmol != null)
    out.push({ label: "Blood glucose", value: Number(r.glucose_mmol).toFixed(1), unit: "mmol/L", outside: r.glucose_mmol < 4 || r.glucose_mmol > 10, range: "4.0–10.0" });
  return out;
}

export function VitalsGrid({ report }: { report: VisitReport }) {
  const list = readings(report);
  return (
    <div className="space-y-4">
      {list.length ? (
        <dl className="grid grid-cols-2 gap-3">
          {list.map((r) => (
            <div key={r.label} className={cx("rounded-lg border px-3 py-2.5", r.outside ? "border-warning bg-warning-soft" : "border-line bg-surface")}>
              <dt className="text-xs text-muted">{r.label}</dt>
              <dd className="mt-0.5">
                <span className="text-lg font-semibold text-ink">{r.value}</span> <span className="text-xs text-muted">{r.unit}</span>
                {r.outside ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning-text">
                    <TriangleAlert className="size-3" aria-hidden /> Outside typical range ({r.range})
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">No measurements were entered.</p>
      )}
      {report.notes ? (
        <div>
          <div className="text-xs text-muted">Clinician&apos;s notes</div>
          <p className="mt-1 text-sm whitespace-pre-line text-ink">{report.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
