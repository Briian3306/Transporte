import { TestBed } from '@angular/core/testing';
import { PeajesExcelService } from './peajes-excel.service';
import { parseNumeroArs } from '../../plantillas/motor/strategies/estrategias-atomicas';

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
