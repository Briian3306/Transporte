import { toPostgresFechaHora } from './peajes-fecha.util';

describe('toPostgresFechaHora', () => {
  it('conserva yyyy-MM-dd HH:mm:ss válido', () => {
    expect(toPostgresFechaHora('2026-07-13 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('convierte dd/MM/yyyy HH:mm:ss (es-AR) a ISO', () => {
    expect(toPostgresFechaHora('13/07/2026 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('corrige yyyy-dd-MM inválido (mes 13) intercambiando día/mes', () => {
    expect(toPostgresFechaHora('2026-13-07 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('interpreta MM/DD cuando el segundo token > 12', () => {
    expect(toPostgresFechaHora('07/13/2026 15:54:17')).toBe('2026-07-13 15:54:17');
  });

  it('acepta Date local', () => {
    const d = new Date(2026, 6, 13, 15, 54, 17);
    expect(toPostgresFechaHora(d)).toBe('2026-07-13 15:54:17');
  });

  it('devuelve null si el mes sigue inválido', () => {
    expect(toPostgresFechaHora('2026-13-32 15:54:17')).toBeNull();
  });
});
