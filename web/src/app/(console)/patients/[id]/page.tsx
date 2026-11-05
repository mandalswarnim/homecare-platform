import type { Metadata } from "next";
import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { PatientDetailView } from "@/views/patient-detail";

export const metadata: Metadata = { title: "Patient" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function PatientPage() {
  return (
    <Suspense fallback={<Spinner label="Loading the patient" />}>
      <PatientDetailView />
    </Suspense>
  );
}
