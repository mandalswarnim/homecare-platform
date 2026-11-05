import type { Metadata } from "next";

import { OverviewView } from "@/views/overview";

export const metadata: Metadata = { title: "Overview" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function OverviewPage() {
  return <OverviewView />;
}
