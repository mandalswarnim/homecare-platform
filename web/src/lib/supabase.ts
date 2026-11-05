import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Browser-only Supabase client. The publishable key is public by design: every table is
 * protected by row-level security, and only accounts with the admin role can read the
 * whole organisation's data.
 */
export function supabase(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("The Supabase client is only used in the browser in this app.");
  }
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in web/.env.local.",
    );
  }
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "careround.console.auth",
    },
  });
  return client;
}
