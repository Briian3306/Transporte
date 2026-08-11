import {
  agregarIvaDocumento,
  agregarIvaImporte,
  buscarColumnaPorAliases,
  concesionDominanteDeFilas,
  concesionPorValorEstacion,
  CONSUMOS_RESUMEN_ALIASES,
  esColumnaMetadataMasiva,
  normalizarEncabezadoColumna,
  quitarIvaDocumento,
  quitarIvaImporte,
  reconocerPeajeDesdeConcesion,
  resolverEmpresaDesdeConcesion,
  resolverPeajeDesdeConcesion,
} from './consumos-resumen.helpers';

describe('consumos-resumen.helpers', () => {
  it('normaliza Tag Nº y Estación', () => {
    expect(normalizarEncabezadoColumna('Tag Nº')).toBe('TAG N');
    expect(normalizarEncabezadoColumna('Estación')).toBe('ESTACION');
    expect(normalizarEncabezadoColumna(' Importe Final ')).toBe('IMPORTE FINAL');
  });

  it('resuelve columnas ConsumosResumen', () => {
    const cols = [
      'Tag Nº',
      'Dominio',
      'Concesion',
      'FACTURA',
      'Estación',
      'Importe Original',
      'Descuento Importe',
      'Fecha',
    ];
    expect(buscarColumnaPorAliases(cols, CONSUMOS_RESUMEN_ALIASES.pase)).toBe('Tag Nº');
    expect(buscarColumnaPorAliases(cols, CONSUMOS_RESUMEN_ALIASES.estacion)).toBe('Estación');
    expect(buscarColumnaPorAliases(cols, CONSUMOS_RESUMEN_ALIASES.precio)).toBe('Importe Original');
    expect(buscarColumnaPorAliases(cols, CONSUMOS_RESUMEN_ALIASES.bonificacion)).toBe(
      'Descuento Importe'
    );
    expect(esColumnaMetadataMasiva('Concesion')).toBeTrue();
    expect(esColumnaMetadataMasiva('FACTURA')).toBeTrue();
    expect(esColumnaMetadataMasiva('Estación')).toBeFalse();
  });

  it('elige concesión dominante del grupo', () => {
    expect(
      concesionDominanteDeFilas(
        [
          { Concesion: 'A' },
          { Concesion: 'B' },
          { Concesion: 'B' },
        ],
        'Concesion'
      )
    ).toBe('B');
  });

  it('resuelve empresa por nombre o peaje', () => {
    const empresas = [
      { id: 'e1', nombre: 'CORREDORES VIALES SA' },
      { id: 'e2', nombre: 'RUTAS SUR ATLANTICO S.A.' },
    ];
    const peajes = [{ id: 'p1', nombre: 'AGÜERO', empresa_id: 'e2' }];
    expect(resolverEmpresaDesdeConcesion('Corredores Viales SA', empresas).empresaId).toBe('e1');
    expect(resolverEmpresaDesdeConcesion('AGÜERO', empresas, peajes)).toEqual(
      jasmine.objectContaining({ empresaId: 'e2', matchedVia: 'peaje' })
    );
  });

  it('agrega y quita IVA de cabecera', () => {
    const conIva = agregarIvaDocumento({ importe_sin_iva: 100, percepciones: 0 });
    expect(conIva.iva).toBe(21);
    expect(conIva.importe_total).toBe(121);
    const sin = quitarIvaDocumento({ importe_sin_iva: 121, percepciones: 0 });
    expect(sin.importe_sin_iva).toBe(100);
    expect(sin.iva).toBe(0);
  });

  it('quita/agrega IVA en importes de pasada (idempotencia aproximada)', () => {
    expect(quitarIvaImporte(121)).toBe(100);
    expect(agregarIvaImporte(100)).toBe(121);
  });

  it('RN-26: resuelve peaje desde Concesion y mapea por estación', () => {
    const peajes = [
      { id: 'p-ausa', nombre: 'AUSA', empresa_id: 'e1' },
      { id: 'p-cv', nombre: 'CORREDORES VIALES SA', empresa_id: 'e2' },
    ];
    expect(resolverPeajeDesdeConcesion('AUSA', peajes, 'e1')?.id).toBe('p-ausa');
    const map = concesionPorValorEstacion(
      [
        { Estación: 'Parque Avellaneda', Concesion: 'AUSA' },
        { Estación: 'ZARATE', Concesion: 'CORREDORES VIALES SA' },
        { Estación: 'ZARATE', Concesion: 'CORREDORES VIALES SA' },
      ],
      'Estación',
      'Concesion'
    );
    expect(map.get('Parque Avellaneda')).toBe('AUSA');
    expect(map.get('ZARATE')).toBe('CORREDORES VIALES SA');
  });

  it('reconocerPeajeDesdeConcesion: exacta / sugerencias / sin_coincidencia', () => {
    const peajes = [
      { id: 'p1', nombre: 'CORREDORES VIALES SA', empresa_id: 'e2' },
      { id: 'p2', nombre: 'CORREDOR VIAL NORTE', empresa_id: 'e2' },
      { id: 'p3', nombre: 'AUSA', empresa_id: 'e1' },
    ];
    expect(reconocerPeajeDesdeConcesion('Corredores Viales SA', peajes).tipo).toBe('exacta');
    expect(reconocerPeajeDesdeConcesion('CORREDOR', peajes).tipo).toBe('sugerencias');
    expect(reconocerPeajeDesdeConcesion('RUTAS SUR ATLANTICO S.A.', peajes).tipo).toBe(
      'sin_coincidencia'
    );
  });
});
