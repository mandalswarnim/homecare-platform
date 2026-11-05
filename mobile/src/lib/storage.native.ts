// iOS/Android: a persistent, synchronous localStorage backed by SQLite (recommended by Expo for Supabase).
import 'expo-sqlite/localStorage/install';

export const storage: Storage | undefined = globalThis.localStorage;
