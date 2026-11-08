"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cx } from "../ui";

/** Measures an element's content width (charts draw to the pixel). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean axis ticks from 0: 0 / 2 / 4 / 6 … (integers when `integer`). */
export function niceTicks(max: number, count = 4, integer = true): number[] {
  const top = Math.max(max, integer ? 1 : Number.EPSILON);
  const raw = top / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let v = 0; v <= top + step * 0.999; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** A padded, rounded domain for values that shouldn't start at zero (vitals). */
export function niceDomain(min: number, max: number, count = 3): number[] {
  const span = Math.max(max - min, Math.abs(max) * 0.08, 1);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor((min - step * 0.25) / step) * step;
  const hi = Math.ceil((max + step * 0.25) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export type LegendItem = { label: string; color: string; mark?: "rect" | "line" };

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.mark === "line" ? (
            <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: it.color }} />
          ) : (
            <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export type TableSpec = { columns: string[]; rows: (string | number)[][]; numeric?: boolean[] };

/** The table twin of a chart — every value reachable without hovering. */
export function DataTable({ spec, caption }: { spec: TableSpec; caption: string }) {
  return (
    <div className="max-h-80 overflow-auto rounded-[10px] border border-line">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
          <tr>
            {spec.columns.map((c, i) => (
              <th key={c} scope="col" className={cx("px-3 py-2 font-medium", spec.numeric?.[i] && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line">
              {r.map((v, ci) => (
                <td key={ci} className={cx("px-3 py-1.5 text-ink", spec.numeric?.[ci] && "text-right tabular-nums")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Chart container: title, legend, and a chart/table toggle (the accessible twin of every chart).
 * Height grows with content, so axis labels never get clipped or scroll.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table: TableSpec;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <figure className={cx("flex flex-col rounded-[14px] border border-line bg-surface px-6 pt-5 pb-6 shadow-panel", className)}>
      <div className="flex items-start justify-between gap-3">
        <figcaption className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
        </figcaption>
        <div role="group" aria-label={`${title}: view`} className="inline-flex shrink-0 rounded-[9px] bg-surface-2 p-0.5">
          {(
            [
              ["chart", ChartColumn, "Chart"],
              ["table", Table2, "Table"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              aria-label={`Show as ${label.toLowerCase()}`}
              title={label}
              onClick={() => setView(key)}
              className={cx(
                "flex size-7 items-center justify-center rounded-[7px] transition-colors",
                view === key ? "bg-surface text-ink shadow-panel" : "text-faint hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>
      {legend && legend.length > 1 && view === "chart" ? (
        <div className="mt-3">
          <Legend items={legend} />
        </div>
      ) : null}
      <div className="mt-5">{view === "chart" ? children : <DataTable spec={table} caption={title} />}</div>
      {footer ? <div className="mt-3 text-xs text-muted">{footer}</div> : null}
    </figure>
  );
}

export type TipRow = { color: string; value: string; label: string };

/** Hover/focus readout. Values lead (strong); series names follow; keyed with a short line. */
export function Tooltip({ x, y, width, title, rows, footer }: { x: number; y: number; width: number; title: string; rows: TipRow[]; footer?: string }) {
  const flip = x > width - 170;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 8) }}
    >
      <div className="mb-1 font-medium text-ink-2">{title}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: r.color }} />
            <span className="font-semibold text-ink tabular-nums">{r.value}</span>
            <span className="text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-1 border-t border-line pt-1 text-muted">{footer}</div> : null}
    </div>
  );
}
