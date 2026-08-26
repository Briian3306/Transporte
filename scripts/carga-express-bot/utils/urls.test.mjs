import assert from 'node:assert/strict';
import test from 'node:test';
import { isLoginUrl, isPostLoginUrl, pagePath, resolveBaseUrl } from './urls.mjs';

test('login with returnUrl is still login, not peajes', () => {
  const url = 'https://portal.tpteibarra.ar/login?returnUrl=%2Fpeajes%2Fcarga-express';
  assert.equal(pagePath(url), '/login');
  assert.equal(isLoginUrl(url), true);
  assert.equal(isPostLoginUrl(url), false);
});

test('decoded returnUrl query is still login', () => {
  const url = 'https://portal.tpteibarra.ar/login?returnUrl=/peajes/carga-express';
  assert.equal(isLoginUrl(url), true);
  assert.equal(isPostLoginUrl(url), false);
});

test('carga-express path is post-login', () => {
  assert.equal(isPostLoginUrl('https://portal.tpteibarra.ar/peajes/carga-express'), true);
  assert.equal(isLoginUrl('http://localhost:4200/peajes/carga-express'), false);
});

test('--local wins over BASE_URL from .env', () => {
  assert.equal(
    resolveBaseUrl({ local: true, envBaseUrl: 'https://portal.tpteibarra.ar' }),
    'http://localhost:4200',
  );
});

test('without --local, BASE_URL from .env is used', () => {
  assert.equal(
    resolveBaseUrl({ local: false, envBaseUrl: 'https://portal.tpteibarra.ar/' }),
    'https://portal.tpteibarra.ar',
  );
});

test('without --local and without BASE_URL, default is production', () => {
  assert.equal(resolveBaseUrl({ local: false, envBaseUrl: '' }), 'https://portal.tpteibarra.ar');
});
