import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Module-level singleton — one GoTrueClient across the entire app.
// Previously each createClientSideClient() call spawned a new instance,
// causing "Multiple GoTrueClient instances" warnings and session conflicts.
let _client: SupabaseClient | null = null;

export function createClientSideClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export type { Lead } from "@/lib/types/crm";
