import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useNotify } from '@/components/notify';
import { Badge, Button, Empty, Loading, Notice, Screen, SectionTitle } from '@/components/ui';
import { VisitCard } from '@/components/visit-card';
import { useAuth } from '@/lib/auth';
import { CLINICIAN_VISIT_SELECT, isOpenRequest } from '@/lib/data';
import { formatLongDay, greeting, shortName, startOfDay } from '@/lib/format';
import { effectiveStatus, onEventSynced, useOutbox } from '@/lib/outbox';
import { useRealtime } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { VisitDetail } from '@/lib/types';

const DAY = 86_400_000;

export default function ClinicianHome() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const notify = useNotify();
  const outbox = useOutbox();
  const [visits, setVisits] = useState<VisitDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const since = new Date(Date.now() - 14 * DAY).toISOString();
    const { data, error: loadError } = await supabase
      .from('visits')
      .select(CLINICIAN_VISIT_SELECT)
      .or(`clinician_id.eq.${uid},and(clinician_id.is.null,status.eq.requested)`)
      .gte('scheduled_start', since)
      .order('scheduled_start', { ascending: true });
    if (loadError) setError(loadError.message);
    else {
      setVisits(data as VisitDetail[]);
      setError(null);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useRealtime('clinician-home', [{ table: 'visits' }], () => void load(), Boolean(uid));
  useEffect(() => onEventSynced(() => void load()), [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function accept(visit: VisitDetail) {
    setBusyId(visit.id);
    const { error: rpcError } = await supabase.rpc('respond_to_visit', { p_visit_id: visit.id, p_accept: true });
    setBusyId(null);
    if (rpcError) notify({ title: "Couldn't accept", body: rpcError.message, tone: 'danger', icon: 'alert-circle' });
    else notify({ title: 'Visit accepted', body: `${visit.patient?.profile?.full_name ?? 'The patient'} has been notified`, tone: 'success', icon: 'checkmark-circle' });
    void load();
  }

  if (!visits && !error) return <Loading />;

  const todayStart = startOfDay(new Date()).getTime();
  const at = (v: VisitDetail) => new Date(v.scheduled_start).getTime();
  const rows = (visits ?? []).map((v) => ({ v, s: effectiveStatus(v, outbox) }));
  const requests = rows.filter((r) => r.s === 'requested').map((r) => r.v);
  const onVisit = rows.filter((r) => r.s === 'in_progress').map((r) => r.v);
  const overdue = rows.filter((r) => r.s === 'accepted' && at(r.v) < todayStart).map((r) => r.v);
  const today = rows.filter((r) => r.s === 'accepted' && at(r.v) >= todayStart && at(r.v) < todayStart + DAY).map((r) => r.v);
  const later = rows.filter((r) => r.s === 'accepted' && at(r.v) >= todayStart + DAY).map((r) => r.v);
  const done = rows.filter((r) => r.s === 'completed').map((r) => r.v).reverse().slice(0, 5);
  const pending = outbox.filter((i) => i.status === 'pending').length;
  const failed = outbox.filter((i) => i.status === 'failed').length;
  const open = (id: string) => router.push(`/clinician/visit/${id}`);

  return (
    <Screen
      title={`${greeting()}${profile?.full_name ? `, ${shortName(profile.full_name)}` : ''}`}
      subtitle={formatLongDay(new Date())}
      refreshing={refreshing}
      onRefresh={() => void refresh()}>
      {error ? <Notice tone="danger" icon="cloud-offline" title="Couldn't refresh visits">{error}</Notice> : null}
      {pending > 0 ? (
        <Notice tone="info" icon="cloud-upload" title={`${pending} clock event${pending > 1 ? 's' : ''} waiting for signal`}>
          Saved safely on this phone with the original time and location. They sync automatically.
        </Notice>
      ) : null}
      {failed > 0 ? (
        <Notice tone="danger" icon="alert-circle" title={`${failed} clock event${failed > 1 ? 's' : ''} couldn't sync`}>
          Open the visit to retry or discard it.
        </Notice>
      ) : null}

      {onVisit.length > 0 ? <SectionTitle title="On visit now" /> : null}
      {onVisit.map((v) => (
        <VisitCard key={v.id} visit={v} perspective="clinician" onPress={() => open(v.id)} badge={<Badge label="In progress — tap to clock out" tone="warning" icon="time" />} />
      ))}

      <SectionTitle title={`Requests${requests.length ? ` · ${requests.length}` : ''}`} />
      {requests.length === 0 ? (
        <Empty icon="notifications-outline" title="No new requests" body="New requests from patients appear here instantly." />
      ) : (
        requests.map((v) => (
          <VisitCard
            key={v.id}
            visit={v}
            perspective="clinician"
            onPress={() => open(v.id)}
            badge={<Badge label={isOpenRequest(v) ? 'Open request · first to accept' : 'Requested you'} tone="info" icon="notifications" />}
            footer={
              <View style={styles.actions}>
                <Button style={styles.flex} title="Accept" variant="success" icon="checkmark" loading={busyId === v.id} onPress={() => void accept(v)} />
                <Button style={styles.flex} title="Details" variant="secondary" onPress={() => open(v.id)} />
              </View>
            }
          />
        ))
      )}

      {overdue.length > 0 ? <SectionTitle title="Overdue — not clocked in" /> : null}
      {overdue.map((v) => (
        <VisitCard key={v.id} visit={v} perspective="clinician" onPress={() => open(v.id)} badge={<Badge label="Overdue" tone="danger" icon="alert-circle" />} />
      ))}

      <SectionTitle title="Today" />
      {today.length === 0 ? (
        <Empty icon="sunny-outline" title="Nothing else scheduled today" />
      ) : (
        today.map((v) => <VisitCard key={v.id} visit={v} perspective="clinician" onPress={() => open(v.id)} />)
      )}

      {later.length > 0 ? <SectionTitle title="Coming up" /> : null}
      {later.map((v) => (
        <VisitCard key={v.id} visit={v} perspective="clinician" onPress={() => open(v.id)} />
      ))}

      {done.length > 0 ? <SectionTitle title="Recently completed" /> : null}
      {done.map((v) => (
        <VisitCard key={v.id} visit={v} perspective="clinician" onPress={() => open(v.id)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
