import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS, formatWhen } from '@/lib/format';
import { serviceIcon } from '@/lib/services';
import { colors } from '@/lib/theme';
import type { VisitDetail } from '@/lib/types';

import { Badge, Card } from './ui';

export function VisitCard({
  visit,
  perspective,
  onPress,
  footer,
  badge,
}: {
  visit: VisitDetail;
  perspective: 'patient' | 'clinician';
  onPress?: () => void;
  footer?: ReactNode;
  /** override the status badge (e.g. "Saved offline") */
  badge?: ReactNode;
}) {
  const status = STATUS[visit.status];
  const who =
    perspective === 'patient'
      ? visit.clinician?.full_name ?? 'First available clinician'
      : visit.patient?.profile?.full_name ?? 'Patient';

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={serviceIcon(visit.service_type)} size={20} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {visit.service_type}
          </Text>
          <Text style={styles.meta}>{formatWhen(visit.scheduled_start)}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {who}
            {perspective === 'clinician' && visit.patient?.address ? ` · ${visit.patient.address}` : ''}
          </Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
      </View>
      <View style={styles.badges}>
        {badge ?? <Badge label={perspective === 'patient' ? status.patient : status.clinician} tone={status.tone} />}
      </View>
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
