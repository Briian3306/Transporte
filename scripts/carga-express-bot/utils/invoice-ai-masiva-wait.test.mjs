import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMasivaBadge,
  classifyMasivaBadgeClass,
  invoiceAiMasivaCanProceed,
  invoiceAiMasivaHardCapMs,
  invoiceAiMasivaOutcome,
  invoiceAiMasivaParkMessage,
  invoiceAiMasivaShouldGiveUp,
  masivaAccordionPanelXpath,
  masivaAccordionTriggerXpath,
  shouldDeferNewMasivaTab,
  summarizeMasivaBadgeNodes,
  summarizeMasivaBadges,
} from './invoice-ai-masiva-wait.mjs';

test('classifies accordion badge labels and pin CSS classes', () => {
  assert.equal(classifyMasivaBadge('Sugerencias listas'), 'ready');
  assert.equal(classifyMasivaBadgeClass('paso7__acc-badge paso7__acc-badge--ready'), 'ready');
  assert.equal(classifyMasivaBadgeClass('paso7__acc-badge paso7__acc-badge--loading'), 'loading');
  assert.equal(classifyMasivaBadge('Error IA'), 'error');
  assert.equal(classifyMasivaBadge('Analizando'), 'loading');
  assert.equal(classifyMasivaBadge('Con PDF'), 'pdf');
  assert.equal(classifyMasivaBadge('Sin PDF'), 'none');
  const fromPin = summarizeMasivaBadgeNodes(
    [{ className: 'paso7__acc-badge paso7__acc-badge--ready', text: '' }],
    { loaderVisible: false },
  );
  assert.equal(fromPin.readyBadges, 1);
});

test('does not proceed while loader or Analizando or Con PDF remain', () => {
  const extras = { expectedPdfs: 2, elapsedMs: 60000, idleMs: 60000 };
  assert.equal(
    invoiceAiMasivaCanProceed({ loaderVisible: true, loadingBadges: 0, idlePdfBadges: 0, readyBadges: 2 }, extras),
    false,
  );
  assert.equal(
    invoiceAiMasivaCanProceed({ loaderVisible: false, loadingBadges: 1, idlePdfBadges: 0, readyBadges: 1 }, extras),
    false,
  );
  assert.equal(
    invoiceAiMasivaCanProceed({ loaderVisible: false, loadingBadges: 0, idlePdfBadges: 2, readyBadges: 0 }, extras),
    false,
  );
});

test('empty badges are not settled (AI has not started)', () => {
  assert.equal(
    invoiceAiMasivaCanProceed(
      { loaderVisible: false, loadingBadges: 0, idlePdfBadges: 0, readyBadges: 0, errorBadges: 0, labels: [] },
      { expectedPdfs: 8, elapsedMs: 500, idleMs: 500 },
    ),
    false,
  );
});

test('proceeds when every expected PDF badge is ready', () => {
  const snapshot = summarizeMasivaBadges(['Sugerencias listas', 'Sugerencias listas'], { loaderVisible: false });
  assert.equal(invoiceAiMasivaCanProceed(snapshot, { expectedPdfs: 2, elapsedMs: 60000, idleMs: 0 }), true);
  assert.equal(invoiceAiMasivaOutcome(snapshot, { expectedPdfs: 2, elapsedMs: 60000, idleMs: 0 }), 'ready');
  assert.equal(invoiceAiMasivaParkMessage(snapshot), '');
});

test('queue idle with 10/11 pins ready is settled (unmatched PDF has no badge)', () => {
  const snapshot = {
    loaderVisible: false,
    loadingBadges: 0,
    idlePdfBadges: 0,
    readyBadges: 10,
    errorBadges: 0,
    labels: Array(10).fill('Sugerencias listas'),
  };
  assert.equal(
    invoiceAiMasivaCanProceed(snapshot, { expectedPdfs: 11, elapsedMs: 224000, idleMs: 5000 }),
    false,
  );
  assert.equal(
    invoiceAiMasivaCanProceed(snapshot, { expectedPdfs: 11, elapsedMs: 224000, idleMs: 12000 }),
    true,
  );
  assert.equal(invoiceAiMasivaParkMessage(snapshot, { timedOut: true, expectedPdfs: 11 }), '');
});

test('mixed ready+error is settled enough to apply chips (no auto-park)', () => {
  const snapshot = summarizeMasivaBadges(['Sugerencias listas', 'Error IA'], { loaderVisible: false });
  assert.equal(invoiceAiMasivaCanProceed(snapshot, { expectedPdfs: 2, elapsedMs: 60000, idleMs: 12000 }), true);
  assert.equal(invoiceAiMasivaParkMessage(snapshot), '');
});

test('timeout while still analyzing parks instead of failing', () => {
  const snapshot = summarizeMasivaBadges(['Analizando', 'Con PDF'], { loaderVisible: true });
  const message = invoiceAiMasivaParkMessage(snapshot, { timedOut: true, expectedPdfs: 2 });
  assert.match(message, /no terminó a tiempo/);
});

test('accordion XPath targets panel[1] through panel[n] triggers', () => {
  assert.equal(
    masivaAccordionPanelXpath(1),
    '(//app-paso7-factura//app-accordion-panel)[1]',
  );
  assert.equal(
    masivaAccordionTriggerXpath(2),
    '(//app-paso7-factura//app-accordion-panel)[2]//button[contains(@class,\'app-acc-panel__trigger\')]',
  );
  assert.equal(
    masivaAccordionTriggerXpath(8),
    '(//app-paso7-factura//app-accordion-panel)[8]//button[contains(@class,\'app-acc-panel__trigger\')]',
  );
});

test('does not open the next folder while Factura is still waiting for AI', () => {
  assert.equal(shouldDeferNewMasivaTab([{ stage: 'estaciones', waitForAi: false }]), false);
  assert.equal(shouldDeferNewMasivaTab([{ stage: 'factura', waitForAi: true }]), true);
  assert.equal(shouldDeferNewMasivaTab([{ stage: 'factura' }]), true);
  assert.equal(shouldDeferNewMasivaTab([]), false);
});

test('soft timeout does not give up while the AI queue is still running', () => {
  const running = summarizeMasivaBadges(['Analizando', 'Sugerencias listas'], { loaderVisible: true });
  const idle = summarizeMasivaBadges(['Sugerencias listas'], { loaderVisible: false });
  assert.equal(invoiceAiMasivaShouldGiveUp(running, { elapsedMs: 480000, timeoutMs: 480000 }), false);
  assert.equal(invoiceAiMasivaShouldGiveUp(idle, { elapsedMs: 480000, timeoutMs: 480000 }), true);
  assert.equal(
    invoiceAiMasivaShouldGiveUp(running, {
      elapsedMs: invoiceAiMasivaHardCapMs(480000),
      timeoutMs: 480000,
    }),
    true,
  );
});
