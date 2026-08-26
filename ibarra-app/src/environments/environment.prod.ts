/**
 * Production. Used by `pnpm build:prod`.
 * Secrets come from `.env.production` or Netlify NG_APP_* env vars via `scripts/sync-env.mjs`.
 */
import { envValues } from './environment.values';

export const environment = {
  production: true as boolean,
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
