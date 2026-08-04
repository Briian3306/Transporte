/**
 * Supabase CLI (local Docker). Used by `pnpm dev` / `pnpm dev:app`.
 * Secrets come from `.env.local` via `scripts/sync-env.mjs`.
 */
import { envValues } from './environment.values';

export const environment = {
  production: false,
  supabaseUrl: envValues.supabaseUrl,
  supabaseKey: envValues.supabaseKey,
  apiUrl: envValues.apiUrl,
  authToken: envValues.authToken,
};
