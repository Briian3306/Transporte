/**
 * Local: Angular on :4200 + Netlify functions on :9999 (offline).
 * ng serve proxies /.netlify/functions → :9999 so the app matches production URLs.
 * Env comes from .env.development. Invoice AI keys are NG_APP_OPENROUTER_* in the Angular bundle.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ibarraRoot = join(__dirname, '..');
const repoRoot = join(ibarraRoot, '..');
const mode = 'development';
const functionsPort = 9999;
const appPort = 4200;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const text = readFileSync(filePath, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadEnv(modeName) {
  const files = ['.env', '.env.local', `.env.${modeName}`, `.env.${modeName}.local`];
  const merged = {};
  for (const file of files) {
    Object.assign(merged, parseEnvFile(join(ibarraRoot, file)));
  }
  return merged;
}

const fileEnv = loadEnv(mode);
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const netlifyBin = join(ibarraRoot, 'node_modules', 'netlify-cli', 'bin', 'run.js');
const ngJs = join(ibarraRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const functionsDir = join(repoRoot, 'netlify', 'functions');

if (!existsSync(netlifyBin)) {
  console.error('[start] netlify-cli is not installed. From ibarra-app run: pnpm add -D netlify-cli');
  process.exit(1);
}
if (!existsSync(ngJs)) {
  console.error('[start] @angular/cli is missing. From ibarra-app run: pnpm install');
  process.exit(1);
}

process.env.NETLIFY_TELEMETRY_DISABLED = '1';

function waitForPort(port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for 127.0.0.1:${port}`));
          return;
        }
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

const children = [];

function shutdown(code) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

function spawnLogged(label, bin, args, cwd) {
  const child = spawn(bin, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push(child);
  child.on('exit', (exitCode, signal) => {
    if (signal) {
      shutdown(1);
      return;
    }
    if (exitCode && exitCode !== 0) {
      console.error(`[start] ${label} exited with code ${exitCode}`);
      shutdown(exitCode);
    }
  });
  return child;
}

console.log(
  `[start] functions :${functionsPort} (offline, .env.development) + Angular :${appPort}. Open http://localhost:${appPort}`
);

spawnLogged(
  'functions',
  process.execPath,
  [
    netlifyBin,
    'functions:serve',
    '--offline',
    '-p',
    String(functionsPort),
    '-f',
    functionsDir,
  ],
  repoRoot
);

try {
  await waitForPort(functionsPort, 60_000);
} catch (error) {
  console.error('[start] Netlify functions did not start:', error.message);
  shutdown(1);
}

spawnLogged(
  'angular',
  process.execPath,
  [
    ngJs,
    'serve',
    '--host',
    '127.0.0.1',
    '--port',
    String(appPort),
    '--proxy-config',
    'proxy.conf.json',
  ],
  ibarraRoot
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}
