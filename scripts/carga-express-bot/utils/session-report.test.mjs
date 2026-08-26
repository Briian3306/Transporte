import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionReport } from './session-report.mjs';

test('summarizes missing files and session errors', () => {
  const report = createSessionReport({
    startedAt: '2026-08-26T10:00:00.000Z',
    finishedAt: '2026-08-26T10:01:00.000Z',
    entries: [
      { numero: '1', provider: 'AUSA', outcome: 'failed', category: 'missing', missing: ['filePasadasPath'], message: 'No existe CSV' },
      { numero: '2', provider: 'AUSA', outcome: 'duplicated', category: 'duplicate', duplicate: true, message: 'Se detectaron 1 pasada(s) duplicada(s).' },
      { numero: '3', provider: 'AUMESA', outcome: 'complete', message: '' },
    ],
  });

  assert.deepEqual(report.summary, { total: 3, complete: 1, failed: 1, duplicated: 1, userInput: 0, missing: 1, duplicates: 1, errors: 2 });
  assert.equal(report.missing[0].numero, '1');
  assert.equal(report.errors[1].numero, '2');
});
