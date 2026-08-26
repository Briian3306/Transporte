/**
 * DESARROLLO remote. Used by `pnpm start` / `ng serve`.
 * Secrets come from `.env.development` via `scripts/sync-env.mjs`.
 * For local Supabase CLI, use `pnpm dev` (loads environment.local.ts).
 */
import { envValues } from './environment.values';

export const environment = {
  production: false as boolean,
  supabaseUrl: envValues.supabaseUrl as string,
  supabaseKey: envValues.supabaseKey as string,
  apiUrl: envValues.apiUrl as string,
  authToken: envValues.authToken as string,
  openRouterApiUrl: envValues.openRouterApiUrl as string,
  openRouterModel: envValues.openRouterModel as string,
  openRouterModel2: envValues.openRouterModel2 as string,
  openRouterApiKey: envValues.openRouterApiKey as string,
  openRouterApiKey2: envValues.openRouterApiKey2 as string,
};
