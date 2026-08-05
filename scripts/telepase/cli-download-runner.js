/**
 * Playwright-cli run-code entrypoint.
 * Usage from repo root:
 *   playwright-cli state-load scripts/telepase/auth.json
 *   playwright-cli run-code --filename=scripts/telepase/cli-download-runner.js
 *
 * Env: TELEPASE_LIMIT (default 3), TELEPASE_DIVERSE (default 1)
 */
async (page) => {
  const path = require('path');
  const fs = require('fs');
  const { pathToFileURL } = require('url');

  const telepaseDir = path.resolve(__dirname || path.resolve('scripts/telepase'));
  // When run via playwright-cli, __dirname may be unavailable in arrow; resolve from cwd.
  const root = process.cwd();
  const dir = fs.existsSync(path.join(root, 'scripts/telepase/download-batch.mjs'))
    ? path.join(root, 'scripts/telepase')
    : path.join(root, 'telepase');

  const mod = await import(pathToFileURL(path.join(dir, 'download-batch.mjs')).href);
  const limitEnv = process.env.TELEPASE_LIMIT;
  const limit = limitEnv === undefined || limitEnv === '' ? 3 : Number(limitEnv);
  const diverse = process.env.TELEPASE_DIVERSE !== '0';

  const stats = await mod.runDownloadBatch({
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    diverse,
    headless: true,
  });
  return stats;
}
