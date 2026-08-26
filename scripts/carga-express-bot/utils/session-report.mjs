import fs from 'node:fs';
import path from 'node:path';

export function createSessionReport({ startedAt, finishedAt, entries = [] } = {}) {
  const complete = entries.filter((entry) => entry.outcome === 'complete');
  const failed = entries.filter((entry) => entry.outcome === 'failed');
  const duplicated = entries.filter((entry) => entry.outcome === 'duplicated');
  const userInput = entries.filter((entry) => entry.outcome === 'user_input');
  const missing = entries.filter((entry) => entry.category === 'missing');
  const duplicates = entries.filter((entry) => entry.duplicate === true);
  const errors = entries.filter(
    (entry) => entry.outcome === 'failed' || entry.outcome === 'duplicated' || entry.category === 'error',
  );

  return {
    startedAt,
    finishedAt,
    summary: {
      total: entries.length,
      complete: complete.length,
      failed: failed.length,
      duplicated: duplicated.length,
      userInput: userInput.length,
      missing: missing.length,
      duplicates: duplicates.length,
      errors: errors.length,
    },
    missing,
    errors,
    entries,
  };
}

export function writeSessionReport(report, directory, now = new Date()) {
  fs.mkdirSync(directory, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(directory, `session-${stamp}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filePath;
}
