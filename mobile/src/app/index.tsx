import { Redirect } from 'expo-router';

import { Button, Loading, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';

/** Entry point: sends each person to their part of the app. */
export default function Index() {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth();

  if (!isConfigured) {
    return (
      <Screen title="Almost there">
        <Notice tone="warning" icon="construct" title="Backend not configured">
          Copy mobile/.env.example to mobile/.env, fill in the Supabase URL and publishable key, then restart Expo.
        </Notice>
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) {
    return (
      <Screen title="Something went wrong">
        <Notice tone="danger" icon="alert-circle" title="We couldn't load your account">
          {profileError ?? 'Check your connection and try again.'}
        </Notice>
        <Button title="Try again" icon="refresh" onPress={() => void refreshProfile()} />
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      </Screen>
    );
  }
  if (profile.role === 'patient') return <Redirect href="/patient" />;
  if (profile.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href="/clinician" />;
}
