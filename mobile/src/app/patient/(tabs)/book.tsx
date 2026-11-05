import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeLocationCard } from '@/components/home-location-card';
import { Avatar, Button, Card, Chip, Field, Notice, Screen, SectionTitle, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDay, formatWhen, startOfDay } from '@/lib/format';
import { SERVICES, type Service } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';
import type { ClinicianSummary, Patient, Visit } from '@/lib/types';

const DAYS_AHEAD = 7;

function timeSlots(day: Date) {
  const slots: string[] = [];
  const earliest = Date.now() + 30 * 60_000;
  for (let h = 8; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) continue;
      const t = new Date(day);
      t.setHours(h, m, 0, 0);
      if (t.getTime() >= earliest) slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

const slotLabel = (hhmm: string, day: Date) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(atTime(day, hhmm));

export default function BookVisit() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [clinicians, setClinicians] = useState<ClinicianSummary[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [clinicianId, setClinicianId] = useState<string>('any');
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [p, c] = await Promise.all([
      supabase
        .from('patients')
        .select('id, address, home_lat, home_lng, home_accuracy_m, home_set_at, geofence_radius_m')
        .eq('id', uid)
        .maybeSingle(),
      supabase.from('profiles').select('id, full_name, role, specialty, phone').in('role', ['doctor', 'nurse']).order('role').order('full_name'),
    ]);
    setPatient(p.data as Patient | null);
    setClinicians((c.data ?? []) as ClinicianSummary[]);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const today = startOfDay(new Date());
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(today.getTime() + i * 86_400_000));
  const day = days[dayOffset];
  const slots = timeSlots(day);
  const eligible = clinicians.filter((c) => !service || service.who === 'any' || c.role === service.who);
  const chosen = clinicians.find((c) => c.id === clinicianId) ?? null;
  const start = time ? atTime(day, time) : null;
  const ready = Boolean(service && start);

  function chooseService(s: Service) {
    setService(s);
    const stillEligible = clinicians.some((c) => c.id === clinicianId && (s.who === 'any' || c.role === s.who));
    if (!stillEligible) setClinicianId('any');
  }

  async function submit() {
    if (!service || !start) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('request_visit', {
      p_service_type: service.name,
      p_scheduled_start: start.toISOString(),
      p_clinician_id: clinicianId === 'any' ? null : clinicianId,
      p_reason: reason.trim() || null,
      p_duration_minutes: service.minutes,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setService(null);
    setTime(null);
    setReason('');
    setClinicianId('any');
    router.push(`/patient/visit/${(data as Visit).id}`);
  }

  return (
    <Screen title="Book a visit" subtitle="A doctor or nurse comes to your home">
      {patient && patient.home_lat == null ? <HomeLocationCard patient={patient} onSaved={() => void load()} /> : null}

      <SectionTitle title="1 · What do you need?" />
      <View style={styles.services}>
        {SERVICES.map((s) => {
          const selected = service?.name === s.name;
          return (
            <Pressable
              key={s.name}
              onPress={() => chooseService(s)}
              style={({ pressed }) => [styles.service, selected && styles.serviceSelected, pressed && !selected && styles.servicePressed]}>
              <Ionicons name={s.icon} size={22} color={selected ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.serviceName, selected && styles.selectedText]}>{s.name}</Text>
              <Text style={[styles.serviceBlurb, selected && styles.selectedBlurb]} numberOfLines={2}>
                {s.blurb}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="2 · Who would you like?" />
      <Card style={styles.list}>
        <ClinicianOption
          selected={clinicianId === 'any'}
          title="First available"
          subtitle="The first suitable clinician to accept"
          onPress={() => setClinicianId('any')}
        />
        {eligible.map((c) => (
          <ClinicianOption
            key={c.id}
            name={c.full_name}
            selected={clinicianId === c.id}
            title={c.full_name}
            subtitle={c.specialty ?? (c.role === 'doctor' ? 'Doctor' : 'Nurse')}
            onPress={() => setClinicianId(c.id)}
          />
        ))}
      </Card>

      <SectionTitle title="3 · When?" />
      <View style={styles.chips}>
        {days.map((d, i) => (
          <Chip
            key={d.toISOString()}
            label={formatDay(d)}
            selected={dayOffset === i}
            onPress={() => {
              setDayOffset(i);
              setTime(null);
            }}
          />
        ))}
      </View>
      {slots.length === 0 ? (
        <Text style={text.muted}>No more times today — pick another day.</Text>
      ) : (
        <View style={styles.chips}>
          {slots.map((s) => (
            <Chip key={s} label={slotLabel(s, day)} selected={time === s} onPress={() => setTime(s)} />
          ))}
        </View>
      )}

      <SectionTitle title="4 · Anything we should know?" />
      <Field
        label="Reason for the visit (optional)"
        placeholder="e.g. Follow-up after hospital, dressing change, feeling dizzy…"
        multiline
        value={reason}
        onChangeText={setReason}
      />

      {ready && service && start ? (
        <Notice tone="primary" icon="calendar" title={service.name}>
          {`${formatWhen(start.toISOString())} · ${chosen ? chosen.full_name : 'first available clinician'} · about ${service.minutes} min`}
        </Notice>
      ) : null}
      {error ? <Notice tone="danger" icon="alert-circle" title="Couldn't book the visit">{error}</Notice> : null}
      <Button size="lg" title="Request visit" icon="send" disabled={!ready} loading={busy} onPress={() => void submit()} />
    </Screen>
  );
}

function ClinicianOption({
  title,
  subtitle,
  name,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  name?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
      {name ? (
        <Avatar name={name} size={40} />
      ) : (
        <View style={styles.anyIcon}>
          <Ionicons name="people" size={20} color={colors.primary} />
        </View>
      )}
      <View style={styles.optionText}>
        <Text style={text.h3}>{title}</Text>
        <Text style={text.small}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  service: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  serviceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  servicePressed: { backgroundColor: colors.neutralSoft },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.text },
  serviceBlurb: { fontSize: 13, color: colors.textMuted },
  selectedText: { color: '#FFFFFF' },
  selectedBlurb: { color: '#D5EEEB' },
  list: { padding: 6, gap: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md },
  optionPressed: { backgroundColor: colors.neutralSoft },
  optionText: { flex: 1 },
  anyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
