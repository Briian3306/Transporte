import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProviderFailureTracker,
  normalizeProvider,
  selectProviderRecord,
} from './provider-failover.mjs';

const row = (Empresa, numero) => ({ Empresa, numero });

test('normalizes provider names for failure tracking', () => {
  assert.equal(normalizeProvider('  ausa '), 'AUSA');
  assert.equal(normalizeProvider(''), '(SIN PROVEEDOR)');
});

test('skips a provider after five consecutive failures when another provider is available', () => {
  const tracker = new ProviderFailureTracker(5);
  const ausa = row('ausa', '1');
  for (let i = 0; i < 5; i++) tracker.recordFailure(ausa);

  const selected = selectProviderRecord(
    [ausa, row('AUMESA', '2')],
    (record) => tracker.isBlocked(record),
  );

  assert.equal(selected.Empresa, 'AUMESA');
});

test('continues with the blocked provider when it is the only provider left', () => {
  const tracker = new ProviderFailureTracker(5);
  const ausa = row('AUSA', '1');
  for (let i = 0; i < 5; i++) tracker.recordFailure(ausa);

  const selected = selectProviderRecord([ausa], (record) => tracker.isBlocked(record));

  assert.equal(selected, ausa);
});

test('a successful row resets consecutive provider failures', () => {
  const tracker = new ProviderFailureTracker(5);
  const ausa = row('AUSA', '1');
  for (let i = 0; i < 5; i++) tracker.recordFailure(ausa);
  assert.equal(tracker.isBlocked(ausa), true);

  tracker.recordSuccess(ausa);

  assert.equal(tracker.failureCount(ausa), 0);
  assert.equal(tracker.isBlocked(ausa), false);
});
