/**
 * Production. Used by `pnpm build:prod`.
 * Secrets come from `.env.production` or Netlify NG_APP_* env vars via `scripts/sync-env.mjs`.
 */
import { envValues } from './environment.values';

export const environment = {
  production: true,
  supabaseUrl: envValues.supabaseUrl,
  supabaseKey: envValues.supabaseKey,
  apiUrl: envValues.apiUrl,
  authToken: envValues.authToken,
};
