export function normalizeProvider(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase();
  return normalized || '(SIN PROVEEDOR)';
}

export class ProviderFailureTracker {
  constructor(blockAfter = 5) {
    this.blockAfter = blockAfter;
    this.failures = new Map();
  }

  key(record) {
    return normalizeProvider(record?.Empresa);
  }

  failureCount(record) {
    return this.failures.get(this.key(record)) ?? 0;
  }

  recordFailure(record) {
    const key = this.key(record);
    const count = this.failureCount(record) + 1;
    this.failures.set(key, count);
    return count;
  }

  recordSuccess(record) {
    this.failures.delete(this.key(record));
  }

  isBlocked(record) {
    return this.failureCount(record) >= this.blockAfter;
  }
}

export function selectProviderRecord(records, isBlocked) {
  if (!records.length) return null;
  const available = records.find((record) => !isBlocked(record));
  return available ?? records[0];
}
