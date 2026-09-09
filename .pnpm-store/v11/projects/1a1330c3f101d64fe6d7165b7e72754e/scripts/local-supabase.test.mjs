import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_HEALTH_URL,
  CLI_LOGIN_EMAIL,
  START_ARGS,
  isKongHealthy,
  shouldSkipSeedAuth,
} from './local-supabase.mjs';

test('skips seed_auth.sql only when Francis already exists', () => {
  assert.equal(shouldSkipSeedAuth(true), true);
  assert.equal(shouldSkipSeedAuth(false), false);
  assert.equal(shouldSkipSeedAuth(0), false);
});

test('CLI start uses ignore-health-check so Studio timeout does not roll back Kong', () => {
  assert.deepEqual(START_ARGS, ['start', '--ignore-health-check']);
});

test('auth health URL is local Kong GoTrue', () => {
  assert.equal(AUTH_HEALTH_URL, 'http://127.0.0.1:54321/auth/v1/health');
  assert.equal(CLI_LOGIN_EMAIL, 'francis@transporteibarra.com.ar');
});

test('isKongHealthy is true when /auth/v1/health returns ok', async () => {
  const fetchFn = async (url) => {
    assert.equal(url, AUTH_HEALTH_URL);
    return { ok: true };
  };
  assert.equal(await isKongHealthy(fetchFn), true);
});

test('isKongHealthy is false when Kong refuses the connection', async () => {
  const fetchFn = async () => {
    throw new Error('fetch failed');
  };
  assert.equal(await isKongHealthy(fetchFn), false);
});
