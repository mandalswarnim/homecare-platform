import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import type { Fix } from './location';
import { storage } from './storage';
import { supabase } from './supabase';
import type { EventKind, ReportInput, VisitEvent, VisitStatus } from './types';

/**
 * Offline-first queue for clock-in / clock-out.
 *
 * Every event is saved on the phone first, then sent. With no signal it stays queued — with its
 * original time and GPS reading — and is retried automatically. The event id is generated here,
 * so a retry can never create a duplicate on the server.
 */
export type OutboxItem = {
  id: string;
  visitId: string;
  kind: EventKind;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'failed';
  error?: string;
  args: Record<string, unknown>;
};

const KEY = 'careround.outbox.v1';
let items: OutboxItem[] = read();
const listeners = new Set<() => void>();
const syncedListeners = new Set<(event: VisitEvent) => void>();
let running: Promise<void> | null = null;

function read(): OutboxItem[] {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(next: OutboxItem[]) {
  items = next;
  try {
    storage?.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: keep the queue in memory for this session.
  }
  listeners.forEach((listener) => listener());
}

export const getOutbox = () => items;

export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called with the server's verdict each time a queued event is accepted. */
export function onEventSynced(listener: (event: VisitEvent) => void) {
  syncedListeners.add(listener);
  return () => {
    syncedListeners.delete(listener);
  };
}

export const useOutbox = () => useSyncExternalStore(subscribeOutbox, getOutbox, getOutbox);

/** The visit's status as the clinician experiences it: queued clock events count immediately. */
export function effectiveStatus(visit: { id: string; status: VisitStatus }, queue: OutboxItem[]): VisitStatus {
  const mine = queue.filter((i) => i.visitId === visit.id && i.status === 'pending');
  if (mine.some((i) => i.kind === 'clock_out')) return 'completed';
  if (mine.some((i) => i.kind === 'clock_in')) return 'in_progress';
  return visit.status;
}

const NUMERIC_FIELDS = new Set(['bp_systolic', 'bp_diastolic', 'pulse_bpm', 'temperature_c', 'spo2_pct', 'glucose_mmol']);

function cleanReport(report: ReportInput) {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(report)) {
    const value = raw.trim();
    if (!value) continue;
    out[key] = NUMERIC_FIELDS.has(key) ? value.replace(',', '.') : value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function queueClockEvent({
  visitId,
  kind,
  fix,
  note,
  report,
}: {
  visitId: string;
  kind: EventKind;
  fix: Fix;
  note?: string;
  report?: ReportInput | null;
}) {
  const net = await NetInfo.fetch().catch(() => null);
  const offline = net ? net.isConnected === false || net.isInternetReachable === false : false;
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const item: OutboxItem = {
    id,
    visitId,
    kind,
    createdAt: now,
    attempts: 0,
    status: 'pending',
    args: {
      p_event_id: id,
      p_visit_id: visitId,
      p_kind: kind,
      p_occurred_at: now,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: fix.accuracy,
      p_is_mocked: fix.mocked,
      p_note: note?.trim() || null,
      p_was_offline: offline,
      p_platform: Platform.OS,
      p_report: report ? cleanReport(report) : null,
    },
  };
  write([...items, item]);
  void flushOutbox();
  return item;
}

function isRetryable(status: number, message: string) {
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return true;
  return /network|fetch|timed? ?out|offline|connection/i.test(message);
}

/** Sends queued events in order. Safe to call any time; concurrent calls share one run. */
export function flushOutbox(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      for (const item of items.slice()) {
        if (item.status !== 'pending') continue;
        const res = await supabase.rpc('record_visit_event', item.args);

        if (!res.error) {
          write(items.filter((i) => i.id !== item.id));
          syncedListeners.forEach((listener) => listener(res.data as VisitEvent));
          continue;
        }

        const message = res.error.message;
        if (isRetryable(res.status, message)) {
          // No signal: keep it, mark it as an offline event, and keep the order (clock-in before clock-out).
          write(
            items.map((i) =>
              i.id === item.id
                ? { ...i, attempts: i.attempts + 1, error: message, args: { ...i.args, p_was_offline: true } }
                : i,
            ),
          );
          break;
        }
        write(items.map((i) => (i.id === item.id ? { ...i, status: 'failed', error: message } : i)));
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

export function retryItem(id: string) {
  write(items.map((i) => (i.id === id ? { ...i, status: 'pending', error: undefined } : i)));
  void flushOutbox();
}

export function discardItem(id: string) {
  write(items.filter((i) => i.id !== id));
}

/** Retry whenever the phone regains signal, comes back to the foreground, or every 20 s. */
export function startOutboxSync() {
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) void flushOutbox();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void flushOutbox();
  });
  const timer = setInterval(() => {
    if (items.some((i) => i.status === 'pending')) void flushOutbox();
  }, 20_000);
  void flushOutbox();
  return () => {
    unsubscribeNet();
    appState.remove();
    clearInterval(timer);
  };
}
