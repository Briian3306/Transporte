import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { TarifaSentido, TarifaStatusPico } from '../../models/tarifario.contracts';
import {
  agruparPendientesPorPeajeYFamilia,
  applySharedSlotSelection,
  assignSafeAutocomplete,
  buildDetectedStations,
  checkboxOptionsForSlot,
  deriveEditorGroups,
  familySentidos,
  heuristicaSeleccionInicial,
  interseccionSentidos,
  maxSharedGroupCount,
  preserveIdentityDrafts,
  resolverRequiereNormalizacionIva,
  plantillaSugiereNormalizacionIva,
  resizeSharedSlots,
  sentidoFamilyOf,
  sharedSlotsToTarifarioGroups,
  stationTraceViewModel,
  STATION_SESSION_PALETTE,
  uniqueHighestCategoryIdentity,
  uniqueIdentityForCategory,
  uniqueHistoryIdentity,
  resolveCategoriaEfectiva,
  confirmNewVigenciaPreflight,
  hasDistinctPriceClusters,
  mergeLeftoversByIdentity,
  type AutocompleteCandidate,
  type DetectedStation,
  type EstacionCatalogoRefresco,
  type SharedTariffGroupState,
  type StationSessionColor,
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
    categoriaProveedor: partial.categoriaProveedor ?? partial.categoria ?? 7,
    categoriaCalculada: partial.categoriaCalculada ?? null,
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
    categoriaProveedor: partial.categoriaProveedor ?? partial.categoria ?? 7,
    categoriaCalculada: partial.categoriaCalculada ?? null,
    statusSolicitado: partial.statusSolicitado ?? 'NO_PICO',
    sentidoSolicitado: partial.sentidoSolicitado ?? null,
    directionConfidence: partial.directionConfidence ?? 'UNRESOLVED',
    unresolvedReason: partial.unresolvedReason ?? 'MISSING_MAPPING',
    sourceStationCode: partial.sourceStationCode ?? null,
    sourceLane: partial.sourceLane ?? null,
    fechaPasada: partial.fechaPasada ?? null,
    estacionNombre: partial.estacionNombre ?? null,
    peajeId: partial.peajeId ?? null,
    peajeNombre: partial.peajeNombre ?? null,
    candidatePrice: partial.candidatePrice ?? 25500,
    precioDirecto: partial.precioDirecto ?? partial.candidatePrice ?? 25500,
    cases: (partial.rowIndexes ?? [0]).length,
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

  it('hereda el flag IVA de identidades compatibles de la misma estación', () => {
    const catalogo = [
      { estacionId: DOCK, categoria: 2, status: 'NO_PICO' as TarifaStatusPico, sentido: 'IDA' as TarifaSentido, requiereNormalizacionIva: true },
    ];
    expect(resolverRequiereNormalizacionIva(DOCK, 7, 'NO_PICO', 'IDA', catalogo)).toBeTrue();
  });

  it('usa la plantilla como fallback y permite override manual', () => {
    expect(resolverRequiereNormalizacionIva(HUDSON, 7, 'NO_PICO', 'IDA', [], { plantillaSugiere: true })).toBeTrue();
    expect(
      resolverRequiereNormalizacionIva(HUDSON, 7, 'NO_PICO', 'IDA', [], { plantillaSugiere: true, override: false }),
    ).toBeFalse();
  });
});

describe('plantillaSugiereNormalizacionIva', () => {
  it('detecta ELIMINAR_IVA y OPERAR_NUMERO /1.21 o /1.31', () => {
    expect(
      plantillaSugiereNormalizacionIva([
        {
          id: 'cfg-iva',
          plantilla_id: 'plt',
          nombre_columna: 'IMPORTE_NETO',
          orden: 1,
          tipo: 'transformacion',
          configuracion: { algoritmo_codigo: 'ELIMINAR_IVA' },
          obligatoria: true,
        },
      ]),
    ).toBeTrue();
    expect(
      plantillaSugiereNormalizacionIva([
        {
          id: 'cfg-ausa',
          plantilla_id: 'plt',
          nombre_columna: 'PRECIO',
          orden: 1,
          tipo: 'transformacion',
          configuracion: { algoritmo_codigo: 'OPERAR_NUMERO', operacion: 'dividir', valor: 1.31 },
          obligatoria: true,
        },
      ]),
    ).toBeTrue();
    expect(plantillaSugiereNormalizacionIva([])).toBeFalse();
  });
});

