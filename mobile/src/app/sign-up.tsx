import { router } from 'expo-router';
import { useState } from 'react';

import { BrandHeader } from '@/components/brand';
import { Button, Card, Field, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const valid = fullName.trim().length > 1 && phone.trim().length > 5 && email.includes('@') && password.length >= 6;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim(), address: address.trim() } },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else if (!data.session) setCheckEmail(true);
    // With a session, the router moves to the patient home automatically.
  }

  return (
    <Screen>
      <BrandHeader subtitle="Create your patient account" />
      {checkEmail ? (
        <Notice tone="info" icon="mail" title="Check your email">
          We sent a confirmation link to {email}. Open it, then come back and sign in.
        </Notice>
      ) : null}
      <Card>
        <Field label="Full name" placeholder="e.g. Aya Kouassi" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Field
          label="Phone number"
          placeholder="Your mobile number"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
        />
        <Field
          label="Home address"
          placeholder="House, street, area — and a landmark"
          hint="You'll also pin your exact location from home in the next step."
          value={address}
          onChangeText={setAddress}
        />
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder="At least 6 characters"
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Notice tone="danger" icon="alert-circle" title={error} /> : null}
        <Button title="Create account" onPress={() => void submit()} loading={busy} disabled={!valid} />
      </Card>
      <Button title="I already have an account" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
