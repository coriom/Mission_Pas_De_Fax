// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ✅ Ne crash pas au build (pas de throw à l'import)
 * ✅ TypeScript est content (supabase n'est pas nullable)
 * ❗ Si les env vars manquent, ça throw uniquement quand tu essaies d'utiliser supabase.*
 */
function createSafeSupabaseClient(): SupabaseClient {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  // Proxy qui throw uniquement à l'utilisation (pas pendant le prerender)
  const err = new Error(
    "Supabase environment variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );

  return new Proxy({} as SupabaseClient, {
    get() {
      throw err;
    },
  });
}

export const supabase: SupabaseClient = createSafeSupabaseClient();
