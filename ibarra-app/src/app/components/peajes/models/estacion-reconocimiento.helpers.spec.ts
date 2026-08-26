import {
  codigoEstacionEquivalente,
  reconocerEstacionEnCatalogo,
  estacionPerteneceAEmpresa,
  estacionesDesdeAliasFilas,
} from './estacion-reconocimiento.helpers';
import { Estacion, Peaje } from './peajes.models';

const mercosurId = '37ab9246-a07a-40b5-b62d-7a8b8e7782db';
const aubasaId = '75d868b4-aef5-409a-8d12-973506656811';

const peajes: Peaje[] = [
  { id: 'PEA-MERCOSUR', nombre: 'Autovía del Mercosur', empresa_id: mercosurId },
  { id: 'PEA-AUBASA', nombre: 'AUBASA', empresa_id: aubasaId },
];

const zarate: Estacion = {
  id: 'EST-MER-0001',
  peaje_id: 'PEA-MERCOSUR',
  nombre: 'Zarate',
  codigos_proveedor: ['0001', '1'],
  peaje: peajes[0],
};

const dockSud: Estacion = {
  id: 'EST-DOCK',
  peaje_id: 'PEA-AUBASA',
  nombre: 'DOCK SUD',
  codigos_proveedor: ['0001', '1'],
  peaje: peajes[1],
};

describe('estacion-reconocimiento.helpers', () => {
  it('trata 0001 y 1 como el mismo código', () => {
    expect(codigoEstacionEquivalente('0001', '1')).toBeTrue();
    expect(codigoEstacionEquivalente('0001', 1)).toBeTrue();
    expect(codigoEstacionEquivalente('0002', '0001')).toBeFalse();
  });

  it('con empresa MERCOSUR resuelve 0001 a Zarate, no a DOCK SUD', () => {
    const rec = reconocerEstacionEnCatalogo([dockSud, zarate], '0001', mercosurId, peajes);
    expect(rec.tipo).toBe('exacta');
    expect(rec.estacion?.id).toBe('EST-MER-0001');
  });

  it('con empresa AUBASA resuelve 0001 a DOCK SUD', () => {
    const rec = reconocerEstacionEnCatalogo([dockSud, zarate], '0001', aubasaId, peajes);
    expect(rec.tipo).toBe('exacta');
    expect(rec.estacion?.id).toBe('EST-DOCK');
  });

  it('sin empresa no elige: 0001 es sugerencia entre Zarate y DOCK SUD', () => {
    const rec = reconocerEstacionEnCatalogo([dockSud, zarate], '0001', null, peajes);
    expect(rec.tipo).toBe('sugerencias');
    expect(rec.estacion).toBeNull();
    expect(rec.sugerencias.map((s) => s.id).sort()).toEqual(['EST-DOCK', 'EST-MER-0001']);
  });

  it('estacionPerteneceAEmpresa rechaza DOCK SUD en MERCOSUR', () => {
    expect(estacionPerteneceAEmpresa(dockSud, mercosurId, peajes)).toBeFalse();
    expect(estacionPerteneceAEmpresa(zarate, mercosurId, peajes)).toBeTrue();
  });

  const madariaga: Estacion = {
    id: 'EST-MAD',
    peaje_id: 'PEA-AUBASA',
    nombre: 'GENERAL MADARIAGA',
    codigos_proveedor: ['1', 'AUBA10'],
    peaje: peajes[1],
  };

  const dockSudSolo0001: Estacion = {
    ...dockSud,
    codigos_proveedor: ['0001', 'AUBA1', 'DOCK SUD - AUBASA'],
  };

  it('en la misma empresa, 0001 no equivale a la estación cuyo código es 1', () => {
    const rec = reconocerEstacionEnCatalogo(
      [dockSudSolo0001, madariaga, zarate],
      '0001',
      aubasaId,
      peajes
    );
    expect(rec.tipo).toBe('exacta');
    expect(rec.estacion?.id).toBe('EST-DOCK');
  });

  it('en la misma empresa, 1 resuelve GENERAL MADARIAGA y no DOCK SUD (0001)', () => {
    const rec = reconocerEstacionEnCatalogo(
      [dockSudSolo0001, madariaga],
      '1',
      aubasaId,
      peajes
    );
    expect(rec.tipo).toBe('exacta');
    expect(rec.estacion?.id).toBe('EST-MAD');
  });

  it('si no hay match literal, 0001 cae al canónico 1', () => {
    const soloUno: Estacion = { ...zarate, codigos_proveedor: ['1'] };
    const rec = reconocerEstacionEnCatalogo([soloUno], '0001', mercosurId, peajes);
    expect(rec.tipo).toBe('exacta');
    expect(rec.estacion?.id).toBe('EST-MER-0001');
  });

  it('alias: 0001 gana sobre variantes canónicas 1 de otras estaciones', () => {
    const ranked = estacionesDesdeAliasFilas(
      [
        { valor_normalizado: '0001', estacion: dockSudSolo0001 },
        { valor_normalizado: '0001', estacion: dockSudSolo0001 },
        { valor_normalizado: '1', estacion: madariaga },
        { valor_normalizado: '1', estacion: { ...dockSud, nombre: 'BERNAL', id: 'EST-BERNAL', codigos_proveedor: ['3'] } },
      ],
      '0001',
      aubasaId,
      peajes
    );
    expect(ranked.map((e) => e.id)).toEqual(['EST-DOCK']);
  });
});
