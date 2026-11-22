/**
 * Build-time pairing config. Do not hardcode a project URL or key.
 *
 *   SUPABASE_URL       https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY  the anon public key (never the service role key)
 *
 * app.config.js copies them to `extra.supabaseUrl` and `extra.supabaseAnonKey`.
 * plugins/withAppleWatch.js copies them into Info.plist and the watch target.
 * Set both on the iOS build (the watch ships inside the iPhone app) and the tvOS build.
 */

import type { RelayConfig } from './realtime';

export const SUPABASE_URL_ENV = 'SUPABASE_URL';
export const SUPABASE_ANON_KEY_ENV = 'SUPABASE_ANON_KEY';

export function relayConfigFromExtra(extra: unknown): RelayConfig | null {
  if (!extra || typeof extra !== 'object') return null;
  const record = extra as Record<string, unknown>;
  if (typeof record.supabaseUrl !== 'string' || typeof record.supabaseAnonKey !== 'string') return null;
  const url = record.supabaseUrl.trim().replace(/\/$/, '');
  const anonKey = record.supabaseAnonKey.trim();
  if (!url.startsWith('https://') || url.includes('$(')) return null;
  if (anonKey.length < 20 || anonKey.includes('$(') || anonKey.includes('YOUR_ANON')) return null;
  return { url, anonKey };
}
