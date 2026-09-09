import {
  TARIFA_CATEGORIAS,
  type TarifarioIdentidadExistente,
} from '../models/tarifario.contracts';
import {
  MISSING_IMPORTE_LABEL,
  TARIFARIO_CATEGORIAS_MAX,
  buildEditorRows,
  categoriasEditor,
  collectCambios,
  collectDraftErrores,
  countCategoriasEditor,
  formatTarifaImporte,
  formatTarifaImporteDisplay,
  isTarifaSentido,
  parseTarifaImporte,
} from './tarifario.helpers';

describe('TARIFA_CATEGORIAS', () => {
  it('es la fuente unica 0 a 10', () => {
    expect([...TARIFA_CATEGORIAS]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('parseTarifaImporte', () => {
  it('devuelve null para vacio, guion y espacios', () => {
    expect(parseTarifaImporte('')).toBeNull();
    expect(parseTarifaImporte('   ')).toBeNull();
    expect(parseTarifaImporte('-')).toBeNull();
    expect(parseTarifaImporte(null)).toBeNull();
    expect(parseTarifaImporte(undefined)).toBeNull();
  });

  it('parsea enteros y formato es-AR', () => {
    expect(parseTarifaImporte('5800')).toBe(5800);
    expect(parseTarifaImporte('5.800')).toBe(5800);
    expect(parseTarifaImporte('$ 5.800,00')).toBe(5800);
    expect(parseTarifaImporte('7300,5')).toBe(7300.5);
  });

  it('devuelve null para texto invalido', () => {
    expect(parseTarifaImporte('abc')).toBeNull();
  });

  it('trata 0 como numero valido, no como faltante', () => {
    expect(parseTarifaImporte('0')).toBe(0);
  });
});

describe('formatTarifaImporte / formatTarifaImporteDisplay', () => {
  it('formatea en es-AR', () => {
    expect(formatTarifaImporte(5500)).toBe('$5.500,00');
  });

  it('muestra em dash cuando falta el importe, nunca 0', () => {
    expect(formatTarifaImporteDisplay(null)).toBe(MISSING_IMPORTE_LABEL);
    expect(formatTarifaImporteDisplay(undefined)).toBe(MISSING_IMPORTE_LABEL);
    expect(MISSING_IMPORTE_LABEL).toBe('—');
    expect(formatTarifaImporteDisplay(0)).toBe('$0,00');
  });
});

describe('isTarifaSentido', () => {
  it('acepta solo IDA, VUELTA y AMBAS', () => {
    expect(isTarifaSentido('IDA')).toBeTrue();
    expect(isTarifaSentido('VUELTA')).toBeTrue();
    expect(isTarifaSentido('AMBAS')).toBeTrue();
    expect(isTarifaSentido('ida')).toBeFalse();
    expect(isTarifaSentido('')).toBeFalse();
  });
});

describe('countCategoriasEditor / categoriasEditor', () => {
  it('vacio no inventa filas; el tope sigue en 10', () => {
    expect(countCategoriasEditor([])).toBe(0);
    expect(categoriasEditor(0)).toEqual([]);
    expect(categoriasEditor(3)).toEqual([1, 2, 3]);
    expect(categoriasEditor(5)).toEqual([1, 2, 3, 4, 5]);
    expect(categoriasEditor(99)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(TARIFARIO_CATEGORIAS_MAX).toBe(10);
  });

  it('muestra hasta la categoria mas alta con dato, sin padding vacio', () => {
    expect(countCategoriasEditor([{ categoria: 2 }])).toBe(2);
    expect(countCategoriasEditor([{ categoria: 5 }])).toBe(5);
    expect(countCategoriasEditor([{ categoria: 8 }])).toBe(8);
    expect(countCategoriasEditor([{ categoria: 10 }])).toBe(10);
  });
});

describe('buildEditorRows', () => {
  it('por defecto no muestra filas vacias', () => {
    const rows = buildEditorRows([]);
    expect(rows.length).toBe(0);
  });

  it('rellena celdas existentes y deja faltantes en null, no 0', () => {
    const existentes: TarifarioIdentidadExistente[] = [
      {
        tarifa_id: 't-1-np',
        categoria: 1,
        status: 'NO_PICO',
        current_tarifa_importe_id: 'ti-1',
        importe: 5500,
        fecha_actualizacion: '2026-03-10T00:00:00.000Z',
      },
      {
        tarifa_id: 't-1-p',
        categoria: 1,
        status: 'PICO',
        current_tarifa_importe_id: 'ti-2',
        importe: 6000,
        fecha_actualizacion: '2026-03-10T00:00:00.000Z',
      },
      {
        tarifa_id: 't-2-np',
        categoria: 2,
        status: 'NO_PICO',
        current_tarifa_importe_id: 'ti-3',
        importe: 7000,
        fecha_actualizacion: '2026-03-10T00:00:00.000Z',
      },
      {
        tarifa_id: 't-3-p',
        categoria: 3,
        status: 'PICO',
        current_tarifa_importe_id: 'ti-4',
        importe: 9500,
        fecha_actualizacion: '2026-03-10T00:00:00.000Z',
      },
    ];
    const rows = buildEditorRows(existentes);
    const cat1 = rows.find((r) => r.categoria === 1)!;
    const cat2 = rows.find((r) => r.categoria === 2)!;
    const cat3 = rows.find((r) => r.categoria === 3)!;
    expect(rows.map((r) => r.categoria)).toEqual([1, 2, 3]);
    expect(cat1.no_pico.importe).toBe(5500);
    expect(cat1.pico.importe).toBe(6000);
    expect(cat2.no_pico.importe).toBe(7000);
    expect(cat2.pico.importe).toBeNull();
    expect(cat3.no_pico.importe).toBeNull();
    expect(cat3.pico.importe).toBe(9500);
  });
});

describe('collectCambios', () => {
  it('omite New vacios e incluye solo celdas parseables', () => {
    const rows = buildEditorRows([], categoriasEditor(2));
    const drafts = Object.fromEntries(
      rows.map((r) => [r.categoria, { no_pico: '', pico: '' }]),
    );
    drafts[1] = { no_pico: '5800', pico: '' };
    drafts[2] = { no_pico: '7300', pico: '7900' };
    expect(collectCambios(rows, drafts)).toEqual([
      { categoria: 1, status: 'NO_PICO', importe: 5800 },
      { categoria: 2, status: 'NO_PICO', importe: 7300 },
      { categoria: 2, status: 'PICO', importe: 7900 },
    ]);
  });

  it('marca New invalidos para bloquear el guardado', () => {
    const rows = buildEditorRows([], categoriasEditor(2));
    const drafts = Object.fromEntries(
      rows.map((r) => [r.categoria, { no_pico: '', pico: '' }]),
    );
    drafts[1] = { no_pico: 'abc', pico: '' };
    drafts[2] = { no_pico: '7300', pico: 'no-numero' };
    expect(collectDraftErrores(rows, drafts)).toEqual([
      { categoria: 1, status: 'NO_PICO' },
      { categoria: 2, status: 'PICO' },
    ]);
  });
});