const PALETTE = ['#6D28D9', '#15803D', '#0369A1', '#B45309', '#BE123C', '#0F766E'] as const;

function groupIds(state: SharedTariffGroupState): string[][] {
  return deriveEditorGroups(state).map((group) => [...group.stationIds]);
}

function directionalStation(
  estacionId: string,
  nombre: string,
  color: StationSessionColor = PALETTE[0],
): DetectedStation {
  return {
    estacionId,
    estacionNombre: nombre,
    peajeId: PEAJE,
    peajeNombre: 'AUBASA',
    color,
    family: 'DIRECCIONAL',
  };
}

describe('buildDetectedStations', () => {
  const aubasa: EstacionCatalogoRefresco[] = [
    catalogo(DOCK, 'DOCK SUD', ['IDA', 'VUELTA']),
    catalogo(HUDSON, 'HUDSON', ['IDA', 'VUELTA']),
    catalogo(GUTIERREZ, 'GUTIERREZ', ['AMBAS']),
    catalogo(BERNAL, 'BERNAL', ['IDA', 'VUELTA']),
  ];

  it('conserva el orden de primera aparición en la importación y no agrega estaciones solo de catálogo', () => {
    const detected = buildDetectedStations(
      [
        pendiente({ estacionId: HUDSON, rowIndexes: [0] }),
        pendiente({ estacionId: DOCK, rowIndexes: [1] }),
        pendiente({ estacionId: HUDSON, rowIndexes: [2] }),
      ],
      aubasa,
    );
    expect(detected.map((s) => s.estacionId)).toEqual([HUDSON, DOCK]);
    expect(detected.map((s) => s.estacionNombre)).toEqual(['HUDSON', 'DOCK SUD']);
    expect(detected.some((s) => s.estacionId === BERNAL)).toBeFalse();
  });

  it('asigna colores de sesión en el orden detectado y siempre los empareja con el nombre', () => {
    const detected = buildDetectedStations(
      [
        pendiente({ estacionId: DOCK }),
        pendiente({ estacionId: HUDSON, rowIndexes: [1] }),
        pendiente({ estacionId: GUTIERREZ, rowIndexes: [2] }),
      ],
      aubasa,
    );
    expect(detected.map((s) => s.color)).toEqual([PALETTE[0], PALETTE[1], PALETTE[2]]);
    for (const station of detected) {
      const chip = stationTraceViewModel(station);
      expect(chip.color).toBe(station.color);
      expect(chip.estacionNombre).toBe(station.estacionNombre);
      expect(chip.estacionNombre.length).toBeGreaterThan(0);
    }
  });
});

