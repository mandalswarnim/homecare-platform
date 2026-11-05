"use client";

import dynamic from "next/dynamic";

export type { MapCircle, MapPin, MapViewProps } from "./types";

/** Leaflet touches `window`, so it only loads in the browser. */
export const MapView = dynamic(() => import("./leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-surface-2" />,
});

export function MapLegend({ items }: { items: { kind: "home" | "live" | "ok" | "flag"; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.kind} className="inline-flex items-center gap-1.5">
          <LegendPin kind={it.kind} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function LegendPin({ kind }: { kind: "home" | "live" | "ok" | "flag" }) {
  if (kind === "live") return <span aria-hidden className="inline-block size-3.5 rounded-full bg-brand ring-2 ring-surface" />;
  if (kind === "home")
    return <span aria-hidden className="inline-block size-3.5 rounded-full border-[1.5px] border-axis bg-surface" />;
  if (kind === "ok") return <span aria-hidden className="inline-block size-3.5 rounded-full bg-series-1" />;
  return (
    <span aria-hidden className="inline-flex size-3.5 items-center justify-center rounded-full bg-warning text-[9px] leading-none font-bold text-[#0b0b0b]">
      !
    </span>
  );
}
