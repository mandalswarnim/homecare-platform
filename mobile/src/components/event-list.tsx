import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { flagText, formatDistance, formatTime } from '@/lib/format';
import { discardItem, retryItem, type OutboxItem } from '@/lib/outbox';
import { colors } from '@/lib/theme';
import type { VisitEvent } from '@/lib/types';

import { Button } from './ui';

const kindLabel = (kind: VisitEvent['kind']) => (kind === 'clock_in' ? 'Clocked in' : 'Clocked out');

export function EventRow({ event }: { event: VisitEvent }) {
  const details = [
    event.distance_m != null ? `${formatDistance(event.distance_m)} from home` : null,
    event.accuracy_m != null ? `GPS ±${Math.round(event.accuracy_m)} m` : null,
    event.was_offline ? 'synced after being offline' : null,
  ].filter(Boolean);

  return (
    <View style={styles.row}>
      <Ionicons
        name={event.verified ? 'shield-checkmark' : 'alert-circle'}
        size={22}
        color={event.verified ? colors.success : colors.warning}
      />
      <View style={styles.body}>
        <Text style={styles.title}>
          {kindLabel(event.kind)} at {formatTime(event.occurred_at)}
        </Text>
        <Text style={[styles.status, { color: event.verified ? colors.success : colors.warning }]}>
          {event.verified ? "Verified at the patient's home" : event.flags.map(flagText).join(' · ')}
        </Text>
        {details.length > 0 ? <Text style={styles.meta}>{details.join(' · ')}</Text> : null}
        {event.note ? <Text style={styles.meta}>Note: {event.note}</Text> : null}
      </View>
    </View>
  );
}

export function PendingRow({ item }: { item: OutboxItem }) {
  const failed = item.status === 'failed';
  return (
    <View style={styles.row}>
      {failed ? (
        <Ionicons name="cloud-offline" size={22} color={colors.danger} />
      ) : (
        <ActivityIndicator color={colors.info} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>
          {kindLabel(item.kind)} at {formatTime(item.createdAt)}
        </Text>
        <Text style={[styles.status, { color: failed ? colors.danger : colors.info }]}>
          {failed ? `Couldn't sync: ${item.error}` : 'Saved on this phone — syncs automatically'}
        </Text>
        {failed ? (
          <View style={styles.actions}>
            <Button size="sm" title="Retry" icon="refresh" onPress={() => retryItem(item.id)} />
            <Button size="sm" variant="danger" title="Discard" onPress={() => discardItem(item.id)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  status: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
