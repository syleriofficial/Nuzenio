const defaultSupabaseUrl = 'https://ujmhbyrqpnjrayhoukko.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_zCDPDU6zUkABJo9GuYhEKg_U0KUcK7Z';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || defaultSupabasePublishableKey;

let clientPromise = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => (
      createClient(supabaseUrl, supabaseAnonKey)
    ));
  }
  return clientPromise;
}
