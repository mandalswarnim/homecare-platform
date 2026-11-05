import { Linking } from 'react-native';

import { Button, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const DASHBOARD_URL = process.env.EXPO_PUBLIC_DASHBOARD_URL;

export default function AdminInfo() {
  const { profile, signOut } = useAuth();
  return (
    <Screen title={`Hi, ${profile?.full_name ?? 'admin'}`} subtitle="Admin account">
      <Notice tone="info" icon="desktop-outline" title="Use the web dashboard">
        Admin tools — live map, every visit, verification flags and reports — are in the dashboard, which works best on a
        computer or tablet.
      </Notice>
      {DASHBOARD_URL ? (
        <Button title="Open dashboard" icon="open-outline" onPress={() => void Linking.openURL(DASHBOARD_URL)} />
      ) : null}
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
