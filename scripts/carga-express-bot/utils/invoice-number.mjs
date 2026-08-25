/** Strip invoice-type letters (A/B/C) that AI sometimes prefixes. */
export function stripInvoiceTypeLetters(value) {
  return String(value ?? '')
    .replace(/^\s*[ABC]\s*[-–.]?\s*/i, '')
    .replace(/\b[ABC]\s+(?=\d)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function hasHyphenatedNumber(value) {
  return /\d+-\d+/.test(String(value ?? ''));
}

/**
 * Pick the best invoice-number suggestion for a CSV `numero`.
 * Prefers a complete hyphenated value that matches the CSV digits.
 */
export function pickInvoiceNumber(suggestions, csvNumero) {
  const wanted = digitsOnly(csvNumero);
  const cleaned = (suggestions ?? []).map((item) => {
    const raw = typeof item === 'string' || typeof item === 'number' ? String(item) : String(item?.value ?? '');
    return {
      raw,
      cleaned: stripInvoiceTypeLetters(raw),
      confidence: typeof item === 'object' && item ? Number(item.confidence ?? 0) : 0,
    };
  }).filter((item) => item.cleaned);

  if (!cleaned.length) {
    const fallback = stripInvoiceTypeLetters(csvNumero);
    return fallback || null;
  }

  const hyphenated = cleaned.filter((item) => hasHyphenatedNumber(item.cleaned));
  const pool = hyphenated.length ? hyphenated : cleaned;

  const matching = pool.filter((item) => {
    const digits = digitsOnly(item.cleaned);
    if (!digits || !wanted) return false;
    return digits.includes(wanted) || wanted.includes(digits);
  });

  const ranked = (matching.length ? matching : pool).slice().sort((a, b) => {
    const hyphenDelta = Number(hasHyphenatedNumber(b.cleaned)) - Number(hasHyphenatedNumber(a.cleaned));
    if (hyphenDelta) return hyphenDelta;
    return b.confidence - a.confidence;
  });

  return ranked[0]?.cleaned ?? stripInvoiceTypeLetters(csvNumero) ?? null;
}
