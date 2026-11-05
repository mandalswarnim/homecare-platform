import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ClockButton } from '@/components/clock-button';
import { EventRow, PendingRow } from '@/components/event-list';
import { useNotify } from '@/components/notify';
import { Avatar, Badge, Button, Card, Empty, Field, InfoRow, Loading, Notice, Screen, SectionTitle, text } from '@/components/ui';
import { EMPTY_REPORT, VitalsForm, VitalsSummary, reportHasErrors } from '@/components/vitals';
import { useAuth } from '@/lib/auth';
import { CLINICIAN_VISIT_SELECT, reportOf } from '@/lib/data';
import { STATUS, formatClock, formatDuration, formatTime, formatWhen } from '@/lib/format';
import { directionsUrl, homeOf } from '@/lib/location';
import { effectiveStatus, useOutbox } from '@/lib/outbox';
import { useRealtime } from '@/lib/realtime';
import { serviceIcon } from '@/lib/services';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { ReportInput, VisitDetail } from '@/lib/types';
import { useNow } from '@/lib/use-now';

const draftKey = (id: string) => `careround.report-draft.${id}`;

function readDraft(id: string): ReportInput {
  try {
    const raw = storage?.getItem(draftKey(id));
    return raw ? { ...EMPTY_REPORT, ...(JSON.parse(raw) as Partial<ReportInput>) } : EMPTY_REPORT;
  } catch {
    return EMPTY_REPORT;
  }
}

