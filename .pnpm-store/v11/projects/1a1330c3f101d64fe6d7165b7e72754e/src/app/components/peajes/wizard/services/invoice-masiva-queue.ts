import { firstValueFrom } from 'rxjs';
import { InvoiceAiService } from '../../services/ai/invoice/invoice-ai.service';
import { InvoiceAiError } from '../../services/ai/invoice/invoice-ai.models';
import { normalizarClaveFacturaPdf } from '../../models';
import { PeajesWizardStateService, WizardDocumentoGrupo } from '../services/peajes-wizard-state.service';

/**
 * Analiza en cola (1→n) los PDFs de importación masiva.
 * Omite documentos ya `ready`. Reintento cubre `idle` y `error`.
 */
export async function analizarFacturasMasivaPendientes(
  state: PeajesWizardStateService,
  invoiceAi: InvoiceAiService
): Promise<number> {
  const snap = state.snapshot();
  if (snap.modoImportacion !== 'masiva') {
    return 0;
  }
  const docs = snap.documentos.filter((d) => !d.omitido);
  let analyzed = 0;
  for (const doc of docs) {
    const ran = await analizarDocumentoMasiva(state, invoiceAi, doc);
    if (ran) {
      analyzed += 1;
    }
  }
  return analyzed;
}

async function analizarDocumentoMasiva(
  state: PeajesWizardStateService,
  invoiceAi: InvoiceAiService,
  doc: WizardDocumentoGrupo
): Promise<boolean> {
  const key = normalizarClaveFacturaPdf(doc.factura);
  const pdf = state.invoicePdfMasivaFor(doc.factura);
  const net = state.invoiceExpectedNetAmountForDocumento(doc);
  if (!pdf?.text || net == null || net <= 0) {
    return false;
  }
  const current = state.invoiceAiForDocumento(doc.factura);
  const fingerprint = state.invoiceAiFingerprintMasiva(key, net);
  if (current.status === 'ready' && current.fingerprint === fingerprint) {
    return false;
  }
  if (current.status === 'loading') {
    return false;
  }
  state.setInvoiceAiPorDocumento(doc.factura, 'loading', null, null);
  try {
    const result = await firstValueFrom(invoiceAi.analyze(pdf.text, net));
    state.setInvoiceAiPorDocumento(doc.factura, 'ready', result, null);
  } catch (e) {
    const message =
      e instanceof InvoiceAiError
        ? e.message
        : 'No se pudo analizar la factura. Completá el documento a mano o reintentá.';
    state.setInvoiceAiPorDocumento(doc.factura, 'error', null, message);
  }
  return true;
}
