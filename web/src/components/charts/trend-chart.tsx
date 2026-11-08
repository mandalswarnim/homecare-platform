"use client";

import { useState } from "react";

import { niceDomain, Tooltip, useWidth } from "./core";

export type TrendSeries = { key: string; label: string; color: string; values: (number | null)[] };

const M = { top: 12, right: 40, bottom: 22, left: 34 };

/**
 * Line chart for a handful of readings (vitals across visits). 2px lines, 8px markers with a
 * surface ring, one y-axis, a crosshair that snaps to the nearest reading, values at the line ends.
 */
export function TrendChart({
  series,
  labels,
  titles,
  unit,
  height = 150,
  ariaLabel,
  format = (n: number) => String(n),
}: {
  series: TrendSeries[];
  /** short x labels, one per reading */
  labels: string[];
  /** tooltip titles, one per reading */
  titles: string[];
  unit: string;
  height?: number;
  ariaLabel: string;
  format?: (n: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = labels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const ticks = niceDomain(Math.min(...all), Math.max(...all), 3);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const x = (i: number) => (n <= 1 ? M.left + plotW / 2 : M.left + (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const ends = series.map((s) => {
    const idx = s.values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
    const i = idx[idx.length - 1];
    return i == null ? null : { i, v: s.values[i] as number };
  });
  const endYs = ends.filter(Boolean).map((e) => y(e!.v));
  const endsCollide = endYs.length > 1 && Math.abs(endYs[0] - endYs[1]) < 14;
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(plotW / Math.max(n - 1, 1), 1)));

  function pick(clientX: number, el: SVGSVGElement) {
    const rel = clientX - el.getBoundingClientRect().left;
    const i = n <= 1 ? 0 : Math.round(((rel - M.left) / Math.max(plotW, 1)) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && all.length > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block overflow-visible outline-none"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n - 1) - 1));
            if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? 0) + 1));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 5} textAnchor="middle" className="fill-faint text-[11px]">
                {l}
              </text>
            ) : null,
          )}
          {active !== null ? <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke="var(--axis)" strokeWidth={1} /> : null}

          {series.map((s) => {
            let d = "";
            let pen = false;
            s.values.forEach((v, i) => {
              if (v == null) {
                pen = false;
                return;
              }
              d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
              pen = true;
            });
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) =>
                  v == null ? null : (
                    <circle key={i} cx={x(i)} cy={y(v)} r={active === i ? 5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ),
                )}
              </g>
            );
          })}

          {/* values at the line ends (skipped when they would collide — legend + tooltip carry it) */}
          {!endsCollide
            ? ends.map((e, si) =>
                e ? (
                  <text key={series[si].key} x={x(e.i) + 9} y={y(e.v)} dy="0.32em" className="fill-ink-2 text-[11px] font-medium tabular-nums">
                    {format(e.v)}
                  </text>
                ) : null,
              )
            : null}
        </svg>
      ) : null}
      {active !== null && width > 0 ? (
        <Tooltip
          x={x(active)}
          y={M.top}
          width={width}
          title={titles[active]}
          rows={series.map((s) => ({ color: s.color, value: s.values[active] == null ? "None" : `${format(s.values[active] as number)} ${unit}`, label: s.label }))}
        />
      ) : null}
    </div>
  );
}