describe('deriveEditorGroups', () => {
  const detectedStations: DetectedStation[] = [
    directionalStation(DOCK, 'DOCK SUD', PALETTE[0]),
    directionalStation(HUDSON, 'HUDSON', PALETTE[1]),
    directionalStation(GUTIERREZ, 'GUTIERREZ', PALETTE[2]),
  ];

  it('tres estaciones detectadas seleccionadas para compartir derivan un solo editor con las tres', () => {
    expect(
      groupIds({
        detectedStations,
        sharedStationIds: [DOCK, HUDSON, GUTIERREZ],
      }),
    ).toEqual([[DOCK, HUDSON, GUTIERREZ]]);
  });

  it('dos seleccionadas y una desmarcada derivan dos editores: el par compartido y un singleton', () => {
    expect(
      groupIds({
        detectedStations,
        sharedStationIds: [DOCK, HUDSON],
      }),
    ).toEqual([[DOCK, HUDSON], [GUTIERREZ]]);
  });

  it('sin estaciones seleccionadas deriva tres editores singleton', () => {
    expect(
      groupIds({
        detectedStations,
        sharedStationIds: [],
      }),
    ).toEqual([[DOCK], [HUDSON], [GUTIERREZ]]);
  });

  it('desmarcar cualquier estación la conserva exactamente una vez en los grupos resultantes', () => {
    for (const deselected of [DOCK, HUDSON, GUTIERREZ]) {
      const sharedStationIds = detectedStations
        .map((s) => s.estacionId)
        .filter((id) => id !== deselected);
      const ids = groupIds({ detectedStations, sharedStationIds }).flat();
      expect(ids.filter((id) => id === deselected).length).toBe(1);
      expect(ids.sort()).toEqual([DOCK, GUTIERREZ, HUDSON]);
    }
  });

  it('cada estación detectada aparece una vez y ninguna estación solo de catálogo entra al reducer', () => {
    const catalogOnly = directionalStation(BERNAL, 'BERNAL', PALETTE[3]);
    const groups = deriveEditorGroups({
      detectedStations,
      sharedStationIds: [DOCK, HUDSON, BERNAL],
    });
    const ids = groups.flatMap((g) => [...g.stationIds]);
    expect(ids).toEqual([DOCK, HUDSON, GUTIERREZ]);
    expect(ids).not.toContain(BERNAL);
    expect(groups.some((g) => g.stations.includes(catalogOnly))).toBeFalse();
  });

  it('el orden de cada grupo sigue la primera aparición en la importación, no el orden del checkbox', () => {
    expect(
      groupIds({
        detectedStations,
        sharedStationIds: [GUTIERREZ, HUDSON, DOCK],
      }),
    ).toEqual([[DOCK, HUDSON, GUTIERREZ]]);
  });

  it('familias de sentido incompatibles no pueden compartir editor', () => {
    const mixed: DetectedStation[] = [
      directionalStation(DOCK, 'DOCK SUD', PALETTE[0]),
      directionalStation(HUDSON, 'HUDSON', PALETTE[1]),
      { ...directionalStation(GUTIERREZ, 'GUTIERREZ', PALETTE[2]), family: 'AMBAS' },
    ];
    expect(
      groupIds({
        detectedStations: mixed,
        sharedStationIds: [DOCK, HUDSON, GUTIERREZ],
      }),
    ).toEqual([[DOCK, HUDSON], [GUTIERREZ]]);
  });
});

describe('explicit TarifarioStationGroup membership', () => {
  it('keeps two manual groups and returns unassigned stations to singleton editors', () => {
    const detectedStations: DetectedStation[] = [
      { estacionId: DOCK, estacionNombre: 'Dock', peajeId: PEAJE, peajeNombre: 'AUBASA', color: STATION_SESSION_PALETTE[0], family: 'AMBAS' },
      { estacionId: HUDSON, estacionNombre: 'Hudson', peajeId: PEAJE, peajeNombre: 'AUBASA', color: STATION_SESSION_PALETTE[1], family: 'AMBAS' },
      { estacionId: GUTIERREZ, estacionNombre: 'Gutiérrez', peajeId: PEAJE, peajeNombre: 'AUBASA', color: STATION_SESSION_PALETTE[2], family: 'AMBAS' },
    ];
    const groups = deriveEditorGroups({
      detectedStations,
      groups: [
        { id: 'g1', stationIds: [DOCK, HUDSON], family: 'AMBAS' },
      ],
    });
    expect(groups.map((group) => group.stationIds)).toEqual([[DOCK, HUDSON], [GUTIERREZ]]);
  });

  it('two exclusive slots of four stations derive two shared editors and no singletons', () => {
    const detectedStations: DetectedStation[] = [
      directionalStation(DOCK, 'DOCK SUD', PALETTE[0]),
      directionalStation(HUDSON, 'HUDSON', PALETTE[1]),
      directionalStation(GUTIERREZ, 'GUTIERREZ', PALETTE[2]),
      directionalStation(BERNAL, 'BERNAL', PALETTE[3]),
    ];
    expect(
      groupIds({
        detectedStations,
        groups: sharedSlotsToTarifarioGroups([[DOCK, HUDSON], [GUTIERREZ, BERNAL]], 'DIRECCIONAL'),
      }),
    ).toEqual([[DOCK, HUDSON], [GUTIERREZ, BERNAL]]);
  });
});

