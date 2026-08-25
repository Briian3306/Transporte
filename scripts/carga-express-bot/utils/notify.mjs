import { spawn } from 'node:child_process';

function powershellLiteral(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

/**
 * Non-blocking Windows MessageBox. Also prints to the console so the
 * operator sees the same text if they are watching the terminal.
 */
export function notifyUser(title, message) {
  const body = String(message ?? '').trim() || 'Se necesita una decisión en carga-express.';
  const caption = String(title ?? 'Carga express — se necesita ayuda').trim();
  console.log(`\n========== USER INPUT ==========\n${caption}\n${body}\n================================\n`);

  if (process.platform !== 'win32') return;

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    `[void][System.Windows.Forms.MessageBox]::Show(${powershellLiteral(body)}, ${powershellLiteral(caption)}, 'OK', 'Warning')`,
  ].join('; ');

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.unref();
}
