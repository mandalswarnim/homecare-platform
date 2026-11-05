"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { errorMessage } from "./format";
import { supabase } from "./supabase";

/** Tables in the realtime publication. Row-level security still applies to what each viewer receives. */
export type Watch = { table: "visits" | "visit_events" | "activity_log"; filter?: string };

export type LiveQuery<T> = {
  data: T | null;
  error: string | null;
  /** true only before the first successful load */
  loading: boolean;
  /** realtime channel connected */
  live: boolean;
  updatedAt: number | null;
  reload: () => void;
};

/**
 * Loads data, then keeps it fresh: refetches (debounced) whenever a watched table changes,
 * when the tab becomes visible again, and on a slow poll as a fallback if realtime drops.
 * Previous data stays on screen while refetching — no skeleton flashes.
 */
export function useLiveQuery<T>(name: string, load: () => Promise<T>, watches: Watch[], pollMs = 60_000): LiveQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const runRef = useRef<(() => void) | null>(null);
  const fetcher = useEffectEvent(load);
  const signature = JSON.stringify(watches);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (!active) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      fetcher()
        .then(
          (next) => {
            if (!active) return;
            setData(next);
            setError(null);
            setUpdatedAt(Date.now());
          },
          (err: unknown) => {
            if (active) setError(errorMessage(err));
          },
        )
        .finally(() => {
          inFlight = false;
          if (queued) {
            queued = false;
            run();
          }
        });
    };
    const schedule = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, 400);
    };
    runRef.current = run;
    run();

    const client = supabase();
    const channel = client.channel(`${name}:${Math.random().toString(36).slice(2, 8)}`);
    for (const w of JSON.parse(signature) as Watch[]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: w.table, filter: w.filter }, schedule);
    }
    channel.subscribe((status) => {
      if (active) setLive(status === "SUBSCRIBED");
    });

    const poll = setInterval(run, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      runRef.current = null;
      if (debounce) clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [name, signature, pollMs]);

  const reload = useCallback(() => runRef.current?.(), []);

  return { data, error, loading: data === null && error === null, live, updatedAt, reload };
}

/** Current time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
