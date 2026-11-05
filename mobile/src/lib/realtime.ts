import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useEffectEvent } from 'react';

import { supabase } from './supabase';

export type Watch = { table: string; filter?: string };
export type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * Subscribes to Postgres changes for the given tables (RLS still applies: you only receive rows
 * you're allowed to read) and calls `onChange` for each one.
 */
export function useRealtime(name: string, watches: Watch[], onChange: (payload: ChangePayload) => void, enabled = true) {
  const handle = useEffectEvent(onChange);
  const signature = JSON.stringify(watches);

  useEffect(() => {
    if (!enabled) return;
    const list = JSON.parse(signature) as Watch[];
    const channel = supabase.channel(`${name}:${Math.random().toString(36).slice(2, 8)}`);
    for (const w of list) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: w.table, filter: w.filter },
        (payload: ChangePayload) => handle(payload),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [name, signature, enabled]);
}
