export type InvoiceField =
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'vat'
  | 'perceptions'
  | 'subtotal'
  | 'total';

export type InvoiceConfidenceLevel = 'alta' | 'media' | 'baja';

export interface InvoiceCandidate<T> {
  value: T;
  modelConfidence: number;
  confidence: number;
  level: InvoiceConfidenceLevel;
}

export interface OpenRouterInvoiceCandidate<T> {
  value: T;
  confidence: number;
}

export interface OpenRouterInvoiceResponse {
  invoice_number_candidates: OpenRouterInvoiceCandidate<string>[];
  invoice_date_candidates: OpenRouterInvoiceCandidate<string>[];
  vat_candidates: OpenRouterInvoiceCandidate<number>[];
  perception_candidates: OpenRouterInvoiceCandidate<number>[];
  subtotal_candidates: OpenRouterInvoiceCandidate<number>[];
  total_candidates: OpenRouterInvoiceCandidate<number>[];
}

export interface InvoiceAiResult {
  invoiceNumber: InvoiceCandidate<string>[];
  invoiceDate: InvoiceCandidate<string>[];
  vat: InvoiceCandidate<number>[];
  perceptions: InvoiceCandidate<number>[];
  subtotal: InvoiceCandidate<number>[];
  total: InvoiceCandidate<number>[];
  expectedNetAmount: number;
}

export type InvoiceAiStatus = 'idle' | 'loading' | 'ready' | 'error';

export type InvoiceAiErrorCode =
  | 'rate_limited'
  | 'provider'
  | 'invalid'
  | 'network'
  | 'empty';

export class InvoiceAiError extends Error {
  readonly code: InvoiceAiErrorCode;

  constructor(message: string, code: InvoiceAiErrorCode) {
    super(message);
    this.name = 'InvoiceAiError';
    this.code = code;
  }
}

export interface InvoiceAiAnalysisState {
  status: InvoiceAiStatus;
  result: InvoiceAiResult | null;
  error: string | null;
  fingerprint: string | null;
}
