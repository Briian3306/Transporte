import {
  toPostgresFechaHora,
  formatLocalDateTime,
  formatUtcDateTime,
  formatUtcDateOnly,
  isUtcDateOnly,
  normalizarCeldaExcel,
} from './peajes-fecha.util';

describe('toPostgresFechaHora', () => {
  it('acepta ISO con hora', () => {
    expect(toPostgresFechaHora('2026-07-13 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('acepta dd/MM/yyyy con hora', () => {
    expect(toPostgresFechaHora('13/07/2026 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('corrige yyyy-dd-MM inválido', () => {
    expect(toPostgresFechaHora('2026-13-07 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('acepta MM/DD cuando mes>12 en 2.º token no aplica; 07/13 es julio', () => {
    expect(toPostgresFechaHora('07/13/2026 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('formatea Date local', () => {
    const d = new Date(2026, 6, 13, 15, 54, 17);
    expect(toPostgresFechaHora(d)).toBe('2026-07-13 15:54:17');
  });

  it('convierte un serial de fecha Excel a timestamp PostgreSQL', () => {
    expect(toPostgresFechaHora(46078.63943287037)).toBe('2026-02-25 15:20:47');
  });

  it('preserva correctamente el meridiano de una fecha Excel textual', () => {
    expect(toPostgresFechaHora('01/07/2026 06:19:24 PM')).toBe('2026-07-01 18:19:24');
  });

  it('rechaza fecha imposible', () => {
    expect(toPostgresFechaHora('2026-13-32 15:54:17')).toBeNull();
  });
});

describe('formatLocalDateTime / normalizarCeldaExcel', () => {
  it('exporta yyyy-MM-dd HH:mm:ss', () => {
    expect(formatLocalDateTime(new Date(2026, 6, 24, 13, 37, 24))).toBe('2026-07-24 13:37:24');
  });

  it('normalizarCeldaExcel usa formatLocalDateTime para datetime local', () => {
    expect(normalizarCeldaExcel(new Date(2026, 6, 24, 23, 54, 2))).toBe('2026-07-24 23:54:02');
  });

  it('normalizarCeldaExcel date-only UTC midnight usa calendario UTC (no −1 día ART)', () => {
    const utcMidnight = new Date(Date.UTC(2026, 6, 13)); // 2026-07-13T00:00:00Z
    expect(isUtcDateOnly(utcMidnight)).toBeTrue();
    expect(formatUtcDateOnly(utcMidnight)).toBe('2026-07-13');
    expect(normalizarCeldaExcel(utcMidnight)).toBe('2026-07-13 00:00:00');
  });

  it('normaliza un serial Excel solo cuando la columna es fecha', () => {
    expect(normalizarCeldaExcel(46078.63943287037, true)).toBe('2026-02-25 15:20:47');
    expect(normalizarCeldaExcel(46078.63943287037)).toBe(46078.63943287037);
  });
});

describe('formatUtcDateTime', () => {
  it('muestra componentes UTC sin shift local', () => {
    expect(formatUtcDateTime('2026-07-11T18:02:07.000Z')).toBe('2026-07-11 18:02:07');
    expect(formatUtcDateTime('2026-07-11 18:02:07+00')).toBe('2026-07-11 18:02:07');
  });

  it('soporta sin segundos', () => {
    expect(formatUtcDateTime('2026-07-11T18:02:07.000Z', false)).toBe('2026-07-11 18:02');
  });
});
