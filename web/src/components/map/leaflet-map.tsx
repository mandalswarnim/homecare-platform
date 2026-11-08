"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useEffectEvent, useRef } from "react";

import type { MapCircle, MapPin, MapViewProps } from "./types";

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const GLYPH = {
  home: svg(
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ),
  ok: svg('<path d="M20 6 9 17l-5-5"/>'),
  flag: svg('<path d="M12 8v5"/><path d="M12 17h.01"/>'),
};

const SIZE: Record<MapPin["kind"], number> = { home: 22, live: 34, ok: 24, flag: 24 };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function pinIcon(pin: MapPin) {
  const size = SIZE[pin.kind];
  const inner = pin.kind === "live" ? escapeHtml((pin.text ?? "").slice(0, 3)) : GLYPH[pin.kind];
  return L.divIcon({
    className: "",
    html: `<div class="map-pin map-pin-${pin.kind}">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Tooltip content built with textContent — names come from user input. */
function tipContent(pin: MapPin) {
  const el = document.createElement("div");
  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.textContent = pin.label;
  el.appendChild(title);
  if (pin.sublabel) {
    const sub = document.createElement("div");
    sub.style.color = "var(--muted)";
    sub.textContent = pin.sublabel;
    el.appendChild(sub);
  }
  return el;
}

const CIRCLE_STYLE: Record<MapCircle["kind"], L.CircleMarkerOptions> = {
  geofence: { color: "#0f766e", weight: 1.5, fillOpacity: 0.08, className: "map-geofence" },
  accuracy: { color: "#2a78d6", weight: 1, fillOpacity: 0.06, className: "map-accuracy" },
  "accuracy-flag": { color: "#fab219", weight: 1, fillOpacity: 0.1, className: "map-accuracy-flag" },
};

// Africa-wide fallback view when there's nothing to show yet.
const FALLBACK: L.LatLngExpression = [2, 20];

export function LeafletMap({ pins, circles = [], ariaLabel, fitKey, onSelect, className }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef<string | null>(null);
  const select = useEffectEvent((pin: MapPin) => onSelect?.(pin));

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView(FALLBACK, 3);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    // let the wheel zoom only after the map is clicked, so page scrolling isn't hijacked
    m.on("click", () => m.scrollWheelZoom.enable());
    m.on("mouseout", () => m.scrollWheelZoom.disable());
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
      fitted.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();

    for (const c of circles) {
      L.circle([c.lat, c.lng], { radius: c.radius, ...CIRCLE_STYLE[c.kind], interactive: false }).addTo(g);
    }
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], {
        icon: pinIcon(p),
        keyboard: true,
        title: p.sublabel ? `${p.label}: ${p.sublabel}` : p.label,
        alt: p.label,
        zIndexOffset: p.kind === "live" ? 1000 : p.kind === "flag" ? 500 : 0,
        riseOnHover: true,
      });
      marker.bindTooltip(tipContent(p), { className: "map-tip", direction: "top", offset: [0, -SIZE[p.kind] / 2 - 2] });
      if (p.visitId) marker.on("click keypress", () => select(p));
      marker.addTo(g);
    }

    if (fitted.current !== fitKey) {
      fitted.current = fitKey;
      const pts: L.LatLngExpression[] = pins.map((p) => [p.lat, p.lng]);
      const bounds = L.latLngBounds(pts);
      for (const c of circles) bounds.extend(L.latLng(c.lat, c.lng).toBounds(c.radius * 2));
      if (bounds.isValid()) m.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      else m.setView(FALLBACK, 3);
    }
  }, [pins, circles, fitKey]);

  return <div ref={el} role="region" aria-label={ariaLabel} className={className} />;
}