describe('shared tariff group slots', () => {
  it('caps group count at floor(stations / 2), never below 1', () => {
    expect(maxSharedGroupCount(0)).toBe(1);
    expect(maxSharedGroupCount(1)).toBe(1);
    expect(maxSharedGroupCount(2)).toBe(1);
    expect(maxSharedGroupCount(3)).toBe(1);
    expect(maxSharedGroupCount(4)).toBe(2);
    expect(maxSharedGroupCount(5)).toBe(2);
  });

  it('pads empty slots when raising N and drops extra slots when lowering N', () => {
    expect(resizeSharedSlots([[DOCK, HUDSON]], 2)).toEqual([[DOCK, HUDSON], []]);
    expect(resizeSharedSlots([[DOCK, HUDSON], [GUTIERREZ, BERNAL]], 1)).toEqual([[DOCK, HUDSON]]);
  });

  it('keeps station membership exclusive across slots', () => {
    const next = applySharedSlotSelection(
      [[DOCK, HUDSON], [GUTIERREZ]],
      1,
      [GUTIERREZ, HUDSON, BERNAL],
    );
    expect(next).toEqual([[DOCK, HUDSON], [GUTIERREZ, BERNAL]]);
  });

  it('disables stations already used in another slot', () => {
    const stations: DetectedStation[] = [
      directionalStation(DOCK, 'DOCK SUD', PALETTE[0]),
      directionalStation(HUDSON, 'HUDSON', PALETTE[1]),
      directionalStation(GUTIERREZ, 'GUTIERREZ', PALETTE[2]),
    ];
    const options = checkboxOptionsForSlot(stations, [[DOCK, HUDSON], []], 1);
    expect(options.find((option) => option.value === DOCK)?.disabled).toBeTrue();
    expect(options.find((option) => option.value === HUDSON)?.disabled).toBeTrue();
    expect(options.find((option) => option.value === GUTIERREZ)?.disabled).toBeFalsy();
    expect(options.find((option) => option.value === GUTIERREZ)?.label).toBe('GUTIERREZ');
  });

  it('does not convert a slot with fewer than two stations into a shared Tarifario group', () => {
    expect(sharedSlotsToTarifarioGroups([[DOCK], [HUDSON, GUTIERREZ]], 'AMBAS')).toEqual([
      jasmine.objectContaining({ stationIds: [HUDSON, GUTIERREZ], family: 'AMBAS' }),
    ]);
  });
});

describe('preserveIdentityDrafts', () => {
  it('cambiar el agrupamiento no descarta drafts de identidades de estación no afectadas', () => {
    const drafts = {
      [`${DOCK}|7|NO_PICO|IDA`]: '25500',
      [`${HUDSON}|7|NO_PICO|IDA`]: '25500',
      [`${GUTIERREZ}|7|NO_PICO|AMBAS`]: '18000',
    };
    const afterSplit = preserveIdentityDrafts(drafts, [DOCK, HUDSON, GUTIERREZ]);
    expect(afterSplit[`${DOCK}|7|NO_PICO|IDA`]).toBe('25500');
    expect(afterSplit[`${HUDSON}|7|NO_PICO|IDA`]).toBe('25500');
    expect(afterSplit[`${GUTIERREZ}|7|NO_PICO|AMBAS`]).toBe('18000');

    const afterEmptyShare = preserveIdentityDrafts(afterSplit, [DOCK, HUDSON, GUTIERREZ]);
    expect(afterEmptyShare).toEqual(drafts);
  });
});

