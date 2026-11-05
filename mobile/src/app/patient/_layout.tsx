import { Stack } from 'expo-router';

import { usePatientAlerts } from '@/lib/alerts';
import { colors } from '@/lib/theme';

export default function PatientLayout() {
  usePatientAlerts();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="visit/[id]" options={{ title: 'Visit details' }} />
    </Stack>
  );
}
