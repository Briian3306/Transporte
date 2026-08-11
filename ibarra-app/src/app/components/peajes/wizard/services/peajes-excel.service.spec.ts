import { TestBed } from '@angular/core/testing';
import { PeajesExcelService } from './peajes-excel.service';
import { parseNumeroArs } from '../../plantillas/motor/strategies/estrategias-atomicas';
import { formatLocalDateTime, normalizarCeldaExcel } from './peajes-fecha.util';

describe('PeajesExcelService CSV AR', () => {
  let service: PeajesExcelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PeajesExcelService);
  });

  it('conserva TARIFA como texto 19.985,09 (no number 19.98509)', async () => {
    const csv = [
      'FECHA;HORA;ESTACION;DISPOSITIVO;PATENTE;TARIFA',
      '2026-07-24;11:46:31;VAR;94337220;OWG130;19.985,09',
      '2026-07-23;11:15:07;VAR;94189136;AF436WI;44.494,48',
    ].join('\n');
    const file = new File([csv], 'pasadas_ausa.csv', { type: 'text/csv' });

    const preview = await service.parsearArchivo(file);

    expect(preview.totalFilas).toBe(2);
    expect(preview.filasOrigen[0]['TARIFA']).toBe('19.985,09');
    expect(typeof preview.filasOrigen[0]['TARIFA']).toBe('string');
    expect(parseNumeroArs(preview.filasOrigen[0]['TARIFA'])).toBe(19985.09);
    expect(parseNumeroArs(preview.filasOrigen[1]['TARIFA'])).toBe(44494.48);
  });

  it('splitCsvLine respeta comillas y delimitador ;', () => {
    expect(service.splitCsvLine('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
    expect(service.splitCsvLine('19.985,09;x', ';')).toEqual(['19.985,09', 'x']);
  });
});

describe('normalizarCeldaExcel Fecha datetime (F13-RN16-FECHA)', () => {
  it('preserva HH:mm:ss (no colapsa a medianoche) — caso ZARATE 07/24', () => {
    const fechas = [
      new Date(2026, 6, 24, 13, 37, 24),
      new Date(2026, 6, 24, 14, 8, 28),
      new Date(2026, 6, 24, 23, 26, 45),
      new Date(2026, 6, 24, 23, 54, 2),
    ];
    const normalizadas = fechas.map((d) => normalizarCeldaExcel(d));
    expect(normalizadas[0]).toBe(formatLocalDateTime(fechas[0]));
    expect(normalizadas).toEqual([
      '2026-07-24 13:37:24',
      '2026-07-24 14:08:28',
      '2026-07-24 23:26:45',
      '2026-07-24 23:54:02',
    ]);
    expect(new Set(normalizadas).size).toBe(4);
    for (const f of normalizadas) {
      expect(String(f)).not.toMatch(/00:00:00$/);
    }
  });

  it('deja texto y números sin convertir', () => {
    expect(normalizarCeldaExcel('07/24/2026 13:37:24')).toBe('07/24/2026 13:37:24');
    expect(normalizarCeldaExcel(19.985)).toBe(19.985);
    expect(normalizarCeldaExcel(null)).toBeNull();
  });
});
