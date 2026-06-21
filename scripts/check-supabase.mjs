import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envFiles = ['.env.local', '.env'];

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

for (const file of envFiles) loadEnvFile(file);

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function fail(message) {
  console.error(`Supabase check failed: ${message}`);
  process.exitCode = 1;
}

if (!url || !anonKey) {
  fail('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
} else {
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anonClient.from('languages').select('code,name').limit(5);
  if (error) {
    fail(`Anon client connected, but languages table is not readable yet: ${error.message}`);
  } else {
    console.log(`Supabase anon connection OK: ${url}`);
    console.log(`Readable languages: ${(data || []).map((item) => item.code).join(', ') || 'none yet'}`);
  }
}

if (url && serviceKey) {
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count, error } = await serviceClient
    .from('news_cache')
    .select('*', { count: 'exact', head: true });
  if (error) {
    fail(`Service role connected, but news_cache check failed: ${error.message}`);
  } else {
    console.log(`Supabase service-role connection OK: news_cache rows=${count ?? 0}`);
  }
} else if (url) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY missing: server cache/admin checks skipped.');
}