describe('assignSafeAutocomplete', () => {
  const stations: DetectedStation[] = [
    directionalStation(DOCK, 'DOCK SUD', PALETTE[0]),
    directionalStation(HUDSON, 'HUDSON', PALETTE[1]),
    directionalStation(GUTIERREZ, 'GUTIERREZ', PALETTE[2]),
  ];

  function cand(
    partial: Partial<AutocompleteCandidate> & { id: string; estacionId: string; amount: number },
  ): AutocompleteCandidate {
    const station = stations.find((s) => s.estacionId === partial.estacionId)!;
    return {
      id: partial.id,
      estacionId: partial.estacionId,
      estacionNombre: station.estacionNombre,
      amount: partial.amount,
      categoria: partial.categoria === undefined ? 7 : partial.categoria,
      status: partial.status === undefined ? 'NO_PICO' : partial.status,
      sentido: partial.sentido === undefined ? 'IDA' : partial.sentido,
    };
  }

  it('prellena Nuevo solo cuando un candidato mapea a una celda de identidad', () => {
    const group = deriveEditorGroups({
      detectedStations: [stations[0]],
      sharedStationIds: [],
    })[0];
    const assigned = assignSafeAutocomplete(group, [
      cand({ id: 'dock-7', estacionId: DOCK, amount: 25500 }),
    ]);
    expect(assigned.prefills).toEqual([
      { categoria: 7, status: 'NO_PICO', sentido: 'IDA', amount: 25500 },
    ]);
    expect(assigned.visible[0]).toEqual(
      jasmine.objectContaining({
        candidateId: 'dock-7',
        estacionNombre: 'DOCK SUD',
        color: PALETTE[0],
        amount: 25500,
      }),
    );
  });

  it('en un grupo compartido exige el mismo importe normalizado de cada miembro para prellenar', () => {
    const group = deriveEditorGroups({
      detectedStations: stations.slice(0, 2),
      sharedStationIds: [DOCK, HUDSON],
    })[0];
    const same = assignSafeAutocomplete(group, [
      cand({ id: 'dock-7', estacionId: DOCK, amount: 25500 }),
      cand({ id: 'hudson-7', estacionId: HUDSON, amount: 25500 }),
    ]);
    expect(same.prefills).toEqual([
      { categoria: 7, status: 'NO_PICO', sentido: 'IDA', amount: 25500 },
    ]);

    const distinct = assignSafeAutocomplete(group, [
      cand({ id: 'dock-7', estacionId: DOCK, amount: 25500 }),
      cand({ id: 'hudson-7', estacionId: HUDSON, amount: 18000 }),
    ]);
    expect(distinct.prefills).toEqual([]);
    expect(distinct.visible.map((v) => v.amount)).toEqual([25500, 18000]);
  });

  it('tres precios distintos no coincidentes quedan como tres candidatos y no se pisan en un Nuevo', () => {
    const group = deriveEditorGroups({
      detectedStations: stations,
      sharedStationIds: [DOCK, HUDSON, GUTIERREZ],
    })[0];
    const assigned = assignSafeAutocomplete(group, [
      cand({ id: 'a', estacionId: DOCK, amount: 100, status: null, sentido: null }),
      cand({ id: 'b', estacionId: HUDSON, amount: 200, status: null, sentido: null }),
      cand({ id: 'c', estacionId: GUTIERREZ, amount: 300, status: null, sentido: null }),
    ]);
    expect(assigned.visible.length).toBe(3);
    expect(assigned.visible.map((v) => v.amount)).toEqual([100, 200, 300]);
    expect(assigned.prefills).toEqual([]);
  });

  it('nunca infiere PICO/NO_PICO ni IDA/VUELTA/AMBAS desde el importe', () => {
    const group = deriveEditorGroups({
      detectedStations: [stations[0]],
      sharedStationIds: [],
    })[0];
    const assigned = assignSafeAutocomplete(group, [
      cand({ id: 'unk', estacionId: DOCK, amount: 25500, status: null, sentido: null }),
    ]);
    expect(assigned.prefills).toEqual([]);
    expect(assigned.visible.length).toBe(1);
  });
});

