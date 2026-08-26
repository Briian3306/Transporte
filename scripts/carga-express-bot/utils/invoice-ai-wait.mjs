/**
 * Invoice AI overlay: do not treat "loader not in the DOM yet" as finished.
 */
export const INVOICE_AI_LOADER_SELECTOR =
  '[data-testid="invoice-ai-loader"], app-paso7-factura .paso7__ai-loader, app-paso7-factura app-ai-cat-loader';

export function invoiceAiCanProceed({
  loading,
  state,
  sawLoader,
  elapsedMs,
  noAiGraceMs = 15000,
}) {
  if (loading) return false;
  if (state === 'ready' || state === 'error') return true;
  if (sawLoader) return true;
  return elapsedMs >= noAiGraceMs;
}

export function invoiceAiHasRecognitions({ state, chipCount = 0 }) {
  return state === 'ready' && Number(chipCount) > 0;
}
