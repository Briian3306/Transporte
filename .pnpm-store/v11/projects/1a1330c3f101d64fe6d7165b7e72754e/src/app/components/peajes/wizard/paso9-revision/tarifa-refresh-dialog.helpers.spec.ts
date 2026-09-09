import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { TarifaSentido, TarifaStatusPico } from '../../models/tarifario.contracts';
import {
  agruparPendientesPorPeajeYFamilia,
  familySentidos,
  heuristicaSeleccionInicial,
  interseccionSentidos,
  resolverRequiereNormalizacionIva,
  sentidoFamilyOf,
  type EstacionCatalogoRefresco,
} from './tarifa-refresh-dialog.helpers';

const PEAJE = 'peaje-aubasa';

const DOCK = 'estacion-dock-sud';
const HUDSON = 'estacion-hudson';
const GUTIERREZ = 'estacion-gutierrez';
const BERNAL = 'estacion-bernal';
const VACIA = 'estacion-vacia';

function catalogo(
  estacionId: string,
  nombre: string,
  sentidos: TarifaSentido[],
): EstacionCatalogoRefresco {
  return {
    estacionId,
    estacionNombre: nombre,
    peajeId: PEAJE,
    peajeNombre: 'AUBASA',
    sentidosExistentes: sentidos,
  };
}

function pendiente(partial: Partial<ResultadoDetectarRefresco> & { estacionId: string }): ResultadoDetectarRefresco {
  return {
    id: partial.id ?? `${partial.estacionId}-7`,
    codigo: partial.codigo ?? 'NEW_TARIFF',
    peajeId: partial.peajeId ?? PEAJE,
    estacionId: partial.estacionId,
    categoria: partial.categoria ?? 7,
    status: partial.status ?? 'NO_PICO',
    sentidoSolicitado: partial.sentidoSolicitado ?? null,
    sentidoAplicado: partial.sentidoAplicado ?? null,
    importeActual: partial.importeActual ?? null,
    tarifaId: partial.tarifaId ?? null,
    tarifaImporteId: partial.tarifaImporteId ?? null,
    requiereNormalizacionIva: partial.requiereNormalizacionIva ?? false,
    rowIndexes: partial.rowIndexes ?? [0],
    candidatePrice: partial.candidatePrice ?? 25500,
  };
}

function candidato(
  partial: Partial<CandidatoRefrescoTarifa> & { estacionId: string },
): CandidatoRefrescoTarifa {
  return {
    id: partial.id ?? `${partial.estacionId}-7`,
    estacionId: partial.estacionId,
    categoria: partial.categoria ?? 7,
    statusSolicitado: partial.statusSolicitado ?? 'NO_PICO',
    sentidoSolicitado: partial.sentidoSolicitado ?? null,
    directionConfidence: partial.directionConfidence ?? 'UNRESOLVED',
    unresolvedReason: partial.unresolvedReason ?? 'MISSING_MAPPING',
    sourceStationCode: partial.sourceStationCode ?? null,
    sourceLane: partial.sourceLane ?? null,
    candidatePrice: partial.candidatePrice ?? 25500,
    precioDirecto: partial.precioDirecto ?? partial.candidatePrice ?? 25500,
    filaRepresentativa: partial.filaRepresentativa ?? {},
    rowIndexes: partial.rowIndexes ?? [0],
  };
}

describe('sentidoFamilyOf', () => {
  it('clasifica AMBAS cuando el catálogo ya tiene AMBAS', () => {
    expect(sentidoFamilyOf(['AMBAS'])).toBe('AMBAS');
    expect(sentidoFamilyOf(['IDA', 'AMBAS'])).toBe('AMBAS');
  });

  it('clasifica DIRECCIONAL cuando hay IDA o VUELTA y no AMBAS', () => {
    expect(sentidoFamilyOf(['IDA', 'VUELTA'])).toBe('DIRECCIONAL');
    expect(sentidoFamilyOf(['IDA'])).toBe('DIRECCIONAL');
    expect(sentidoFamilyOf(['VUELTA'])).toBe('DIRECCIONAL');
  });

  it('clasifica SIN_TARIFARIO si no hay sentidos existentes', () => {
    expect(sentidoFamilyOf([])).toBe('SIN_TARIFARIO');
  });
});

describe('familySentidos', () => {
  it('devuelve solo AMBAS para la familia AMBAS', () => {
    expect(familySentidos('AMBAS', ['AMBAS', 'IDA'])).toEqual(['AMBAS']);
  });

  it('devuelve la intersección IDA/VUELTA para la familia DIRECCIONAL', () => {
    expect(familySentidos('DIRECCIONAL', ['IDA', 'VUELTA', 'AMBAS'])).toEqual(['IDA', 'VUELTA']);
    expect(familySentidos('DIRECCIONAL', ['IDA'])).toEqual(['IDA']);
  });

  it('no inventa sentidos cuando no hay tarifario', () => {
    expect(familySentidos('SIN_TARIFARIO', [])).toEqual([]);
  });
});

describe('interseccionSentidos', () => {
  it('conserva solo los sentidos presentes en todas las estaciones seleccionadas', () => {
    expect(interseccionSentidos([['IDA', 'VUELTA'], ['IDA']])).toEqual(['IDA']);
    expect(interseccionSentidos([['IDA', 'VUELTA'], ['IDA', 'VUELTA']])).toEqual(['IDA', 'VUELTA']);
  });
});

