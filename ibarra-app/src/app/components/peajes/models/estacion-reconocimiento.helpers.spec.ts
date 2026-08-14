import {
  codigoEstacionEquivalente,
  reconocerEstacionEnCatalogo,
  estacionPerteneceAEmpresa,
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
});
