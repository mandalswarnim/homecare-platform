"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useLiveQuery, type LiveQuery, type Watch } from "@/lib/live";
import { loadConsole, type ConsoleData } from "@/lib/queries";

const ConsoleContext = createContext<LiveQuery<ConsoleData> | null>(null);

const WATCH: Watch[] = [{ table: "visits" }, { table: "visit_events" }, { table: "activity_log" }];

/** One shared, live-updating dataset for the overview, visit list, patients and team pages. */
export function ConsoleDataProvider({ children }: { children: ReactNode }) {
  const query = useLiveQuery("console", loadConsole, WATCH);
  return <ConsoleContext.Provider value={query}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleDataProvider>");
  return ctx;
}
