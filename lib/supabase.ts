import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase client initialization:");
console.log("URL exists:", !!supabaseUrl);
console.log("Key exists:", !!supabaseAnonKey);
console.log("URL:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});

export type Lead = {
  id: string;
  full_name: string;
  platform: string;
  email: string;
  phone: string;
  zip_code: string;
  utm_campaign: string;
  lead_score_value: number;
  lead_score: "hot" | "warm" | "cold";
  created_at: string;
  credit_score?: string;
  timeline?: string;
  down_payment?: string;
  status?: string;
  retailer_item_id?: string;
};
