/**
 * UI login to Telepase and persist storageState to auth.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { AUTH_JSON_PATH, LOGIN_URL, TELEPASE_DIR } from './paths.mjs';

dotenv.config({ path: path.join(TELEPASE_DIR, '.env') });

function readJwtExp(authPath) {
  try {
    const state = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const jwt = (state.cookies || []).find((c) => c.name === 'telepase_jwt');
    if (!jwt?.value) return null;
    const payload = jwt.value.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8'
    );
    const data = JSON.parse(json);
    return typeof data.exp === 'number' ? data.exp : null;
  } catch {
    return null;
  }
}

function authLooksReusable(authPath) {
  if (!fs.existsSync(authPath)) return false;
  const exp = readJwtExp(authPath);
  if (!exp) {
    // No JWT parsed — still try if file has cookies
    try {
      const state = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      return Array.isArray(state.cookies) && state.cookies.length > 0;
    } catch {
      return false;
    }
  }
  const now = Math.floor(Date.now() / 1000);
  // Refresh if fewer than 60s remain
  return exp - now > 60;
}

async function performLogin({ headless }) {
  const user = process.env.TELEPASE_USER;
  const pass = process.env.TELEPASE_PASS;
  if (!user || !pass) {
    throw new Error(
      'Missing TELEPASE_USER / TELEPASE_PASS. Copy .env.example to .env or set env vars.'
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

  const userInput = page.getByRole('textbox', { name: /email/i });
  const passInput = page.getByRole('textbox', { name: /contraseña|password/i });
  const submit = page.getByRole('button', { name: /ingresar|login|entrar/i });

  await userInput.waitFor({ state: 'visible', timeout: 30000 });
  await userInput.fill(user);
  await passInput.fill(pass);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }).catch(() => {}),
    submit.click(),
  ]);

  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) {
    const errText = await page
      .locator('.alert, .error, .invalid-feedback, .text-danger')
      .first()
      .textContent()
      .catch(() => '');
    await browser.close();
    throw new Error(`Login failed; still on login page. ${errText || ''}`.trim());
  }

  const cookies = await context.cookies();
  if (!cookies.length) {
    await browser.close();
    throw new Error('Login appeared to succeed but no cookies were set.');
  }

  await context.storageState({ path: AUTH_JSON_PATH });
  console.log(`Saved session → ${AUTH_JSON_PATH}`);
  await browser.close();
  return AUTH_JSON_PATH;
}

export async function ensureAuth({ headless = true, force = false } = {}) {
  if (!force && authLooksReusable(AUTH_JSON_PATH)) {
    console.log(`Reusing session: ${AUTH_JSON_PATH}`);
    return AUTH_JSON_PATH;
  }
  if (fs.existsSync(AUTH_JSON_PATH)) {
    console.log('Session missing/expired; logging in again…');
  }
  return performLogin({ headless });
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  const force = process.argv.includes('--force');
  ensureAuth({ headless: process.env.HEADLESS !== '0', force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}
