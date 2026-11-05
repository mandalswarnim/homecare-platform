import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useNotify } from '@/components/notify';

import { useAuth } from './auth';
import { flagText, formatDistance, formatWhen } from './format';
import { onEventSynced } from './outbox';
import { useRealtime } from './realtime';
import type { IconName } from './services';
import { supabase } from './supabase';
import type { Tone } from './theme';
import type { VisitStatus } from './types';

type Row = { id: string; status: VisitStatus; clinician_id: string | null; service_type: string; scheduled_start: string };

const PATIENT_ALERTS: Partial<Record<VisitStatus, { title: string; icon: IconName; tone: Tone }>> = {
  accepted: { title: 'Your visit is confirmed', icon: 'checkmark-circle', tone: 'primary' },
  declined: { title: 'Your request was declined', icon: 'close-circle', tone: 'danger' },
  in_progress: { title: 'Your clinician has arrived', icon: 'home', tone: 'warning' },
  completed: { title: 'Visit completed — report ready', icon: 'document-text', tone: 'success' },
};

/** Live banners for a patient whenever one of their visits changes status. */
export function usePatientAlerts() {
  const { session } = useAuth();
  const notify = useNotify();
  const uid = session?.user.id;
  const known = useRef(new Map<string, VisitStatus>());

  useEffect(() => {
    if (!uid) return;
    void supabase
      .from('visits')
      .select('id, status')
      .eq('patient_id', uid)
      .then(({ data }) => {
        for (const v of (data ?? []) as Pick<Row, 'id' | 'status'>[]) known.current.set(v.id, v.status);
      });
  }, [uid]);

  useRealtime(
    'patient-alerts',
    [{ table: 'visits', filter: `patient_id=eq.${uid}` }],
    (payload) => {
      if (payload.eventType !== 'UPDATE') return;
      const row = payload.new as Row;
      const before = known.current.get(row.id);
      known.current.set(row.id, row.status);
      if (before === row.status) return;
      const alert = PATIENT_ALERTS[row.status];
      if (alert) notify({ ...alert, body: row.service_type, onPress: () => router.push(`/patient/visit/${row.id}`) });
    },
    Boolean(uid),
  );
}

/** Live banners for a clinician: new requests, assignments and cancellations. */
export function useClinicianAlerts() {
  const { session } = useAuth();
  const notify = useNotify();
  const uid = session?.user.id;
  const known = useRef(new Map<string, Pick<Row, 'status' | 'clinician_id'>>());

  useEffect(() => {
    if (!uid) return;
    void supabase
      .from('visits')
      .select('id, status, clinician_id')
      .then(({ data }) => {
        for (const v of (data ?? []) as Row[]) known.current.set(v.id, { status: v.status, clinician_id: v.clinician_id });
      });
  }, [uid]);

  useRealtime(
    'clinician-alerts',
    [{ table: 'visits' }],
    (payload) => {
      const row = payload.new as Row;
      if (!row?.id) return;
      const before = known.current.get(row.id);
      known.current.set(row.id, { status: row.status, clinician_id: row.clinician_id });
      const mine = row.clinician_id === uid;
      const open = () => router.push(`/clinician/visit/${row.id}`);
      const body = `${row.service_type} · ${formatWhen(row.scheduled_start)}`;

      if (payload.eventType === 'INSERT' && row.status === 'requested') {
        notify({ title: mine ? 'New visit request for you' : 'New open visit request', body, icon: 'notifications', tone: 'info', onPress: open });
      } else if (payload.eventType === 'UPDATE') {
        const newlyAssigned = mine && row.status === 'requested' && (before?.clinician_id !== uid || before?.status !== 'requested');
        if (newlyAssigned) notify({ title: 'A visit was assigned to you', body, icon: 'person-add', tone: 'info', onPress: open });
        if (mine && row.status === 'cancelled' && before && before.status !== 'cancelled') {
          notify({ title: 'A patient cancelled a visit', body, icon: 'close-circle', tone: 'neutral', onPress: open });
        }
      }
    },
    Boolean(uid),
  );
}

/** Tells the clinician the server's verdict as soon as a queued clock-in/out is accepted. */
export function useSyncedEventAlerts() {
  const notify = useNotify();
  useEffect(
    () =>
      onEventSynced((ev) => {
        const what = ev.kind === 'clock_in' ? 'Clocked in' : 'Clocked out';
        if (ev.verified) {
          notify({
            title: `${what} · verified`,
            body: ev.distance_m != null ? `${formatDistance(ev.distance_m)} from the patient's home` : undefined,
            tone: 'success',
            icon: 'shield-checkmark',
          });
        } else {
          notify({ title: `${what} · flagged for review`, body: ev.flags.map(flagText).join(' · '), tone: 'warning', icon: 'alert-circle' });
        }
      }),
    [notify],
  );
}
