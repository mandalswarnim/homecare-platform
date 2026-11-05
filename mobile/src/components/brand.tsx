import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { BRAND, colors } from '@/lib/theme';

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <Ionicons name="home" size={28} color="#FFFFFF" />
        <View style={styles.cross}>
          <Ionicons name="add" size={16} color={colors.primary} />
        </View>
      </View>
      <Text style={styles.name}>{BRAND.name}</Text>
      <Text style={styles.tagline}>{subtitle ?? BRAND.tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cross: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
});
