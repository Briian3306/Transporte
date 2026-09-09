/**
 * Normaliza FECHA_HORA hacia `yyyy-MM-dd HH:mm:ss` para Postgres timestamptz.
 * Evita errores 22008 por DateStyle MDY ante valores `dd/MM/yyyy` (p. ej. 13/07/2026 → mes 13).
 */

export function toPostgresFechaHora(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return fechaHoraDesdeSerialExcel(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDateTime(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  // yyyy-MM-dd[ T]HH:mm[:ss] — corregir si vino como yyyy-dd-MM (mes > 12)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/.exec(s);
  if (m) {
    let month = Number(m[2]);
    let day = Number(m[3]);
    if (month > 12 && day >= 1 && day <= 12) {
      const swap = month;
      month = day;
      day = swap;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const hora = normalizarHora(Number(m[4] ?? 0), m[7]);
    if (hora == null) return null;
    const hh = String(hora).padStart(2, '0');
    const mm = String(Number(m[5] ?? 0)).padStart(2, '0');
    const ss = String(Number(m[6] ?? 0)).padStart(2, '0');
    return `${m[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}:${ss}`;
  }

  // dd/MM/yyyy[ HH:mm[:ss]] (es-AR). Si el 2.º token > 12, interpretar MM/DD.
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/.exec(s);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    if (month > 12 && day >= 1 && day <= 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const hora = normalizarHora(Number(m[4] ?? 0), m[7]);
    if (hora == null) return null;
    const hh = String(hora).padStart(2, '0');
    const mm = String(Number(m[5] ?? 0)).padStart(2, '0');
    const ss = String(Number(m[6] ?? 0)).padStart(2, '0');
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}:${ss}`;
  }

  return null;
}

function normalizarHora(value: number, amPm?: string): number | null {
  if (!Number.isInteger(value)) return null;
  const meridiano = amPm?.toUpperCase();
  if (!meridiano) return value >= 0 && value <= 23 ? value : null;
  if (value < 1 || value > 12) return null;
  if (meridiano === 'AM') return value === 12 ? 0 : value;
  return value === 12 ? 12 : value + 12;
}

function fechaHoraDesdeSerialExcel(value: number): string | null {
  if (!Number.isFinite(value) || value < 20_000 || value > 80_000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000));
  return Number.isNaN(d.getTime()) ? null : formatUtcDateTime(d);
}

/** Local `yyyy-MM-dd HH:mm:ss` (preserves HMS; used by Excel normalize + Postgres). */
export function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day} ${hh}:${mm}:${ss}`;
}

/** True when the instant is UTC midnight (typical SheetJS/Excel date-only cell). */
export function isUtcDateOnly(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/** UTC calendar date `yyyy-MM-dd` (no browser TZ shift). */
export function formatUtcDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/**
 * Display timestamptz / ISO strings as UTC wall-clock (matches Supabase dashboard),
 * without shifting to the browser local timezone.
 */
export function formatUtcDateTime(
  value: string | Date | null | undefined,
  withSeconds = true
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value).trim();
    return s.replace('T', ' ').replace(/\+00(:00)?$/, '').replace(/Z$/i, '').slice(0, withSeconds ? 19 : 16);
  }
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return withSeconds ? `${y}-${mo}-${day} ${hh}:${mm}:${ss}` : `${y}-${mo}-${day} ${hh}:${mm}`;
}

/**
 * UTC calendar date `dd/MM/yyyy` for range labels (no local TZ shift).
 */
export function formatUtcDateShort(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${mo}/${d.getUTCFullYear()}`;
}

/**
 * Normaliza celdas Excel para el motor: Date → yyyy-MM-dd HH:mm:ss.
 * - Date-only (UTC midnight, SheetJS/Excel): UTC calendar day + `00:00:00`
 *   (avoids ART −1 day when local getters run on UTC midnight).
 * - Datetime cells: local wall-clock (F13-RN16-FECHA / ConsumosResumen).
 */
export function normalizarCeldaExcel(value: unknown, esColumnaFecha = false): unknown {
  if (value == null || value === '') return value ?? null;
  if (esColumnaFecha) {
    return toPostgresFechaHora(value) ?? value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (isUtcDateOnly(value)) {
      return `${formatUtcDateOnly(value)} 00:00:00`;
    }
    return formatLocalDateTime(value);
  }
  return value;
}
