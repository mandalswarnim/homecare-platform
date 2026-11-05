import type { Clinician } from "./types";

/** Which clinicians can deliver each service (mirrors the mobile app's service list). */
const WHO: Record<string, "doctor" | "nurse" | "any"> = {
  "Doctor home visit": "doctor",
  "Nursing care": "nurse",
  "Wound dressing": "nurse",
  "Injection / IV therapy": "nurse",
  "Vitals check": "any",
  "Medication review": "doctor",
};

export const canDeliver = (c: Clinician, service: string) => {
  const who = WHO[service] ?? "any";
  return who === "any" || c.role === who;
};
