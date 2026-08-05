export type DatePickerMode = 'range' | 'single';

export interface DateRangeValue {
  from: Date | null;
  to: Date | null;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateEs(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatRangeLabel(
  value: DateRangeValue,
  placeholder: string,
  mode: 'range' | 'single' = 'range'
): string {
  if (mode === 'single') {
    if (value.from) return formatDateEs(value.from);
    return placeholder;
  }
  if (value.from && value.to) {
    return `${formatDateEs(value.from)} – ${formatDateEs(value.to)}`;
  }
  if (value.from) {
    return formatDateEs(value.from);
  }
  return placeholder;
}

/** Local calendar date → `yyyy-MM-dd` for date-only form fields. */
export function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local calendar date → `dd/MM/yyyy` for keyboard entry display (es-AR). */
export function formatDateInputDisplay(d: Date | null | undefined): string {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

/** Build a local calendar date only when day/month/year are real. */
export function createValidLocalDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  const d = startOfDay(new Date(year, month - 1, day));
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Parse flexible typed dates (es-AR first):
 * `13/6/2020`, `13/06/2020`, `13-6-2020`, `13.6.2020`, `2020-06-13`, `13062020`.
 */
export function parseFlexibleDateInput(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    return createValidLocalDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }
    return createValidLocalDate(year, Number(m[2]), Number(m[1]));
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    return createValidLocalDate(
      Number(digits.slice(4, 8)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(0, 2))
    );
  }
  if (digits.length === 7) {
    // dmmYYYY → 1 digit day
    return createValidLocalDate(
      Number(digits.slice(3, 7)),
      Number(digits.slice(1, 3)),
      Number(digits.slice(0, 1))
    );
  }

  return null;
}

/** Parse `from – to` typed range; accepts one date as from-only. */
export function parseFlexibleDateRangeInput(raw: string | null | undefined): DateRangeValue {
  if (!raw?.trim()) return { from: null, to: null };
  // En/em dash may omit spaces; hyphen needs spaces so `13-6-2020` stays a single date.
  const parts = raw
    .split(/\s*[–—]\s*|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      from: parseFlexibleDateInput(parts[0]),
      to: parseFlexibleDateInput(parts[1]),
    };
  }
  return { from: parseFlexibleDateInput(raw), to: null };
}

/** Parse `yyyy-MM-dd` (or ISO prefix) as local start-of-day. */
export function parseDateInputValue(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return createValidLocalDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Local day → ISO for API filters. */
export function rangeToIsoFilters(value: DateRangeValue): {
  fecha_desde: string | null;
  fecha_hasta: string | null;
} {
  return {
    fecha_desde: value.from ? startOfDay(value.from).toISOString() : null,
    fecha_hasta: value.to ? endOfDay(value.to).toISOString() : null,
  };
}
