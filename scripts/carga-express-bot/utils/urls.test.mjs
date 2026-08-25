import assert from 'node:assert/strict';
import test from 'node:test';
import { isLoginUrl, isPostLoginUrl, pagePath } from './urls.mjs';

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
