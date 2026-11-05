import type { Metadata } from "next";

import { TeamView } from "@/views/team";

export const metadata: Metadata = { title: "Team" };
// Rendered only behind the browser-side admin check (see the console layout).
export const instant = false;

export default function TeamPage() {
  return <TeamView />;
}
