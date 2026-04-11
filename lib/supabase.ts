import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export function createClientSideClient() {
  const isClient = typeof window !== "undefined";
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: isClient,
    },
  });
}

export type { Lead } from "@/lib/types/crm";
