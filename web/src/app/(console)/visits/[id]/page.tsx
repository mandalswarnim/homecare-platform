import type { Metadata } from "next";
import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { VisitDetailView } from "@/views/visit-detail";

export const metadata: Metadata = { title: "Visit" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function VisitPage() {
  return (
    <Suspense fallback={<Spinner label="Loading the visit" />}>
      <VisitDetailView />
    </Suspense>
  );
}
