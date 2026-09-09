/** Shared CLI-local helpers for ensure-supabase-local and seed-local. */

export const CLI_LOGIN_EMAIL = 'francis@transporteibarra.com.ar';
export const KONG_HOST = '127.0.0.1';
export const KONG_PORT = 54321;
export const AUTH_HEALTH_URL = `http://${KONG_HOST}:${KONG_PORT}/auth/v1/health`;

/** `npx supabase start` without this flag can fail Studio health and roll back Kong. */
export const START_ARGS = ['start', '--ignore-health-check'];

export function shouldSkipSeedAuth(francisExists) {
  return Boolean(francisExists);
}

export async function isKongHealthy(fetchFn = fetch, timeoutMs = 2000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(AUTH_HEALTH_URL, { signal: ac.signal });
    return Boolean(res?.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const RECOVERY_HINT = [
  'Kong is not reachable at http://127.0.0.1:54321 (ERR_CONNECTION_REFUSED).',
  'Do not re-run `npx supabase start` while status says "already running".',
  'From ibarra-app/:',
  '  npx supabase stop',
  '  npx supabase start --ignore-health-check',
  'Then: pnpm seed:local',
  'Login: francis@transporteibarra.com.ar / Transporte2026',
  'If that still leaves Kong down: npx supabase stop --no-backup && npx supabase start --ignore-health-check && npx supabase db reset --local',
].join('\n');
