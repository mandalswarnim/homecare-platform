import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { errorMessage, formatDay } from '@/lib/format';
import { ensureLocationPermission, getBestFix } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { Patient } from '@/lib/types';

import { useNotify } from './notify';
import { Button, Notice } from './ui';

/** Lets a patient pin their home with the phone's GPS — the reference point for verified visits. */
export function HomeLocationCard({ patient, onSaved }: { patient: Patient | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();
  const isSet = patient?.home_lat != null && patient?.home_lng != null;

  async function pinHome() {
    setBusy(true);
    setError(null);
    setAccuracy(null);
    try {
      if (!(await ensureLocationPermission())) throw new Error('Allow location access so we can pin your home.');
      const fix = await getBestFix({ targetAccuracy: 25, onUpdate: (f) => setAccuracy(f.accuracy) });
      const { error: rpcError } = await supabase.rpc('set_home_location', {
        p_lat: fix.lat,
        p_lng: fix.lng,
        p_accuracy_m: fix.accuracy,
      });
      if (rpcError) throw rpcError;
      notify({
        title: isSet ? 'Home location updated' : 'Home location saved',
        body: `${fix.accuracy != null ? `Pinned to within ±${Math.round(fix.accuracy)} m. ` : ''}Your clinician will use it to find you.`,
        tone: 'success',
        icon: 'home',
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const locatingLabel = accuracy != null ? `Locating… ±${Math.round(accuracy)} m` : 'Locating…';

  return (
    <Notice
      tone={isSet ? 'success' : 'warning'}
      icon={isSet ? 'home' : 'location'}
      title={isSet ? 'Home location saved' : 'Pin your home location'}
      action={
        <Button
          size={isSet ? 'sm' : 'md'}
          variant={isSet ? 'secondary' : 'primary'}
          icon="locate"
          title={busy ? locatingLabel : isSet ? "Update — I'm at home now" : "I'm at home — use my location"}
          onPress={pinHome}
          disabled={busy}
        />
      }>
      <Text style={styles.body}>
        {isSet
          ? `Pinned ${patient?.home_set_at ? formatDay(patient.home_set_at).toLowerCase() : ''}${
              patient?.home_accuracy_m ? `, accurate to ±${Math.round(patient.home_accuracy_m)} m` : ''
            }. Your clinician uses it to find you and to confirm each visit.`
          : "Do this once while you're at home. Your clinician uses it to find you, and it lets us confirm that every visit really happened."}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Notice>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, color: colors.text, marginTop: 2, lineHeight: 20 },
  error: { fontSize: 13, color: colors.danger, fontWeight: '600', marginTop: 6 },
});
