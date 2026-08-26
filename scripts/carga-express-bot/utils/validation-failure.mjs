export function describeValidationFailure({ enabled, status = '', details = '' } = {}) {
  if (enabled) return { failed: false, message: '' };
  const duplicate = /Se detectaron\s+\d+\s+pasada\(s\)\s+duplicada\(s\)/i.test(`${status} ${details}`);
  return {
    failed: true,
    duplicate,
    retryable: !duplicate,
    status: duplicate ? 'DUPLICATED' : 'FAILED',
    message: duplicate ? `${details || status}` : `Paso Validación bloqueado (${status || 'Requiere revisión'}).`,
  };
}
