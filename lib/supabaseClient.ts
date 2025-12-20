// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ここで undefined なら env 読めてない（console で気づける）
if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env missing:", { supabaseUrl, hasAnonKey: !!supabaseAnonKey });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
