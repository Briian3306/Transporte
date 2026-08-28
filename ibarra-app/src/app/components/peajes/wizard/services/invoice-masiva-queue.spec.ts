import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { InvoiceAiService } from '../../services/ai/invoice/invoice-ai.service';
import { InvoiceAiError, InvoiceAiResult } from '../../services/ai/invoice/invoice-ai.models';
import { PeajesWizardStateService, WizardDocumentoGrupo } from './peajes-wizard-state.service';
import { analizarFacturasMasivaPendientes } from './invoice-masiva-queue';

describe('analizarFacturasMasivaPendientes', () => {
  let state: PeajesWizardStateService;
  let invoiceAi: jasmine.SpyObj<InvoiceAiService>;

  const result: InvoiceAiResult = {
    invoiceNumber: [],
    invoiceDate: [],
    vat: [],
    perceptions: [],
    subtotal: [],
    total: [],
    expectedNetAmount: 100,
  };

  function doc(factura: string, row: number): WizardDocumentoGrupo {
    return {
      factura,
      tipo: 'FC',
      cuenta: '',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-01',
      bonificacion: 0,
      importe_sin_iva: 100,
      percepciones: 0,
      iva: 21,
      importe_total: 121,
      rowIndexes: [row],
      status: 'neutral',
      errores: [],
      omitido: false,
    };
  }

  function seedMasiva(): void {
    state.reiniciar();
    state.setModoImportacion('masiva');
    state.setDocumentos([doc('123', 0), doc('234', 1)]);
    state.setPasadasEstandarizadas([
      { FACTURA: '123', IMPORTE_NETO: 100 },
      { FACTURA: '234', IMPORTE_NETO: 100 },
    ] as never);
    state.setPlantillaId('P-1');
    state.setInvoicePdfsMasiva({
      '123': { fileName: '123.pdf', size: 10, lastModified: 1, text: 'pdf-123' },
      '234': { fileName: '234.pdf', size: 10, lastModified: 1, text: 'pdf-234' },
    });
  }

  beforeEach(() => {
    invoiceAi = jasmine.createSpyObj<InvoiceAiService>('InvoiceAiService', ['analyze']);
    invoiceAi.analyze.and.returnValue(of(result));
    TestBed.configureTestingModule({
      providers: [
        PeajesWizardStateService,
        { provide: InvoiceAiService, useValue: invoiceAi },
      ],
    });
    state = TestBed.inject(PeajesWizardStateService);
  });

  it('runs documents one after another', async () => {
    seedMasiva();
    const first$ = new Subject<InvoiceAiResult>();
    let calls = 0;
    invoiceAi.analyze.and.callFake(() => {
      calls += 1;
      return calls === 1 ? first$.asObservable() : of(result);
    });

    const pending = analizarFacturasMasivaPendientes(state, invoiceAi);
    await Promise.resolve();
    expect(invoiceAi.analyze).toHaveBeenCalledTimes(1);
    expect(invoiceAi.analyze.calls.mostRecent().args[0]).toBe('pdf-123');

    first$.next(result);
    first$.complete();
    expect(await pending).toBe(2);
    expect(invoiceAi.analyze).toHaveBeenCalledTimes(2);
    expect(invoiceAi.analyze.calls.argsFor(1)[0]).toBe('pdf-234');
    expect(state.invoiceAiForDocumento('123').status).toBe('ready');
    expect(state.invoiceAiForDocumento('234').status).toBe('ready');
  });

  it('retries idle and error only, not ready', async () => {
    seedMasiva();
    expect(await analizarFacturasMasivaPendientes(state, invoiceAi)).toBe(2);
    state.setInvoiceAiPorDocumento('234', 'error', null, 'falló');
    invoiceAi.analyze.calls.reset();
    invoiceAi.analyze.and.returnValue(of(result));

    expect(await analizarFacturasMasivaPendientes(state, invoiceAi)).toBe(1);
    expect(invoiceAi.analyze).toHaveBeenCalledTimes(1);
    expect(invoiceAi.analyze.calls.mostRecent().args[0]).toBe('pdf-234');
    expect(state.invoiceAiForDocumento('123').status).toBe('ready');
    expect(state.invoiceAiForDocumento('234').status).toBe('ready');
  });

  it('skips documents without PDF and records InvoiceAiError', async () => {
    seedMasiva();
    state.setInvoicePdfsMasiva({
      '123': { fileName: '123.pdf', size: 10, lastModified: 1, text: 'pdf-123' },
    });
    invoiceAi.analyze.and.returnValue(
      throwError(() => new InvoiceAiError('rate', 'rate_limited'))
    );

    expect(await analizarFacturasMasivaPendientes(state, invoiceAi)).toBe(1);
    expect(state.invoiceAiForDocumento('123').status).toBe('error');
    expect(state.invoiceAiForDocumento('123').error).toBe('rate');
    expect(state.invoiceAiForDocumento('234').status).toBe('idle');
  });
});