describe('uniqueHighestCategoryIdentity', () => {
  it('no elige una categoría mayor si hay hits en más de una categoría', () => {
    expect(
      uniqueHighestCategoryIdentity([
        { key: 'cat6', categoria: 6, status: 'NO_PICO', sentido: 'AMBAS' },
        { key: 'cat7', categoria: 7, status: 'NO_PICO', sentido: 'AMBAS' },
      ]),
    ).toBeNull();
  });

  it('queda ambiguo si la categoría tiene dos identidades', () => {
    expect(
      uniqueHighestCategoryIdentity([
        { key: 'np', categoria: 7, status: 'NO_PICO', sentido: 'AMBAS' },
        { key: 'pico', categoria: 7, status: 'PICO', sentido: 'AMBAS' },
      ]),
    ).toBeNull();
  });
});

describe('uniqueIdentityForCategory', () => {
  it('filtra a la categoría efectiva y no sube a la máxima', () => {
    const match = uniqueIdentityForCategory(
      [
        { key: 'cat6', categoria: 6, status: 'NO_PICO', sentido: 'AMBAS' },
        { key: 'cat7', categoria: 7, status: 'NO_PICO', sentido: 'AMBAS' },
      ],
      6,
    );
    expect(match?.categoria).toBe(6);
    expect(match?.key).toBe('cat6');
  });
});

describe('resolveCategoriaEfectiva', () => {
  const rows = [
    { estacion_id: 'est-1', categoria: 5, enabled: true },
    { estacion_id: 'est-1', categoria: 2, enabled: true },
    { estacion_id: 'est-2', categoria: 9, enabled: true },
  ];

  it('capea 8 a la máxima 5 de la estación', () => {
    expect(resolveCategoriaEfectiva(8, rows, 'est-1')).toBe(5);
  });

  it('conserva una categoría menor que la máxima', () => {
    expect(resolveCategoriaEfectiva(3, rows, 'est-1')).toBe(3);
  });

  it('devuelve null si el proveedor no informa categoría', () => {
    expect(resolveCategoriaEfectiva(null, rows, 'est-1')).toBeNull();
  });
});

describe('uniqueHistoryIdentity', () => {
  const hit = {
    estacionId: 'est-1',
    importeConsultado: 8464.0075,
    countIdentities: 1,
    matches: [
      { tarifaId: 't6', categoria: 6, status: 'NO_PICO' as const, sentido: 'AMBAS' as const, importe: 8464.0075 },
      { tarifaId: 't7', categoria: 7, status: 'NO_PICO' as const, sentido: 'AMBAS' as const, importe: 8464.0075 },
    ],
    tarifaId: 't7',
    categoria: 7,
    status: 'NO_PICO' as const,
    sentido: 'AMBAS' as const,
    importe: 8464.0075,
    fechaVigenciaInicio: '2026-08-01',
    fechaVigenciaFin: '2026-09-01',
    esActual: false,
    diagnostico: 'CONFIRMADO',
    enabled: true,
  };

  it('sin categoría efectiva queda ambiguo si hay más de una categoría', () => {
    expect(uniqueHistoryIdentity({ ...hit, matches: hit.matches })).toBeNull();
  });

  it('reutiliza solo la categoría efectiva pedida', () => {
    expect(uniqueHistoryIdentity({ ...hit, matches: hit.matches }, 'NO_PICO', 6)).toEqual({
      categoria: 6,
      status: 'NO_PICO',
      sentido: 'AMBAS',
    });
  });

  it('al elegir Pico filtra esa categoría y no crea una identidad gemela', () => {
    const ambiguous = {
      ...hit,
      countIdentities: 2,
      tarifaId: null,
      categoria: null,
      status: null,
      matches: [
        { tarifaId: 't7np', categoria: 7, status: 'NO_PICO' as const, sentido: 'AMBAS' as const, importe: 8464.0075 },
        { tarifaId: 't7p', categoria: 7, status: 'PICO' as const, sentido: 'AMBAS' as const, importe: 8464.0075 },
      ],
    };
    expect(uniqueHistoryIdentity(ambiguous, 'PICO', 7)).toEqual({
      categoria: 7,
      status: 'PICO',
      sentido: 'AMBAS',
    });
  });
});