describe('agruparPendientesPorPeajeYFamilia', () => {
  const aubasa: EstacionCatalogoRefresco[] = [
    catalogo(DOCK, 'DOCK SUD', ['IDA', 'VUELTA']),
    catalogo(HUDSON, 'HUDSON', ['IDA', 'VUELTA']),
    catalogo(GUTIERREZ, 'GUTIERREZ', ['AMBAS']),
    catalogo(BERNAL, 'BERNAL', ['IDA', 'VUELTA']),
    catalogo(VACIA, 'VACIA', []),
  ];

  it('agrupa pendientes DIRECCIONALES del mismo peaje y lista todas las estaciones de esa familia', () => {
    const grupos = agruparPendientesPorPeajeYFamilia(
      [pendiente({ estacionId: DOCK }), pendiente({ estacionId: HUDSON, rowIndexes: [1] })],
      aubasa,
    );
    expect(grupos.length).toBe(1);
    expect(grupos[0].key).toBe(`${PEAJE}|DIRECCIONAL`);
    expect(grupos[0].family).toBe('DIRECCIONAL');
    expect(grupos[0].opciones.map((o) => o.estacionId)).toEqual([DOCK, HUDSON, BERNAL]);
    expect(grupos[0].opciones.find((o) => o.estacionId === DOCK)?.pendiente).toBeTrue();
    expect(grupos[0].opciones.find((o) => o.estacionId === BERNAL)?.pendiente).toBeFalse();
  });

  it('separa AMBAS de DIRECCIONAL aunque compartan peaje', () => {
    const grupos = agruparPendientesPorPeajeYFamilia(
      [pendiente({ estacionId: DOCK }), pendiente({ estacionId: GUTIERREZ, rowIndexes: [1] })],
      aubasa,
    );
    expect(grupos.map((g) => g.family).sort()).toEqual(['AMBAS', 'DIRECCIONAL']);
    const ambas = grupos.find((g) => g.family === 'AMBAS')!;
    expect(ambas.opciones.map((o) => o.estacionId)).toEqual([GUTIERREZ]);
  });

  it('aísla estaciones SIN_TARIFARIO en un grupo propio sin opciones compartidas', () => {
    const grupos = agruparPendientesPorPeajeYFamilia(
      [pendiente({ estacionId: VACIA })],
      aubasa,
    );
    expect(grupos).toEqual([
      jasmine.objectContaining({
        family: 'SIN_TARIFARIO',
        opciones: [jasmine.objectContaining({ estacionId: VACIA, pendiente: true })],
      }),
    ]);
  });
});

describe('heuristicaSeleccionInicial', () => {
  it('premarca estaciones con el mismo precio detectado y deja el outlier desmarcado', () => {
    const grupo = agruparPendientesPorPeajeYFamilia(
      [
        pendiente({ estacionId: DOCK, candidatePrice: 25500, rowIndexes: [0] }),
        pendiente({ estacionId: HUDSON, candidatePrice: 25500, rowIndexes: [1] }),
        pendiente({ estacionId: BERNAL, candidatePrice: 18000, rowIndexes: [2], categoria: 7, status: 'NO_PICO' }),
      ],
      [
        catalogo(DOCK, 'DOCK SUD', ['IDA', 'VUELTA']),
        catalogo(HUDSON, 'HUDSON', ['IDA', 'VUELTA']),
        catalogo(BERNAL, 'BERNAL', ['IDA', 'VUELTA']),
      ],
    )[0];
    const seleccion = heuristicaSeleccionInicial(grupo, [
      candidato({ estacionId: DOCK, precioDirecto: 25500, candidatePrice: 25500, rowIndexes: [0] }),
      candidato({ estacionId: HUDSON, precioDirecto: 25500, candidatePrice: 25500, rowIndexes: [1] }),
      candidato({ estacionId: BERNAL, precioDirecto: 18000, candidatePrice: 18000, rowIndexes: [2] }),
    ]);
    expect(seleccion).toEqual([DOCK, HUDSON]);
    expect(seleccion).not.toContain(BERNAL);
  });

  it('siempre incluye la estación ancla pendiente aunque no haya candidatos', () => {
    const grupo = agruparPendientesPorPeajeYFamilia(
      [pendiente({ estacionId: DOCK })],
      [catalogo(DOCK, 'DOCK SUD', ['IDA', 'VUELTA']), catalogo(HUDSON, 'HUDSON', ['IDA', 'VUELTA'])],
    )[0];
    expect(heuristicaSeleccionInicial(grupo, [])).toEqual([DOCK]);
  });
});

describe('resolverRequiereNormalizacionIva', () => {
  const existentes = [
    { estacionId: DOCK, categoria: 7, status: 'NO_PICO' as TarifaStatusPico, sentido: 'IDA' as TarifaSentido },
  ];

  it('devuelve null cuando la identidad ya existe en esa estación', () => {
    expect(resolverRequiereNormalizacionIva(DOCK, 7, 'NO_PICO', 'IDA', existentes)).toBeNull();
  });

  it('devuelve false cuando hay que crear la identidad en esa estación', () => {
    expect(resolverRequiereNormalizacionIva(HUDSON, 7, 'NO_PICO', 'IDA', existentes)).toBeFalse();
    expect(resolverRequiereNormalizacionIva(DOCK, 7, 'PICO', 'IDA', existentes)).toBeFalse();
  });
});
