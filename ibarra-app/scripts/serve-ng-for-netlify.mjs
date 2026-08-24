/**
 * Angular serve for Netlify Dev. Always uses this app's @angular/cli,
 * regardless of whether netlify.toml spawned the command from the repo root.
 */
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ibarraRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ngJs = join(ibarraRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

const child = spawn(
  process.execPath,
  [ngJs, 'serve', '--host', '127.0.0.1', '--port', '4201'],
  { cwd: ibarraRoot, stdio: 'inherit', env: process.env, windowsHide: true }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