describe('confirmNewVigenciaPreflight', () => {
  it('omite CONFIRM_NEW cuando el importe ya es el vigente', () => {
    expect(
      confirmNewVigenciaPreflight({
        importe: 8464.0075,
        fechaVigenciaInicio: '2026-09-01',
        catalog: {
          importe: 8464,
          fechaVigenciaInicio: '2026-08-01',
          estacionNombre: 'Gutiérrez',
          categoria: 7,
          status: 'NO_PICO',
        },
      }).kind,
    ).toBe('omit');
  });

  it('no omite CONFIRM_NEW cuando hay que persistir un no-match con el mismo importe', () => {
    expect(
      confirmNewVigenciaPreflight({
        importe: 8464.0075,
        fechaVigenciaInicio: '2026-09-01',
        forcePersist: true,
        catalog: {
          importe: 8464,
          fechaVigenciaInicio: '2026-08-01',
          estacionNombre: 'Gutiérrez',
          categoria: 7,
          status: 'NO_PICO',
        },
      }).kind,
    ).toBe('ok');
  });

  it('bloquea un inicio anterior al vigente si el importe es distinto', () => {
    const result = confirmNewVigenciaPreflight({
      importe: 8464.0075,
      fechaVigenciaInicio: '2026-08-01',
      catalog: {
        importe: 9200,
        fechaVigenciaInicio: '2026-09-01',
        estacionNombre: 'Gutiérrez',
        categoria: 7,
        status: 'NO_PICO',
      },
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('Gutiérrez');
      expect(result.message).toContain('cat. 7');
    }
  });
});

describe('mergeLeftoversByIdentity', () => {
  it('une importes de la misma identidad dentro del 1% y suma casos', () => {
    const result = mergeLeftoversByIdentity([
      { identityKey: 'ruta20|6|NO_PICO', amount: 6961.8, cases: 3, id: 'a' },
      { identityKey: 'ruta20|6|NO_PICO', amount: 6961.8025, cases: 5, id: 'b' },
      { identityKey: 'pilar|6|NO_PICO', amount: 6961.8, cases: 2, id: 'c' },
    ]);
    expect(result.conflict).toBeNull();
    expect(result.merged.length).toBe(2);
    const ruta20 = result.merged.find((item) => item.identityKey === 'ruta20|6|NO_PICO');
    expect(ruta20?.cases).toBe(8);
    expect(ruta20?.id).toBe('b');
    expect(ruta20?.amount).toBe(6961.8025);
  });

  it('conserva importes distintos de la misma identidad como leftovers separados', () => {
    const result = mergeLeftoversByIdentity([
      { identityKey: 'arroyo|6|NO_PICO', amount: 6772.21, cases: 1, id: 'a', fechaPasada: '2026-08-03' },
      { identityKey: 'arroyo|6|NO_PICO', amount: 6961.8, cases: 1, id: 'b', fechaPasada: '2026-08-07' },
    ]);
    expect(result.conflict).toBeNull();
    expect(result.merged.map((item) => item.amount)).toEqual([6772.21, 6961.8]);
    expect(result.merged.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('hasDistinctPriceClusters', () => {
  it('trata 6961.8 y 6961.8025 como el mismo importe', () => {
    expect(hasDistinctPriceClusters([6961.8, 6961.8025])).toBeFalse();
  });

  it('detecta 6772.21 vs 6961.8 como conflicto', () => {
    expect(hasDistinctPriceClusters([6772.21, 6961.8])).toBeTrue();
  });
});

