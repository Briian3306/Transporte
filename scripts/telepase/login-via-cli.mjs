/**
 * Drive playwright-cli login + state-save when available; falls back to login.mjs.
 *
 * Usage: node login-via-cli.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { AUTH_JSON_PATH, LOGIN_URL, TELEPASE_DIR } from './paths.mjs';
import { ensureAuth } from './login.mjs';

dotenv.config({ path: path.join(TELEPASE_DIR, '.env') });

function hasCli() {
  const r = spawnSync('playwright-cli', ['--version'], {
    encoding: 'utf8',
    shell: true,
  });
  if (r.status === 0) return 'playwright-cli';
  const r2 = spawnSync('npx', ['--no-install', 'playwright', 'cli', '--version'], {
    encoding: 'utf8',
    shell: true,
  });
  if (r2.status === 0) return 'npx playwright cli';
  return null;
}

function runCli(cli, args) {
  const cmd = cli === 'playwright-cli' ? 'playwright-cli' : 'npx';
  const fullArgs = cli === 'playwright-cli' ? args : ['playwright', 'cli', ...args];
  console.log(`> ${cmd} ${fullArgs.join(' ')}`);
  const r = spawnSync(cmd, fullArgs, {
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
    cwd: path.resolve(TELEPASE_DIR, '../..'),
  });
  if (r.status !== 0) {
    throw new Error(`playwright-cli command failed: ${args.join(' ')}`);
  }
}

async function main() {
  const user = process.env.TELEPASE_USER;
  const pass = process.env.TELEPASE_PASS;
  if (!user || !pass) {
    throw new Error(
      'Missing TELEPASE_USER / TELEPASE_PASS. Create scripts/telepase/.env from .env.example'
    );
  }

  const cli = hasCli();
  if (!cli) {
    console.log('playwright-cli not found; using Playwright library login.mjs');
    await ensureAuth({ headless: process.env.HEADLESS !== '0' });
    return;
  }

  console.log(`Using ${cli} for login…`);
  runCli(cli, ['open', LOGIN_URL]);
  // Snapshot to discover refs is interactive; use eval/fill by selector instead via run-code
  const loginCode = path.join(TELEPASE_DIR, 'cli-login-snippet.js');
  // Credentials come from process env already loaded by the parent; do not embed secrets in the file.
  fs.writeFileSync(
    loginCode,
    `async page => {
  const user = process.env.TELEPASE_USER;
  const pass = process.env.TELEPASE_PASS;
  if (!user || !pass) throw new Error('TELEPASE_USER / TELEPASE_PASS not available in playwright-cli process');
  const userInput = page.locator('input[name="email"], input[name="username"], input[name="user"], input[type="email"], input#email, input#username').first();
  const passInput = page.locator('input[name="password"], input[type="password"], input#password').first();
  const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("Login"), button:has-text("Entrar")').first();
  await userInput.waitFor({ state: 'visible', timeout: 30000 });
  await userInput.fill(user);
  await passInput.fill(pass);
  await Promise.all([
    page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 60000 }).catch(() => {}),
    submit.click(),
  ]);
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    throw new Error('Login failed; still on login page');
  }
  return page.url();
}
`,
    'utf8'
  );

  try {
    runCli(cli, ['run-code', `--filename=${loginCode}`]);
    runCli(cli, ['state-save', AUTH_JSON_PATH]);
    console.log(`Saved session → ${AUTH_JSON_PATH}`);
  } finally {
    try {
      fs.unlinkSync(loginCode);
    } catch {
      /* ignore */
    }
    try {
      runCli(cli, ['close']);
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  console.log('Falling back to library login…');
  ensureAuth({ headless: process.env.HEADLESS !== '0' })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
});
