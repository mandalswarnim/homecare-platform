import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotifyProvider } from '@/components/notify';
import { AuthProvider, useAuth } from '@/lib/auth';
import { startOutboxSync } from '@/lib/outbox';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotifyProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </NotifyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const signedIn = Boolean(session);
  const role = profile?.role;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  // Keep retrying queued clock-ins/outs while someone is signed in.
  useEffect(() => {
    if (!signedIn) return;
    return startOutboxSync();
  }, [signedIn]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === 'patient'}>
        <Stack.Screen name="patient" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && (role === 'doctor' || role === 'nurse')}>
        <Stack.Screen name="clinician" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}
