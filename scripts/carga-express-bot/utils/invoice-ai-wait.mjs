/**
 * Invoice AI overlay: do not treat "loader not in the DOM yet" as finished.
 */
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
