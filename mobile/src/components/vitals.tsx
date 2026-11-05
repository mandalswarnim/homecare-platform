import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/lib/theme';
import type { ReportInput, VisitReport } from '@/lib/types';

import { Field } from './ui';

export const EMPTY_REPORT: ReportInput = {
  bp_systolic: '',
  bp_diastolic: '',
  pulse_bpm: '',
  temperature_c: '',
  spo2_pct: '',
  glucose_mmol: '',
  notes: '',
};

type VitalKey = Exclude<keyof ReportInput, 'notes'>;
type Range = { min: number; max: number; low?: number; high?: number; integer?: boolean };

// Hard limits mirror the database; low/high are "double-check" warnings, never blockers.
const RANGES: Record<VitalKey, Range> = {
  bp_systolic: { min: 40, max: 300, low: 90, high: 140, integer: true },
  bp_diastolic: { min: 20, max: 200, low: 60, high: 90, integer: true },
  pulse_bpm: { min: 20, max: 250, low: 50, high: 110, integer: true },
  temperature_c: { min: 25, max: 45, low: 35.5, high: 37.9 },
  spo2_pct: { min: 40, max: 100, low: 94, integer: true },
  glucose_mmol: { min: 0.5, max: 50, low: 4, high: 11 },
};

export function checkVital(key: VitalKey, raw: string): { error?: string; warn?: 'Low' | 'High' } {
  const value = raw.trim();
  if (!value) return {};
  const n = Number(value.replace(',', '.'));
  const r = RANGES[key];
  if (!Number.isFinite(n) || n < r.min || n > r.max) return { error: `Must be ${r.min}–${r.max}` };
  if (r.integer && !Number.isInteger(n)) return { error: 'Whole number only' };
  if (r.low != null && n < r.low) return { warn: 'Low' };
  if (r.high != null && n > r.high) return { warn: 'High' };
  return {};
}

export const reportHasErrors = (report: ReportInput) =>
  (Object.keys(RANGES) as VitalKey[]).some((key) => checkVital(key, report[key]).error);

export function VitalsForm({ value, onChange }: { value: ReportInput; onChange: (next: ReportInput) => void }) {
  const field = (key: VitalKey, label: string, placeholder: string, decimal = false) => {
    const check = checkVital(key, value[key]);
    return (
      <View style={styles.half}>
        <Field
          label={label}
          placeholder={placeholder}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          value={value[key]}
          onChangeText={(t) => onChange({ ...value, [key]: t })}
          error={check.error}
          hint={check.warn ? `${check.warn} — double-check` : undefined}
        />
      </View>
    );
  };

  return (
    <View style={styles.form}>
      <View style={styles.pair}>
        {field('bp_systolic', 'BP systolic', '120')}
        {field('bp_diastolic', 'BP diastolic', '80')}
      </View>
      <View style={styles.pair}>
        {field('pulse_bpm', 'Pulse (bpm)', '72')}
        {field('spo2_pct', 'SpO₂ (%)', '98')}
      </View>
      <View style={styles.pair}>
        {field('temperature_c', 'Temperature (°C)', '36.8', true)}
        {field('glucose_mmol', 'Blood sugar (mmol/L)', '5.6', true)}
      </View>
      <Field
        label="Visit notes"
        placeholder="Care given, observations, follow-up…"
        multiline
        value={value.notes}
        onChangeText={(t) => onChange({ ...value, notes: t })}
      />
    </View>
  );
}

export function VitalsSummary({ report }: { report: VisitReport }) {
  const tiles: { label: string; value: string; unit: string; warn?: string }[] = [];
  const warn = (key: VitalKey, v: number | null) => (v == null ? undefined : checkVital(key, String(v)).warn);

  if (report.bp_systolic != null && report.bp_diastolic != null) {
    tiles.push({
      label: 'Blood pressure',
      value: `${report.bp_systolic}/${report.bp_diastolic}`,
      unit: 'mmHg',
      warn: warn('bp_systolic', report.bp_systolic) ?? warn('bp_diastolic', report.bp_diastolic),
    });
  }
  if (report.pulse_bpm != null) tiles.push({ label: 'Pulse', value: String(report.pulse_bpm), unit: 'bpm', warn: warn('pulse_bpm', report.pulse_bpm) });
  if (report.temperature_c != null) tiles.push({ label: 'Temperature', value: String(report.temperature_c), unit: '°C', warn: warn('temperature_c', report.temperature_c) });
  if (report.spo2_pct != null) tiles.push({ label: 'SpO₂', value: String(report.spo2_pct), unit: '%', warn: warn('spo2_pct', report.spo2_pct) });
  if (report.glucose_mmol != null) tiles.push({ label: 'Blood sugar', value: String(report.glucose_mmol), unit: 'mmol/L', warn: warn('glucose_mmol', report.glucose_mmol) });

  return (
    <View style={styles.form}>
      {tiles.length > 0 ? (
        <View style={styles.grid}>
          {tiles.map((t) => (
            <View key={t.label} style={[styles.tile, t.warn ? styles.tileWarn : null]}>
              <Text style={styles.tileLabel}>{t.label}</Text>
              <Text style={styles.tileValue}>
                {t.value} <Text style={styles.tileUnit}>{t.unit}</Text>
              </Text>
              {t.warn ? <Text style={styles.tileWarnText}>{t.warn}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {report.notes ? <Text style={styles.notes}>{report.notes}</Text> : null}
      {tiles.length === 0 && !report.notes ? <Text style={styles.notesMuted}>No vitals were recorded.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    gap: 2,
  },
  tileWarn: { backgroundColor: colors.warningSoft },
  tileLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  tileUnit: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  tileWarnText: { fontSize: 12, fontWeight: '700', color: colors.warning },
  notes: { fontSize: 15, color: colors.text, lineHeight: 22 },
  notesMuted: { fontSize: 14, color: colors.textMuted },
});
