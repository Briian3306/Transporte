/**
 * Masiva Paso 7: ready signal is accordion badges + pin (paso7__acc-badge--ready).
 * Labels: Analizando | Sugerencias listas | Error IA | Con PDF | Sin PDF
 */

export function classifyMasivaBadge(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (/Sugerencias listas/i.test(value)) return 'ready';
  if (/Error IA/i.test(value)) return 'error';
  if (/Analizando/i.test(value)) return 'loading';
  if (/Con PDF/i.test(value)) return 'pdf';
  if (/Sin PDF/i.test(value)) return 'none';
  return 'other';
}

export function classifyMasivaBadgeClass(className) {
  const value = String(className ?? '');
  if (value.includes('paso7__acc-badge--ready')) return 'ready';
  if (value.includes('paso7__acc-badge--error')) return 'error';
  if (value.includes('paso7__acc-badge--loading')) return 'loading';
  if (value.includes('paso7__acc-badge--pdf')) return 'pdf';
  return 'none';
}

export function summarizeMasivaBadgeNodes(nodes = [], { loaderVisible = false } = {}) {
  const counts = { ready: 0, error: 0, loading: 0, pdf: 0, none: 0, other: 0 };
  const labels = [];
  for (const node of nodes) {
    const text = String(node?.text ?? node?.label ?? '').replace(/\s+/g, ' ').trim();
    if (text) labels.push(text);
    const fromClass = classifyMasivaBadgeClass(node?.className);
    const kind = fromClass !== 'none' ? fromClass : classifyMasivaBadge(text);
    counts[kind] += 1;
  }
  return {
    loaderVisible: Boolean(loaderVisible),
    loadingBadges: counts.loading,
    idlePdfBadges: counts.pdf,
    errorBadges: counts.error,
    readyBadges: counts.ready,
    noneBadges: counts.none,
    labels,
  };
}

export function summarizeMasivaBadges(labels = [], extras = {}) {
  return summarizeMasivaBadgeNodes(
    labels.map((text) => ({ text, className: '' })),
    extras,
  );
}

export function queueIsIdle(snapshot = {}) {
  return !snapshot.loaderVisible && Number(snapshot.loadingBadges) === 0 && Number(snapshot.idlePdfBadges) === 0;
}

/**
 * AI is done when the queue is idle (loader off, no Analizando, no Con PDF).
 * Do not require ready === uploaded PDF count: unmatched PDFs never get a pin/badge.
 */
export function invoiceAiMasivaCanProceed(snapshot = {}, extras = {}) {
  const {
    expectedPdfs = 0,
    elapsedMs = 0,
    idleMs = 0,
    sawLoader = false,
    minWaitMs = 4000,
    noAiGraceMs = 20000,
    idleSettleMs = 10000,
  } = extras;

  if (!queueIsIdle(snapshot)) return false;
  if (elapsedMs < minWaitMs) return false;

  const settledPdfs = Number(snapshot.readyBadges) + Number(snapshot.errorBadges);
  const badgeCount = Array.isArray(snapshot.labels) ? snapshot.labels.length : 0;

  if (settledPdfs >= Number(expectedPdfs) && Number(expectedPdfs) > 0) return true;
  if (settledPdfs > 0) return idleMs >= idleSettleMs;

  if (badgeCount === 0) {
    return sawLoader && elapsedMs >= noAiGraceMs;
  }
  return elapsedMs >= noAiGraceMs;
}

export function invoiceAiMasivaOutcome(snapshot = {}, extras = {}) {
  if (!invoiceAiMasivaCanProceed(snapshot, extras)) return 'loading';
  if (Number(snapshot.errorBadges) > 0 && Number(snapshot.readyBadges) === 0) return 'error';
  if (Number(snapshot.readyBadges) > 0) return 'ready';
  return 'idle';
}

export function invoiceAiMasivaParkMessage(snapshot = {}, { timedOut = false, expectedPdfs = 0 } = {}) {
  if (!timedOut) return '';
  const extras = {
    expectedPdfs,
    elapsedMs: Number.MAX_SAFE_INTEGER,
    idleMs: Number.MAX_SAFE_INTEGER,
    sawLoader: true,
    minWaitMs: 0,
    idleSettleMs: 0,
  };
  if (invoiceAiMasivaCanProceed(snapshot, extras)) return '';
  return 'La IA de facturas masiva no terminó a tiempo. Completá los documentos a mano y pulsá Continuar.';
}

/** 1-based XPath for masiva accordion panels (panel[1] … panel[n]). */
export function masivaAccordionPanelXpath(index1) {
  return `(//app-paso7-factura//app-accordion-panel)[${Number(index1)}]`;
}

export function masivaAccordionTriggerXpath(index1) {
  return `${masivaAccordionPanelXpath(index1)}//button[contains(@class,'app-acc-panel__trigger')]`;
}

/** Do not open the next folder while a parked tab is still on Factura waiting for AI/chips. */
export function shouldDeferNewMasivaTab(parked = []) {
  return parked.some((item) => item?.stage === 'factura' && item.waitForAi !== false);
}

export function invoiceAiMasivaHardCapMs(timeoutMs = 480000) {
  return Math.max(Number(timeoutMs) * 2, 20 * 60 * 1000);
}

/** Soft timeout is ignored while Analizando/loader/Con PDF; only idle or hard cap stops the wait. */
export function invoiceAiMasivaShouldGiveUp(snapshot = {}, { elapsedMs = 0, timeoutMs = 480000, hardCapMs } = {}) {
  const cap = hardCapMs ?? invoiceAiMasivaHardCapMs(timeoutMs);
  if (elapsedMs >= cap) return true;
  return elapsedMs >= timeoutMs && queueIsIdle(snapshot);
}
