import { StyleSheet, Text, View } from 'react-native';

import { formatDuration, formatWhen } from '@/lib/format';
import { colors, toneColors, type Tone } from '@/lib/theme';
import type { VisitDetail } from '@/lib/types';

type Step = { label: string; time?: string | null; detail?: string | null; done: boolean; tone?: Tone };

/** Patient-facing progress: requested → confirmed → arrived → completed. */
export function VisitTimeline({ visit }: { visit: VisitDetail }) {
  const steps: Step[] = [{ label: 'Request sent', time: visit.created_at, done: true }];

  if (visit.status === 'cancelled') {
    if (visit.accepted_at) steps.push({ label: 'Confirmed', time: visit.accepted_at, done: true });
    steps.push({ label: 'Cancelled', time: visit.cancelled_at, done: true, tone: 'neutral' });
  } else if (visit.status === 'declined') {
    steps.push({
      label: 'Declined by clinician',
      detail: visit.decline_reason ?? 'Our team will find another clinician for you.',
      done: true,
      tone: 'danger',
    });
  } else {
    steps.push({
      label: visit.clinician_id ? 'Confirmed' : 'Waiting for a clinician',
      time: visit.accepted_at,
      detail: visit.accepted_at ? visit.clinician?.full_name : null,
      done: Boolean(visit.accepted_at),
    });
    steps.push({ label: 'Clinician arrived', time: visit.started_at, done: Boolean(visit.started_at) });
    steps.push({
      label: 'Visit completed',
      time: visit.ended_at,
      detail:
        visit.started_at && visit.ended_at
          ? `Visit lasted ${formatDuration(new Date(visit.ended_at).getTime() - new Date(visit.started_at).getTime())}`
          : null,
      done: Boolean(visit.ended_at),
    });
  }

  return (
    <View>
      {steps.map((step, i) => {
        const tone = toneColors[step.tone ?? 'primary'];
        const last = i === steps.length - 1;
        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, step.done ? { backgroundColor: tone.fg, borderColor: tone.fg } : styles.dotTodo]} />
              {!last ? <View style={[styles.line, step.done ? { backgroundColor: tone.fg } : null]} /> : null}
            </View>
            <View style={[styles.body, !last && styles.bodySpacing]}>
              <Text style={[styles.label, !step.done && styles.todo]}>{step.label}</Text>
              {step.time ? <Text style={styles.meta}>{formatWhen(step.time)}</Text> : null}
              {step.detail ? <Text style={styles.meta}>{step.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 3 },
  dotTodo: { backgroundColor: colors.surface, borderColor: colors.border },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
  bodySpacing: { paddingBottom: 16 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  todo: { color: colors.textFaint },
  meta: { fontSize: 13, color: colors.textMuted },
});
