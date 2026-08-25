export function describeInvoiceFormFailure({ missing = [], errors = [], invalidControls = [] } = {}) {
  const details = [...missing, ...errors, ...invalidControls.map((field) => `Campo inválido: ${field}`)]
    .map((value) => String(value).trim())
    .filter(Boolean);

  return {
    invalid: details.length > 0,
    message: details.join('; '),
  };
}
