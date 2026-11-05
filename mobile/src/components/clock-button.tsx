import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage, flagText, formatDistance } from '@/lib/format';
import { ensureLocationPermission, getBestFix, previewCheck, type Fix, type Home } from '@/lib/location';
import { queueClockEvent } from '@/lib/outbox';
import { colors } from '@/lib/theme';
import type { EventKind, ReportInput } from '@/lib/types';

import { Button, Field, Notice } from './ui';

/**
 * Clock in / clock out. Takes the best GPS reading it can get in ~15 s, checks it against the
 * patient's home pin, and queues the event (works offline). Never blocks: if something looks
 * wrong the clinician gives a reason and the office reviews it.
 */
export function ClockButton({
  visitId,
  kind,
  home,
  patientName,
  report,
  disabled,
}: {
  visitId: string;
  kind: EventKind;
  home: Home | null;
  patientName: string;
  report?: ReportInput | null;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'locating' | 'review'>('idle');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const label = kind === 'clock_in' ? 'Clock in' : 'Clock out';

  async function commit(reading: Fix, note: string) {
    await queueClockEvent({ visitId, kind, fix: reading, note, report: kind === 'clock_out' ? report : null });
    setPhase('idle');
    setReason('');
    setFix(null);
    setFlags([]);
  }

  async function start() {
    setError(null);
    setAccuracy(null);
    setPhase('locating');
    try {
      if (!(await ensureLocationPermission())) {
        throw new Error('Location access is needed to clock in and out. Turn it on in Settings.');
      }
      const reading = await getBestFix({ onUpdate: (f) => setAccuracy(f.accuracy) });
      const check = previewCheck(reading, home);
      if (check.flags.length === 0) {
        await commit(reading, '');
        return;
      }
      setFix(reading);
      setFlags(check.flags);
      setDistance(check.distance);
      setPhase('review');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }

  if (phase === 'review' && fix) {
    const onlyNoPin = flags.length === 1 && flags[0] === 'no_home_pin';
    const title = flags.includes('outside_area')
      ? `You're ${formatDistance(distance)} from ${patientName}'s home`
      : flagText(flags[0]);
    return (
      <Notice tone="warning" icon="alert-circle" title={title}>
        <View style={styles.review}>
          <Text style={styles.body}>
            {flags.map(flagText).join(' · ')}. You can still {label.toLowerCase()} — the office will review it.
          </Text>
          <Field
            label={onlyNoPin ? 'Note (optional)' : 'Reason'}
            placeholder={onlyNoPin ? 'Anything the office should know' : "e.g. Patient was at a relative's house"}
            value={reason}
            onChangeText={setReason}
          />
          <Button
            title={`${label} anyway`}
            variant={kind === 'clock_in' ? 'primary' : 'success'}
            disabled={!onlyNoPin && reason.trim().length < 3}
            onPress={() => void commit(fix, reason)}
          />
          <View style={styles.row}>
            <Button style={styles.flex} title="Try GPS again" variant="secondary" icon="refresh" onPress={() => void start()} />
            <Button style={styles.flex} title="Cancel" variant="ghost" onPress={() => setPhase('idle')} />
          </View>
        </View>
      </Notice>
    );
  }

  return (
    <View style={styles.wrap}>
      <Button
        size="lg"
        variant={kind === 'clock_in' ? 'primary' : 'success'}
        icon={kind === 'clock_in' ? 'log-in-outline' : 'log-out-outline'}
        title={
          phase === 'locating'
            ? accuracy != null
              ? `Getting location… ±${Math.round(accuracy)} m`
              : 'Getting your location…'
            : label
        }
        disabled={disabled || phase === 'locating'}
        onPress={() => void start()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  review: { gap: 12, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  error: { fontSize: 14, color: colors.danger, fontWeight: '600', textAlign: 'center' },
});
