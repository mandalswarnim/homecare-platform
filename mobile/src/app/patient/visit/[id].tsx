import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { VisitTimeline } from '@/components/timeline';
import { Avatar, Badge, Button, Card, Empty, Loading, Notice, Screen, SectionTitle, text } from '@/components/ui';
import { VitalsSummary } from '@/components/vitals';
import { PATIENT_VISIT_SELECT, reportOf } from '@/lib/data';
import { STATUS, errorMessage, formatClock, formatWhen } from '@/lib/format';
import { useRealtime } from '@/lib/realtime';
import { serviceIcon } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { VisitDetail } from '@/lib/types';
import { useNow } from '@/lib/use-now';

export default function PatientVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('visits').select(PATIENT_VISIT_SELECT).eq('id', id).maybeSingle();
    if (loadError) setError(loadError.message);
    else setVisit(data as VisitDetail | null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useRealtime(`patient-visit-${id}`, [{ table: 'visits', filter: `id=eq.${id}` }], () => void load());
  const now = useNow(1000, visit?.status === 'in_progress');

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('cancel_visit', { p_visit_id: id });
      if (rpcError) throw rpcError;
      setConfirmCancel(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Loading />;
  if (!visit) {
    return (
      <Screen edges={[]}>
        <Empty icon="alert-circle-outline" title="Visit not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const status = STATUS[visit.status];
  const report = reportOf(visit);
  const clinician = visit.clinician;
  const canCancel = ['requested', 'accepted', 'declined'].includes(visit.status);

  return (
    <Screen edges={[]}>
      <Card>
        <View style={styles.headRow}>
          <View style={styles.icon}>
            <Ionicons name={serviceIcon(visit.service_type)} size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={text.h2}>{visit.service_type}</Text>
            <Text style={text.muted}>{formatWhen(visit.scheduled_start)}</Text>
          </View>
        </View>
        <Badge label={status.patient} tone={status.tone} />
        {visit.status === 'in_progress' && visit.started_at ? (
          <Notice tone="warning" icon="time" title={`Your clinician is with you · ${formatClock(now - new Date(visit.started_at).getTime())}`} />
        ) : null}
        {visit.reason ? <Text style={text.body}>“{visit.reason}”</Text> : null}
      </Card>

      <SectionTitle title="Clinician" />
      <Card>
        {clinician ? (
          <View style={styles.headRow}>
            <Avatar name={clinician.full_name} size={44} />
            <View style={styles.flex}>
              <Text style={text.h3}>{clinician.full_name}</Text>
              <Text style={text.small}>{clinician.specialty ?? (clinician.role === 'doctor' ? 'Doctor' : 'Nurse')}</Text>
            </View>
            {clinician.phone && ['accepted', 'in_progress'].includes(visit.status) ? (
              <Button size="sm" variant="secondary" icon="call" title="Call" onPress={() => void Linking.openURL(`tel:${clinician.phone?.replace(/\s/g, '')}`)} />
            ) : null}
          </View>
        ) : (
          <Text style={text.muted}>We&apos;re finding the first available clinician for you.</Text>
        )}
      </Card>

      <SectionTitle title="Progress" />
      <Card>
        <VisitTimeline visit={visit} />
      </Card>

      {report ? (
        <>
          <SectionTitle title="Visit report" />
          <Card>
            <VitalsSummary report={report} />
          </Card>
        </>
      ) : null}

      {error ? <Notice tone="danger" icon="alert-circle" title="Something went wrong">{error}</Notice> : null}

      {canCancel ? (
        confirmCancel ? (
          <Notice tone="danger" icon="help-circle" title="Cancel this visit?">
            <View style={styles.confirm}>
              <Button style={styles.flex} title="Yes, cancel" variant="danger" loading={busy} onPress={() => void cancel()} />
              <Button style={styles.flex} title="Keep it" variant="secondary" onPress={() => setConfirmCancel(false)} />
            </View>
          </Notice>
        ) : (
          <Button title="Cancel visit" variant="danger" icon="close-circle-outline" onPress={() => setConfirmCancel(true)} />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
