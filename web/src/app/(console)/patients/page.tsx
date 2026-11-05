import type { Metadata } from "next";

import { PatientsView } from "@/views/patients";

export const metadata: Metadata = { title: "Patients" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function PatientsPage() {
  return <PatientsView />;
}
