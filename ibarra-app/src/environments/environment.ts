/**
 * DESARROLLO remote. Used by `pnpm start` / `ng serve`.
 * Secrets come from `.env.development` via `scripts/sync-env.mjs`.
 * For local Supabase CLI, use `pnpm dev` (loads environment.local.ts).
 */
import { envValues } from './environment.values';

export const environment = {
  production: false,
  supabaseUrl: envValues.supabaseUrl,
  supabaseKey: envValues.supabaseKey,
  apiUrl: envValues.apiUrl,
  authToken: envValues.authToken,
};
