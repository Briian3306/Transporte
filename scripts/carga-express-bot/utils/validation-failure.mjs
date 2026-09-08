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

/** Masiva: duplicates stay on the tab as USER_INPUT (do not close as DUPLICATED). */
export function masivaValidationUserInputMessage(state = {}) {
  const failure = describeValidationFailure(state);
  if (!failure.failed) return '';
  if (failure.duplicate) {
    return (
      `Paso Validación: hay pasadas duplicadas (${failure.message || 'duplicados'}). ` +
      'Revisá la tabla, pulsá «Subir igualmente» si corresponde, y luego Continuar.'
    );
  }
  return `${failure.message} Revisá la diferencia de factura o los errores de filas y pulsá Continuar cuando esté verde.`;
}
