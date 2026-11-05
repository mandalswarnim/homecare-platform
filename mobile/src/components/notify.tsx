import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/lib/services';
import { colors, radius, toneColors, type Tone } from '@/lib/theme';

type Note = { id: number; title: string; body?: string; tone?: Tone; icon?: IconName; onPress?: () => void };
type Notify = (note: Omit<Note, 'id'>) => void;

const NotifyContext = createContext<Notify>(() => {});

/** In-app banner for live events (new request, visit confirmed, clinician arrived…). */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<Note | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(timer);
  }, [note]);

  const notify = useCallback<Notify>((next) => {
    setNote({ ...next, id: Date.now() });
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, []);

  const tone = toneColors[note?.tone ?? 'primary'];

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      {note ? (
        <Pressable
          key={note.id}
          onPress={() => {
            note.onPress?.();
            setNote(null);
          }}
          style={[styles.wrap, { top: insets.top + 8 }]}>
          <View style={styles.banner}>
            <View style={[styles.icon, { backgroundColor: tone.bg }]}>
              <Ionicons name={note.icon ?? 'notifications'} size={20} color={tone.fg} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{note.title}</Text>
              {note.body ? (
                <Text style={styles.body} numberOfLines={2}>
                  {note.body}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ) : null}
    </NotifyContext.Provider>
  );
}

export const useNotify = () => useContext(NotifyContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000 },
  banner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
});
