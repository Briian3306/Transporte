import { rankInvoiceCandidates } from './invoice-confidence.engine';
import { OpenRouterInvoiceResponse } from './invoice-ai.models';

function emptyResponse(
  overrides: Partial<OpenRouterInvoiceResponse> = {}
): OpenRouterInvoiceResponse {
  return {
    invoice_number_candidates: [],
    invoice_date_candidates: [],
    vat_candidates: [],
    perception_candidates: [],
    subtotal_candidates: [],
    total_candidates: [],
    ...overrides,
  };
}

describe('rankInvoiceCandidates', () => {
  it('keeps a 9.5% perception but ranks the 3.98% candidate first', () => {
    const result = rankInvoiceCandidates(
      {
        invoice_number_candidates: [],
        invoice_date_candidates: [],
        vat_candidates: [],
        perception_candidates: [
          { value: 95000, confidence: 0.9 },
          { value: 39800, confidence: 0.8 },
        ],
        subtotal_candidates: [],
        total_candidates: [],
      },
      1_000_000
    );

    expect(result.perceptions.map((candidate) => candidate.value)).toEqual([39800, 95000]);
  });

  it('boosts IVA near 21% without dropping other rates', () => {
    const result = rankInvoiceCandidates(
      emptyResponse({
        vat_candidates: [
          { value: 105000, confidence: 0.9 },
          { value: 210000, confidence: 0.5 },
        ],
      }),
      1_000_000
    );

    expect(result.vat.map((candidate) => candidate.value)).toEqual([210000, 105000]);
    expect(result.vat[0].confidence).toBeGreaterThan(result.vat[1].confidence);
  });

  it('keeps at most three candidates per field after ranking', () => {
    const result = rankInvoiceCandidates(
      emptyResponse({
        total_candidates: [
          { value: 1, confidence: 0.1 },
          { value: 2, confidence: 0.2 },
          { value: 3, confidence: 0.3 },
          { value: 4, confidence: 0.4 },
        ],
      }),
      1_000_000
    );

    expect(result.total.map((candidate) => candidate.value)).toEqual([4, 3, 2]);
  });

  it('deduplicates equal values and labels alta/media/baja', () => {
    const result = rankInvoiceCandidates(
      emptyResponse({
        invoice_number_candidates: [
          { value: '0041-01947769', confidence: 0.96 },
          { value: '0041-01947769', confidence: 0.4 },
        ],
        invoice_date_candidates: [{ value: '2026-07-22', confidence: 0.75 }],
        vat_candidates: [{ value: 0, confidence: 0.5 }],
      }),
      173460
    );

    expect(result.invoiceNumber).toHaveSize(1);
    expect(result.invoiceNumber[0].level).toBe('alta');
    expect(result.invoiceDate[0].level).toBe('media');
    expect(result.vat[0].level).toBe('baja');
    expect(result.expectedNetAmount).toBe(173460);
  });

  it('ranks the subtotal closest to expected net first without dropping the other', () => {
    const result = rankInvoiceCandidates(
      emptyResponse({
        subtotal_candidates: [
          { value: 900000, confidence: 0.9 },
          { value: 1000000, confidence: 0.7 },
        ],
      }),
      1_000_000
    );

    expect(result.subtotal.map((candidate) => candidate.value)).toEqual([1000000, 900000]);
  });

  it('does not reject a finite candidate that fails the 3–4% or 21% signals', () => {
    const result = rankInvoiceCandidates(
      emptyResponse({
        perception_candidates: [{ value: 95000, confidence: 0.4 }],
        vat_candidates: [{ value: 50000, confidence: 0.4 }],
      }),
      1_000_000
    );

    expect(result.perceptions).toHaveSize(1);
    expect(result.vat).toHaveSize(1);
  });
});
