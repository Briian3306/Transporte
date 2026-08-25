export function describeValidationFailure({ enabled, status = '' } = {}) {
  if (enabled) return { failed: false, message: '' };
  return {
    failed: true,
    message: `Paso Validación bloqueado (${status || 'Requiere revisión'}).`,
  };
}