export default function ClinicianVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const uid = session?.user.id;
  const notify = useNotify();
  const outbox = useOutbox();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportInput>(() => readDraft(id));
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('visits').select(CLINICIAN_VISIT_SELECT).eq('id', id).maybeSingle();
    if (error) setLoadError(error.message);
    else {
      setVisit(data as VisitDetail | null);
      setLoadError(null);
    }
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useRealtime(
    `clinician-visit-${id}`,
    [
      { table: 'visits', filter: `id=eq.${id}` },
      { table: 'visit_events', filter: `visit_id=eq.${id}` },
    ],
    () => void load(),
  );

  const status = visit ? effectiveStatus(visit, outbox) : null;
  const now = useNow(1000, status === 'in_progress');

  function updateReport(next: ReportInput) {
    setReport(next);
    try {
      storage?.setItem(draftKey(id), JSON.stringify(next));
    } catch {
      // drafts are a convenience only
    }
  }

  async function respond(accept: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc('respond_to_visit', {
      p_visit_id: id,
      p_accept: accept,
      p_reason: accept ? null : declineReason.trim() || null,
    });
    setBusy(false);
    if (error) notify({ title: accept ? "Couldn't accept" : "Couldn't decline", body: error.message, tone: 'danger', icon: 'alert-circle' });
    else {
      notify(
        accept
          ? { title: 'Visit accepted', body: 'The patient has been notified', tone: 'success', icon: 'checkmark-circle' }
          : { title: 'Request declined', body: 'The office will reassign it', tone: 'neutral', icon: 'close-circle' },
      );
      setDeclining(false);
    }
    void load();
  }

  if (!loaded) return <Loading />;
  if (!visit || !status) {
    return (
      <Screen edges={[]}>
        <Empty icon="alert-circle-outline" title="Visit not available" body={loadError ?? 'It may have been accepted by someone else or cancelled.'} />
      </Screen>
    );
  }

  const home = homeOf(visit.patient);
  const patientName = visit.patient?.profile?.full_name ?? 'the patient';
  const phone = visit.patient?.profile?.phone ?? null;
  const events = (visit.events ?? []).slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const queued = outbox.filter((i) => i.visitId === visit.id);
  const pendingIn = queued.find((i) => i.kind === 'clock_in' && i.status === 'pending');
  const startedAt = visit.started_at ?? pendingIn?.createdAt ?? null;
  const report_ = reportOf(visit);
  const statusInfo = STATUS[status];
  const isOpen = visit.clinician_id === null;
  const assignedToMe = visit.clinician_id === uid;

  return (
    <Screen edges={[]}>
      <Card>
        <View style={styles.row}>
          <Avatar name={patientName} size={48} />
          <View style={styles.flex}>
            <Text style={text.h2}>{patientName}</Text>
            <Text style={text.muted}>{visit.patient?.address ?? 'No address given'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          {phone ? (
            <Button style={styles.flex} variant="secondary" icon="call" title="Call" onPress={() => void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} />
          ) : null}
          {home ? (
            <Button style={styles.flex} variant="secondary" icon="navigate" title="Directions" onPress={() => void Linking.openURL(directionsUrl(home.lat, home.lng))} />
          ) : null}
        </View>
        {!home ? (
          <Notice tone="warning" icon="location" title="Home not pinned yet">
            This patient hasn&apos;t pinned their home, so clock-ins can&apos;t be location-verified.
          </Notice>
        ) : null}
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name={serviceIcon(visit.service_type)} size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={text.h3}>{visit.service_type}</Text>
            <Text style={text.muted}>{formatWhen(visit.scheduled_start)} · {visit.duration_minutes} min</Text>
          </View>
        </View>
        <Badge label={statusInfo.clinician} tone={statusInfo.tone} />
        {visit.reason ? <InfoRow icon="chatbubble-ellipses-outline" label="Reason given by the patient" value={visit.reason} /> : null}
      </Card>

      {status === 'requested' ? (
        <Card>
          <Text style={text.h3}>{isOpen ? 'Open request — the first clinician to accept takes it' : 'This patient asked for you'}</Text>
          <Button title="Accept visit" variant="success" icon="checkmark" loading={busy && !declining} onPress={() => void respond(true)} />
          {assignedToMe ? (
            declining ? (
              <>
                <Field label="Reason (optional)" placeholder="e.g. Already booked at that time" value={declineReason} onChangeText={setDeclineReason} />
                <Button title="Decline request" variant="danger" loading={busy && declining} onPress={() => void respond(false)} />
                <Button title="Back" variant="ghost" onPress={() => setDeclining(false)} />
              </>
            ) : (
              <Button title="Decline" variant="danger" onPress={() => setDeclining(true)} />
            )
          ) : null}
        </Card>
      ) : null}

      {status === 'accepted' ? (
        <Card>
          <Text style={text.h3}>When you arrive</Text>
          <Text style={text.muted}>
            Clock in at {patientName}&apos;s home. Your GPS is checked against their pinned location — it works without signal too.
          </Text>
          <ClockButton visitId={visit.id} kind="clock_in" home={home} patientName={patientName} />
        </Card>
      ) : null}

      {status === 'in_progress' ? (
        <>
          <Notice tone="warning" icon="time" title={`On visit · ${startedAt ? formatClock(now - new Date(startedAt).getTime()) : '—'}`}>
            {`Clocked in at ${formatTime(startedAt)}. Record the vitals, then clock out when you leave.`}
          </Notice>
          <SectionTitle title="Visit report" />
          <Card>
            <VitalsForm value={report} onChange={updateReport} />
          </Card>
          <ClockButton
            visitId={visit.id}
            kind="clock_out"
            home={home}
            patientName={patientName}
            report={report}
            disabled={reportHasErrors(report)}
          />
        </>
      ) : null}

      {status === 'completed' ? (
        <Card>
          <Text style={text.h3}>Visit completed</Text>
          {visit.started_at && visit.ended_at ? (
            <Text style={text.muted}>
              {formatTime(visit.started_at)} – {formatTime(visit.ended_at)} ·{' '}
              {formatDuration(new Date(visit.ended_at).getTime() - new Date(visit.started_at).getTime())}
            </Text>
          ) : (
            <Text style={text.muted}>Waiting for signal to sync.</Text>
          )}
          {report_ ? <VitalsSummary report={report_} /> : null}
        </Card>
      ) : null}

      {status === 'declined' ? (
        <Notice tone="neutral" icon="close-circle" title="You declined this request">
          {visit.decline_reason ?? 'The office will reassign it.'}
        </Notice>
      ) : null}
      {status === 'cancelled' ? <Notice tone="neutral" icon="close-circle" title="The patient cancelled this visit" /> : null}

      {events.length > 0 || queued.length > 0 ? (
        <>
          <SectionTitle title="Clock-in record" />
          <Card>
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
            {queued.map((i) => (
              <PendingRow key={i.id} item={i} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
