import {
  buildPicoNoPicoAsignaciones,
  detectPicoNoPicoPair,
  isPicoNoPicoSelection,
  pairAlreadyConfirmed,
  parseCategoriaCalculated,
} from './auditoria-tarifas.helpers';
import { MOCK_STATUS_CATALOG, PEAJE_CV, buildZarate } from './mocks/auditoria-tarifas.mock';
import { TarifaNormalizadaRow } from './contracts.local';

describe('auditoria-tarifas.helpers pico/no pico', () => {
  const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV);

  function twoPrices(): TarifaNormalizadaRow[] {
    const [low, high] = [...buildZarate()].sort((a, b) => a.importe - b.importe);
    return [
      { ...low, diagnostico: 'POSIBLE_HORARIO', status: 'PENDIENTE' },
      { ...high, diagnostico: 'POSIBLE_HORARIO', status: 'PENDIENTE' },
    ];
  }

  it('detecta el par de dos precios distintos', () => {
    const pair = detectPicoNoPicoPair(twoPrices(), catalog);
    expect(pair).toBeTruthy();
    expect(pair!.low.importe).toBeLessThan(pair!.high.importe);
    expect(pair!.noPicoCode).toBe('NO_PICO');
    expect(pair!.picoCode).toBe('PICO');
  });

  it('no detecta familias de más de dos niveles', () => {
    expect(detectPicoNoPicoPair(buildZarate(), catalog)).toBeNull();
  });

  it('arma asignaciones barato=No Pico y caro=Pico', () => {
    const pair = detectPicoNoPicoPair(twoPrices(), catalog)!;
    expect(buildPicoNoPicoAsignaciones(pair)).toEqual([
      { tarifa_normalizada_id: pair.low.id, status_codigo: 'NO_PICO' },
      { tarifa_normalizada_id: pair.high.id, status_codigo: 'PICO' },
    ]);
  });

  it('reconoce la selección No Pico + Pico por precio', () => {
    const pair = detectPicoNoPicoPair(twoPrices(), catalog)!;
    const selections = new Map<string, string>([
      [pair.low.id, 'NO_PICO'],
      [pair.high.id, 'PICO'],
    ]);
    expect(isPicoNoPicoSelection(pair, selections)).toBeTrue();
    selections.set(pair.low.id, 'PICO');
    expect(isPicoNoPicoSelection(pair, selections)).toBeFalse();
  });

  it('marca el par como ya confirmado solo con diagnóstico Confirmado y status correcto', () => {
    const [low, high] = twoPrices();
    const pending = detectPicoNoPicoPair([low, high], catalog)!;
    expect(pairAlreadyConfirmed(pending)).toBeFalse();
    const confirmed = detectPicoNoPicoPair(
      [
        { ...low, diagnostico: 'CONFIRMADO', status: 'NO_PICO' },
        { ...high, diagnostico: 'CONFIRMADO', status: 'PICO' },
      ],
      catalog
    )!;
    expect(pairAlreadyConfirmed(confirmed)).toBeTrue();
  });
});

describe('parseCategoriaCalculated', () => {
  it('acepta 0–10, recorta fuera de rango y vacía a null', () => {
    expect(parseCategoriaCalculated(0)).toBe(0);
    expect(parseCategoriaCalculated(5)).toBe(5);
    expect(parseCategoriaCalculated(10)).toBe(10);
    expect(parseCategoriaCalculated(11)).toBe(10);
    expect(parseCategoriaCalculated(-2)).toBe(0);
    expect(parseCategoriaCalculated('')).toBeNull();
    expect(parseCategoriaCalculated(null)).toBeNull();
    expect(parseCategoriaCalculated('3')).toBe(3);
  });
});
