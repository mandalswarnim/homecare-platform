import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { HomeLocationCard } from '@/components/home-location-card';
import { Button, Empty, Loading, Notice, Screen, SectionTitle } from '@/components/ui';
import { VisitCard } from '@/components/visit-card';
import { useAuth } from '@/lib/auth';
import { PATIENT_VISIT_SELECT, UPCOMING } from '@/lib/data';
import { greeting, shortName } from '@/lib/format';
import { useRealtime } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { Patient, VisitDetail } from '@/lib/types';

export default function PatientVisits() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const [visits, setVisits] = useState<VisitDetail[] | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const [v, p] = await Promise.all([
      supabase.from('visits').select(PATIENT_VISIT_SELECT).eq('patient_id', uid).order('scheduled_start', { ascending: true }),
      supabase
        .from('patients')
        .select('id, address, home_lat, home_lng, home_accuracy_m, home_set_at, geofence_radius_m')
        .eq('id', uid)
        .maybeSingle(),
    ]);
    if (v.error) setError(v.error.message);
    else {
      setVisits(v.data as VisitDetail[]);
      setError(null);
    }
    setPatient(p.data as Patient | null);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useRealtime('patient-visits', [{ table: 'visits', filter: `patient_id=eq.${uid}` }], () => void load(), Boolean(uid));

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!visits && !error) return <Loading />;

  const all = visits ?? [];
  const upcoming = all.filter((v) => UPCOMING.includes(v.status));
  const past = all.filter((v) => !UPCOMING.includes(v.status)).reverse();
  const open = (id: string) => router.push(`/patient/visit/${id}`);

  return (
    <Screen
      title={`${greeting()}${profile?.full_name ? `, ${shortName(profile.full_name)}` : ''}`}
      subtitle="Your home visits"
      refreshing={refreshing}
      onRefresh={() => void refresh()}>
      {error ? <Notice tone="danger" icon="cloud-offline" title="Couldn't load your visits">{error}</Notice> : null}
      {patient && patient.home_lat == null ? <HomeLocationCard patient={patient} onSaved={() => void load()} /> : null}

      <SectionTitle title="Upcoming" />
      {upcoming.length === 0 ? (
        <Empty
          icon="calendar-outline"
          title="No upcoming visits"
          body="Book a doctor or nurse to come to your home."
          action={<Button title="Book a visit" icon="add" onPress={() => router.push('/patient/book')} />}
        />
      ) : (
        upcoming.map((v) => <VisitCard key={v.id} visit={v} perspective="patient" onPress={() => open(v.id)} />)
      )}

      {past.length > 0 ? <SectionTitle title="Past visits" /> : null}
      {past.map((v) => (
        <VisitCard key={v.id} visit={v} perspective="patient" onPress={() => open(v.id)} />
      ))}
    </Screen>
  );
}
