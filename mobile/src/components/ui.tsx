import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { initials } from '@/lib/format';
import type { IconName } from '@/lib/services';
import { colors, radius, toneColors, type Tone } from '@/lib/theme';

export function Screen({
  title,
  subtitle,
  right,
  children,
  refreshing = false,
  onRefresh,
  edges = ['top'],
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
        }>
        <View style={styles.content}>
          {title || right ? (
            <View style={styles.header}>
              <View style={styles.flex}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {right}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
      {children}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: '#FFFFFF', border: colors.primary },
  success: { bg: colors.success, pressed: '#11692F', fg: '#FFFFFF', border: colors.success },
  secondary: { bg: colors.surface, pressed: colors.neutralSoft, fg: colors.text, border: colors.border },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: '#F2C6C1' },
  ghost: { bg: 'transparent', pressed: colors.neutralSoft, fg: colors.primary, border: 'transparent' },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof buttonVariants;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={v.fg} /> : null}
          <Text style={[styles.buttonText, size === 'lg' && styles.buttonTextLg, size === 'sm' && styles.buttonTextSm, { color: v.fg }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  action,
}: {
  tone?: Tone;
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.fg + '33' }]}>
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={20} color={t.fg} style={styles.noticeIcon} /> : null}
        <View style={styles.flex}>
          <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text>
          {typeof children === 'string' ? <Text style={styles.noticeBody}>{children}</Text> : children}
        </View>
      </View>
      {action ? <View style={styles.noticeAction}>{action}</View> : null}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, props.multiline && styles.inputMultiline, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.chipPressed,
        disabled && styles.inactive,
      ]}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : colors.textMuted} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {right}
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function InfoRow({ icon, label, value, right }: { icon: IconName; label: string; value: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.infoIcon} />
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        {typeof value === 'string' ? <Text style={styles.infoValue}>{value}</Text> : value}
      </View>
      {right}
    </View>
  );
}

export function Avatar({ name, size = 40, tone = 'primary' }: { name: string | null | undefined; size?: number; tone?: Tone }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}>
      <Text style={[styles.avatarText, { color: t.fg, fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

export const Divider = () => <View style={styles.divider} />;

export const text = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  h3: { fontSize: 16, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  small: { fontSize: 13, color: colors.textMuted },
  link: { fontSize: 15, color: colors.primary, fontWeight: '600' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 4, marginTop: 4 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardPressed: { backgroundColor: '#FAFBFC' },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSm: { minHeight: 36, paddingHorizontal: 12 },
  buttonLg: { minHeight: 58, borderRadius: radius.lg },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSm: { fontSize: 14 },
  buttonTextLg: { fontSize: 18, fontWeight: '700' },
  inactive: { opacity: 0.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: 220,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { borderRadius: radius.md, borderWidth: 1, padding: 14, gap: 10 },
  noticeIcon: { marginRight: 10, marginTop: 1 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeBody: { fontSize: 14, color: colors.text, marginTop: 2, lineHeight: 20 },
  noticeAction: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  hint: { fontSize: 13, color: colors.textMuted },
  error: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPressed: { backgroundColor: colors.neutralSoft },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: '#FFFFFF' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  sectionTitleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { alignItems: 'center', padding: 24, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 20 },
  infoLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 15, color: colors.text, marginTop: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg, padding: 24 },
  loadingText: { fontSize: 15, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
