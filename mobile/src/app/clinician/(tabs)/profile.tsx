import { useState } from 'react';

import { Avatar, Button, Card, InfoRow, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { flushOutbox, useOutbox } from '@/lib/outbox';

export default function ClinicianProfile() {
  const { session, profile, signOut } = useAuth();
  const outbox = useOutbox();
  const [confirm, setConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const pending = outbox.filter((i) => i.status === 'pending').length;

  async function syncNow() {
    setSyncing(true);
    await flushOutbox();
    setSyncing(false);
  }

  return (
    <Screen title="Profile">
      <Card>
        <InfoRow
          icon="person-outline"
          label={profile?.role === 'doctor' ? 'Doctor' : 'Nurse'}
          value={profile?.full_name ?? ''}
          right={<Avatar name={profile?.full_name} />}
        />
        {profile?.specialty ? <InfoRow icon="ribbon-outline" label="Specialty" value={profile.specialty} /> : null}
        <InfoRow icon="mail-outline" label="Signed in as" value={session?.user.email ?? ''} />
        {profile?.phone ? <InfoRow icon="call-outline" label="Phone" value={profile.phone} /> : null}
      </Card>

      <Card>
        <InfoRow
          icon={pending > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'}
          label="Offline sync"
          value={pending > 0 ? `${pending} event${pending > 1 ? 's' : ''} waiting for signal` : 'Everything is synced'}
        />
        {pending > 0 ? <Button title="Sync now" variant="secondary" icon="refresh" loading={syncing} onPress={() => void syncNow()} /> : null}
      </Card>

      {confirm && pending > 0 ? (
        <Notice tone="warning" icon="alert-circle" title="You have unsynced clock events">
          They stay on this phone and sync after you sign back in. Sign out anyway?
        </Notice>
      ) : null}
      <Button
        title={confirm && pending > 0 ? 'Sign out anyway' : 'Sign out'}
        variant="secondary"
        icon="log-out-outline"
        onPress={() => {
          if (pending > 0 && !confirm) setConfirm(true);
          else void signOut();
        }}
      />
    </Screen>
  );
}
