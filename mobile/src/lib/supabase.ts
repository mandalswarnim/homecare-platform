import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { storage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// On phones, only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
