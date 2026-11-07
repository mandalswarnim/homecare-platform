import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand';
import { Button, Card, Chip, Field, Notice, Screen, text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// Dev-only shortcuts: fills the email of a seeded demo account (the password is never in the app).
const DEMO_ACCOUNTS = [
  { label: 'Doctor', email: 'dr.aya@example.com' },
  { label: 'Nurse', email: 'nurse.adjoua@example.com' },
  { label: 'Patient', email: 'amenan@example.com' },
];

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Wrong email or password.' : authError.message);
    }
    // On success the auth listener updates the session and the router moves on automatically.
  }

  return (
    <Screen>
      <BrandHeader />
      <Card>
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder="Your password"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
        />
        {error ? <Notice tone="danger" icon="alert-circle" title={error} /> : null}
        <Button title="Sign in" onPress={() => void submit()} loading={busy} disabled={!email || !password} />
      </Card>

      <Card>
        <Text style={text.h3}>New patient?</Text>
        <Text style={text.muted}>Create an account to book home visits from doctors and nurses.</Text>
        <Button title="Create a patient account" variant="secondary" icon="person-add-outline" onPress={() => router.push('/sign-up')} />
      </Card>

      {__DEV__ ? (
        <View style={styles.demo}>
          <Text style={text.small}>Demo accounts (password is in your .env):</Text>
          <View style={styles.chips}>
            {DEMO_ACCOUNTS.map((a) => (
              <Chip key={a.email} label={a.label} selected={email === a.email} onPress={() => setEmail(a.email)} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  demo: { gap: 8, alignItems: 'center', marginTop: 8 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
});
