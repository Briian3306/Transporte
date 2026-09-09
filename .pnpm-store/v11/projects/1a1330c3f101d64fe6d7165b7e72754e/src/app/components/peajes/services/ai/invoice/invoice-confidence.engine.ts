import {
  InvoiceAiResult,
  InvoiceCandidate,
  InvoiceConfidenceLevel,
  OpenRouterInvoiceCandidate,
  OpenRouterInvoiceResponse,
} from './invoice-ai.models';

export const INVOICE_CONFIDENCE_DEFAULTS = {
  netTolerance: 0.01,
  ivaRate: 0.21,
  perceptionRates: [0.03, 0.04],
  contextWeight: 40,
  mathWeight: 30,
  totalWeight: 20,
  formatWeight: 10,
  maxCandidates: 3,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INVOICE_NUMBER = /^\d{4}-\d{8}$/;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function withinRate(
  amount: number,
  expectedNetAmount: number,
  rate: number,
  tolerance: number
): boolean {
  if (!Number.isFinite(expectedNetAmount) || expectedNetAmount === 0) return false;
  return Math.abs(amount / expectedNetAmount - rate) <= tolerance;
}

function withinNetTolerance(
  actual: number,
  expected: number,
  expectedNetAmount: number,
  tolerance: number
): boolean {
  const basis = Math.abs(expectedNetAmount) || Math.abs(expected);
  if (!Number.isFinite(basis) || basis === 0) return false;
  return Math.abs(actual - expected) <= basis * tolerance;
}

function levelFor(confidence: number): InvoiceConfidenceLevel {
  if (confidence >= 0.9) return 'alta';
  if (confidence >= 0.7) return 'media';
  return 'baja';
}

function formatScoreString(value: string, kind: 'invoiceNumber' | 'invoiceDate'): number {
  if (kind === 'invoiceNumber') return INVOICE_NUMBER.test(value.trim()) ? 1 : 0.4;
  return ISO_DATE.test(value.trim()) ? 1 : 0.4;
}

function formatScoreNumber(value: number): number {
  return Number.isFinite(value) ? 1 : 0;
}

function mathScoreAmount(
  amount: number,
  expectedNetAmount: number,
  kind: 'vat' | 'perceptions' | 'subtotal' | 'total'
): number {
  const { netTolerance, ivaRate, perceptionRates } = INVOICE_CONFIDENCE_DEFAULTS;
  if (kind === 'vat') {
    return withinRate(amount, expectedNetAmount, ivaRate, netTolerance) ? 1 : 0;
  }
  if (kind === 'perceptions') {
    return perceptionRates.some((rate) =>
      withinRate(amount, expectedNetAmount, rate, netTolerance)
    )
      ? 1
      : 0;
  }
  if (kind === 'subtotal') {
    return withinNetTolerance(amount, expectedNetAmount, expectedNetAmount, netTolerance)
      ? 1
      : 0;
  }
  return withinNetTolerance(amount, expectedNetAmount, expectedNetAmount, netTolerance)
    ? 0.35
    : 0;
}

function reconstructionScore(
  amount: number,
  kind: 'vat' | 'perceptions' | 'subtotal' | 'total',
  raw: OpenRouterInvoiceResponse,
  expectedNetAmount: number
): number {
  const { netTolerance } = INVOICE_CONFIDENCE_DEFAULTS;
  const vats = finiteNumbers(raw.vat_candidates).map((c) => c.value);
  const perceptions = finiteNumbers(raw.perception_candidates).map((c) => c.value);
  const subtotals = finiteNumbers(raw.subtotal_candidates).map((c) => c.value);
  const totals = finiteNumbers(raw.total_candidates).map((c) => c.value);
  const vatOptions = vats.length ? vats : [0];
  const perceptionOptions = perceptions.length ? perceptions : [0];
  const subtotalOptions = subtotals.length ? subtotals : [expectedNetAmount];
  const totalOptions = totals.length ? totals : [];

  const matches = (
    subtotal: number,
    vat: number,
    perception: number,
    total: number
  ): boolean =>
    withinNetTolerance(subtotal + vat + perception, total, expectedNetAmount, netTolerance);

  if (kind === 'total') {
    return subtotalOptions.some((subtotal) =>
      vatOptions.some((vat) =>
        perceptionOptions.some((perception) => matches(subtotal, vat, perception, amount))
      )
    )
      ? 1
      : 0;
  }
  if (kind === 'vat') {
    return subtotalOptions.some((subtotal) =>
      perceptionOptions.some((perception) =>
        totalOptions.some((total) => matches(subtotal, amount, perception, total))
      )
    )
      ? 1
      : 0;
  }
  if (kind === 'subtotal') {
    return vatOptions.some((vat) =>
      perceptionOptions.some((perception) =>
        totalOptions.some((total) => matches(amount, vat, perception, total))
      )
    )
      ? 1
      : 0;
  }
  return subtotalOptions.some((subtotal) =>
    vatOptions.some((vat) =>
      totalOptions.some((total) => matches(subtotal, vat, amount, total))
    )
  )
    ? 1
    : 0;
}

function combineScore(
  modelConfidence: number,
  format: number,
  math: number,
  reconstruction: number,
  options: { includeMath: boolean; includeTotal: boolean }
): number {
  const { contextWeight, formatWeight, mathWeight, totalWeight } =
    INVOICE_CONFIDENCE_DEFAULTS;
  let score = clamp01(modelConfidence) * contextWeight + format * formatWeight;
  let weight = contextWeight + formatWeight;
  if (options.includeMath) {
    score += math * mathWeight;
    weight += mathWeight;
  }
  if (options.includeTotal) {
    score += reconstruction * totalWeight;
    weight += totalWeight;
  }
  return clamp01(score / weight);
}

function finiteNumbers(
  items: OpenRouterInvoiceCandidate<number>[] | undefined
): OpenRouterInvoiceCandidate<number>[] {
  return (items ?? []).filter((item) => Number.isFinite(item?.value));
}

function finiteStrings(
  items: OpenRouterInvoiceCandidate<string>[] | undefined
): OpenRouterInvoiceCandidate<string>[] {
  return (items ?? []).filter(
    (item) => typeof item?.value === 'string' && item.value.trim().length > 0
  );
}

function rankNumeric(
  items: OpenRouterInvoiceCandidate<number>[],
  expectedNetAmount: number,
  kind: 'vat' | 'perceptions' | 'subtotal' | 'total',
  raw: OpenRouterInvoiceResponse
): InvoiceCandidate<number>[] {
  const ranked = finiteNumbers(items).map((item) => {
    const modelConfidence = clamp01(item.confidence);
    const confidence = combineScore(
      modelConfidence,
      formatScoreNumber(item.value),
      mathScoreAmount(item.value, expectedNetAmount, kind),
      reconstructionScore(item.value, kind, raw, expectedNetAmount),
      { includeMath: true, includeTotal: true }
    );
    return {
      value: item.value,
      modelConfidence,
      confidence,
      level: levelFor(confidence),
    };
  });
  return finalizeNumeric(ranked);
}

function rankStrings(
  items: OpenRouterInvoiceCandidate<string>[],
  kind: 'invoiceNumber' | 'invoiceDate'
): InvoiceCandidate<string>[] {
  const ranked = finiteStrings(items).map((item) => {
    const modelConfidence = clamp01(item.confidence);
    const value = item.value.trim();
    const confidence = combineScore(
      modelConfidence,
      formatScoreString(value, kind),
      0,
      0,
      { includeMath: false, includeTotal: false }
    );
    return {
      value,
      modelConfidence,
      confidence,
      level: levelFor(confidence),
    };
  });
  return finalizeStrings(ranked);
}

function finalizeNumeric(items: InvoiceCandidate<number>[]): InvoiceCandidate<number>[] {
  const byValue = new Map<number, InvoiceCandidate<number>>();
  for (const item of items) {
    const key = toCents(item.value);
    const current = byValue.get(key);
    if (!current || item.confidence > current.confidence) {
      byValue.set(key, item);
    }
  }
  return [...byValue.values()]
    .sort((a, b) => b.confidence - a.confidence || b.modelConfidence - a.modelConfidence)
    .slice(0, INVOICE_CONFIDENCE_DEFAULTS.maxCandidates);
}

function finalizeStrings(items: InvoiceCandidate<string>[]): InvoiceCandidate<string>[] {
  const byValue = new Map<string, InvoiceCandidate<string>>();
  for (const item of items) {
    const key = item.value;
    const current = byValue.get(key);
    if (!current || item.confidence > current.confidence) {
      byValue.set(key, item);
    }
  }
  return [...byValue.values()]
    .sort((a, b) => b.confidence - a.confidence || b.modelConfidence - a.modelConfidence)
    .slice(0, INVOICE_CONFIDENCE_DEFAULTS.maxCandidates);
}

export function rankInvoiceCandidates(
  raw: OpenRouterInvoiceResponse,
  expectedNetAmount: number
): InvoiceAiResult {
  const source = raw ?? {
    invoice_number_candidates: [],
    invoice_date_candidates: [],
    vat_candidates: [],
    perception_candidates: [],
    subtotal_candidates: [],
    total_candidates: [],
  };
  return {
    invoiceNumber: rankStrings(source.invoice_number_candidates, 'invoiceNumber'),
    invoiceDate: rankStrings(source.invoice_date_candidates, 'invoiceDate'),
    vat: rankNumeric(source.vat_candidates, expectedNetAmount, 'vat', source),
    perceptions: rankNumeric(
      source.perception_candidates,
      expectedNetAmount,
      'perceptions',
      source
    ),
    subtotal: rankNumeric(
      source.subtotal_candidates,
      expectedNetAmount,
      'subtotal',
      source
    ),
    total: rankNumeric(source.total_candidates, expectedNetAmount, 'total', source),
    expectedNetAmount,
  };
}
