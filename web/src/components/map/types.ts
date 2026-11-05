export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: "home" | "live" | "ok" | "flag";
  /** first tooltip line */
  label: string;
  /** second tooltip line */
  sublabel?: string;
  /** short text drawn inside the pin (initials for a clinician on a visit) */
  text?: string;
  /** visit to open when the pin is clicked */
  visitId?: string;
};

export type MapCircle = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  kind: "geofence" | "accuracy" | "accuracy-flag";
};

export type MapViewProps = {
  pins: MapPin[];
  circles?: MapCircle[];
  /** accessible description of what the map shows */
  ariaLabel: string;
  /** re-fit the view only when this changes (so live updates don't reset the user's pan/zoom) */
  fitKey: string;
  onSelect?: (pin: MapPin) => void;
  className?: string;
};
