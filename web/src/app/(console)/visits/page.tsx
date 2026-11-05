import type { Metadata } from "next";
import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { VisitsView } from "@/views/visits";

export const metadata: Metadata = { title: "Visits" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function VisitsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading visits" />}>
      <VisitsView />
    </Suspense>
  );
}
