/**
 * Normaliza FECHA_HORA hacia `yyyy-MM-dd HH:mm:ss` para Postgres timestamptz.
 * Evita errores 22008 por DateStyle MDY ante valores `dd/MM/yyyy` (p. ej. 13/07/2026 → mes 13).
 */

export function toPostgresFechaHora(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDateTime(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  // yyyy-MM-dd[ T]HH:mm[:ss] — corregir si vino como yyyy-dd-MM (mes > 12)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    let month = Number(m[2]);
    let day = Number(m[3]);
    if (month > 12 && day >= 1 && day <= 12) {
      const swap = month;
      month = day;
      day = swap;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const hh = String(Number(m[4] ?? 0)).padStart(2, '0');
    const mm = String(Number(m[5] ?? 0)).padStart(2, '0');
    const ss = String(Number(m[6] ?? 0)).padStart(2, '0');
    return `${m[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}:${ss}`;
  }

  // dd/MM/yyyy[ HH:mm[:ss]] (es-AR). Si el 2.º token > 12, interpretar MM/DD.
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    if (month > 12 && day >= 1 && day <= 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const hh = String(Number(m[4] ?? 0)).padStart(2, '0');
    const mm = String(Number(m[5] ?? 0)).padStart(2, '0');
    const ss = String(Number(m[6] ?? 0)).padStart(2, '0');
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}:${ss}`;
  }

  return null;
}

function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day} ${hh}:${mm}:${ss}`;
}
