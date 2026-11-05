import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { HomeLocationCard } from '@/components/home-location-card';
import { Avatar, Button, Card, Field, InfoRow, Notice, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Patient } from '@/lib/types';

export default function PatientProfile() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const uid = session?.user.id;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('patients')
      .select('id, address, home_lat, home_lng, home_accuracy_m, home_set_at, geofence_radius_m')
      .eq('id', uid)
      .maybeSingle();
    const p = data as Patient | null;
    setPatient(p);
    setAddress(p?.address ?? '');
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save() {
    if (!uid) return;
    setSaving(true);
    setMessage(null);
    try {
      const [a, b] = await Promise.all([
        supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() || null }).eq('id', uid),
        supabase.from('patients').update({ address: address.trim() || null }).eq('id', uid),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      await refreshProfile();
      setMessage({ ok: true, text: 'Saved' });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Profile">
      <Card>
        <InfoRow icon="mail-outline" label="Signed in as" value={session?.user.email ?? ''} right={<Avatar name={profile?.full_name} />} />
      </Card>

      <SectionTitle title="Home location" />
      <HomeLocationCard patient={patient} onSaved={() => void load()} />

      <SectionTitle title="Your details" />
      <Card>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Field label="Home address" placeholder="House, street, area, landmark" value={address} onChangeText={setAddress} />
        {message ? <Notice tone={message.ok ? 'success' : 'danger'} title={message.text} /> : null}
        <Button title="Save changes" onPress={() => void save()} loading={saving} />
      </Card>

      <Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}
