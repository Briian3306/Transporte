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

/** Parse `yyyy-MM-dd` (or ISO prefix) as local start-of-day. */
export function parseDateInputValue(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return startOfDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
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
