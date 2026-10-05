import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  PEAJES_TARIFARIO_SERVICE,
  TarifaRefreshDecision,
  TarifaRefrescoGuardada,
  TarifarioCurrentRow,
  TarifarioHistorialImporteHit,
} from '../../models/tarifario.contracts';
import { TARIFA_REFRESH_SERVICE } from '../../models/tarifa-refresh.contracts';
import {
  ESTACION_BERNAL,
  ESTACION_DOCK_SUD,
  ESTACION_GUTIERREZ,
  ESTACION_HUDSON,
  ESTACION_INCOMPLETA,
  ESTACION_SAMBOROMBON,
  PEAJE_AUBASA,
  TarifarioMockService,
} from '../../tarifario/mocks/tarifario.mock';
import { TarifaRefreshMockService } from '../mocks/tarifa-refresh.mock';
import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { TarifaRefreshDialogComponent } from './tarifa-refresh-dialog.component';
import { STATION_SESSION_PALETTE, withinTarifaPriceTolerance } from './tarifa-refresh-dialog.helpers';

function pendiente(
  estacionId: string,
  opts: Partial<ResultadoDetectarRefresco> = {},
): ResultadoDetectarRefresco {
  return {
    id: `${estacionId}-7`,
    codigo: 'NEW_TARIFF',
    peajeId: PEAJE_AUBASA,
    estacionId,
    categoria: 2,
    categoriaProveedor: 2,
    categoriaCalculada: null,
    status: 'NO_PICO',
    sentidoSolicitado: null,
    sentidoAplicado: null,
    importeActual: null,
    tarifaId: null,
    tarifaImporteId: null,
    requiereNormalizacionIva: false,
    rowIndexes: opts.rowIndexes ?? [0],
    candidatePrice: opts.candidatePrice ?? 7000,
    ...opts,
  };
}

function candidato(
  estacionId: string,
  opts: Partial<CandidatoRefrescoTarifa> = {},
): CandidatoRefrescoTarifa {
  return {
    id: `${estacionId}-7`,
    estacionId,
    categoria: 2,
    categoriaProveedor: 2,
    categoriaCalculada: null,
    statusSolicitado: 'NO_PICO',
    sentidoSolicitado: null,
    directionConfidence: 'UNRESOLVED',
    unresolvedReason: 'MISSING_MAPPING',
    sourceStationCode: null,
    sourceLane: null,
    fechaPasada: null,
    estacionNombre: null,
    peajeId: null,
    peajeNombre: null,
    candidatePrice: opts.candidatePrice ?? 7000,
    precioDirecto: opts.precioDirecto ?? opts.candidatePrice ?? 7000,
    cases: (opts.rowIndexes ?? [0]).length,
    filaRepresentativa: {},
    rowIndexes: opts.rowIndexes ?? [0],
    ...opts,
  };
}

function catalogRow(
  estacionId: string,
  categoria: number,
  status: 'PICO' | 'NO_PICO',
  sentido: 'IDA' | 'VUELTA' | 'AMBAS',
): TarifarioCurrentRow {
  return {
    tarifa_id: `tarifa-${estacionId}-${categoria}-${status}-${sentido}`,
    peaje_id: PEAJE_AUBASA,
    peaje_nombre: 'AUBASA',
    estacion_id: estacionId,
    estacion_nombre: estacionId.toUpperCase(),
    categoria,
    status,
    sentido,
    importe: 5000 + categoria,
    fecha_actualizacion: '2026-09-10T00:00:00.000Z',
    current_tarifa_importe_id: `importe-${estacionId}-${categoria}-${status}-${sentido}`,
  };
}

describe('TarifaRefreshDialogComponent', () => {
  let fixture: ComponentFixture<TarifaRefreshDialogComponent>;
  let component: TarifaRefreshDialogComponent;

  async function open(
    resultados: ResultadoDetectarRefresco[],
    candidatos: CandidatoRefrescoTarifa[],
    catalogRows?: TarifarioCurrentRow[],
    historyHits: TarifarioHistorialImporteHit[] = [],
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TarifaRefreshDialogComponent],
      providers: [
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        { provide: TARIFA_REFRESH_SERVICE, useClass: TarifaRefreshMockService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaRefreshDialogComponent);
    component = fixture.componentInstance;
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE) as TarifarioMockService;
    if (catalogRows) {
      spyOn(tarifario, 'listar').and.returnValue(of({ rows: catalogRows, total: catalogRows.length, page: 1, pageSize: 500 }));
    }
    spyOn(tarifario, 'buscarHistorialImportes').and.returnValue(of(historyHits));
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('resultados', resultados);
    fixture.componentRef.setInput('candidatos', candidatos);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('revalidates the six reported prices into IDA without writing or losing drafts', async () => {
    const stationA = '3f32d96b-e51f-4e5e-a473-be7bcc3de5e9';
    const stationB = '67486ca3-6e88-49a8-b628-7f41e946da5a';
    const cases = [
      { station: stationA, amount: 14370.19, category: 7, status: 'NO_PICO' as const },
      { station: stationA, amount: 28740.39, category: 7, status: 'NO_PICO' as const },
      { station: stationA, amount: 35925.48, category: 7, status: 'PICO' as const },
      { station: stationB, amount: 14370.19, category: 7, status: 'NO_PICO' as const },
      { station: stationB, amount: 11975.15, category: 6, status: 'NO_PICO' as const },
      { station: stationB, amount: 14968.96, category: 6, status: 'PICO' as const },
    ];
    const results = cases.map((c, i) => pendiente(c.station, {
      id: `reported-${i}`, categoria: c.category, categoriaProveedor: c.category,
      status: null, candidatePrice: c.amount, rowIndexes: [i], codigo: 'AMBIGUOUS_TARIFF_MATCH',
    }));
    const candidates = cases.map((c, i) => candidato(c.station, {
      id: `reported-${i}`, categoria: c.category, categoriaProveedor: c.category,
      statusSolicitado: null, candidatePrice: c.amount, rowIndexes: [i],
    }));
    const catalog = cases.filter((_, i) => i !== 0).flatMap(c =>
      (['VUELTA', 'IDA'] as const).map(d => ({ ...catalogRow(c.station, c.category, c.status, d), importe: c.amount })),
    );
    const history: TarifarioHistorialImporteHit[] = cases.map(c => ({
      estacionId: c.station, importeConsultado: c.amount, countIdentities: 2,
      tarifaId: null, categoria: null, status: null, sentido: null, importe: null,
      fechaVigenciaInicio: null, fechaVigenciaFin: null, esActual: null, diagnostico: null, enabled: null,
      matches: (['VUELTA', 'IDA'] as const).map(d => ({
        tarifaId: `history-${c.station}-${c.category}-${c.status}-${d}`,
        categoria: c.category, status: c.status, sentido: d, importe: c.amount,
      })),
    }));
    await open(results, candidates, catalog, history);
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE);
    const save = spyOn(refresh, 'guardar').and.callThrough();
    const stateChange = spyOn(tarifario, 'actualizarEstadoCategorias').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors.find(e => e.stationIds.includes(stationA))!.tablas.find(t => t.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 7, status: 'PICO', value: '35925.48' });
    await component.revalidarPrecios();
    for (const [i, c] of cases.entries()) {
      expect(grupo.resolvedCandidates.get(`reported-${i}`)).toEqual({
        categoria: c.category, status: c.status, sentido: 'IDA',
      });
      expect(grupo.editors.some(e => e.tablas.some(t => t.sentido === 'IDA' &&
        t.detected[`${c.category}:${c.status}`]?.some(hit => hit.candidateId === `reported-${i}`)))).toBeTrue();
    }
    expect(component.candidatesFor(grupo)).toEqual([]);
    const rebuilt = grupo.editors.find(e => e.stationIds.includes(stationA))!.tablas.find(t => t.sentido === 'IDA')!;
    expect(rebuilt.drafts[7].pico).toBe('35925.48');
    expect(save).not.toHaveBeenCalled();
    expect(stateChange).not.toHaveBeenCalled();
  });

  it('requests VUELTA history when the candidate has an explicit direction', async () => {
    await open(
      [pendiente(ESTACION_HUDSON, { sentidoSolicitado: 'VUELTA', candidatePrice: 14370.19 })],
      [candidato(ESTACION_HUDSON, { sentidoSolicitado: 'VUELTA', directionConfidence: 'EXPLICIT', candidatePrice: 14370.19 })],
      [catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'IDA'), catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'VUELTA')],
    );
    const lookup = TestBed.inject(PEAJES_TARIFARIO_SERVICE).buscarHistorialImportes as jasmine.Spy;
    expect(lookup.calls.mostRecent().args[0]).toEqual([
      jasmine.objectContaining({ estacionId: ESTACION_HUDSON, importe: 14370.19, sentido: 'VUELTA' }),
    ]);
  });

  it('keeps explicit VUELTA when choosing a status from mixed-direction history', async () => {
    const catalog = (['IDA', 'VUELTA'] as const).flatMap(d =>
      (['NO_PICO', 'PICO'] as const).map(s => ({ ...catalogRow(ESTACION_HUDSON, 7, s, d), importe: 14370.19 })),
    );
    await open(
      [pendiente(ESTACION_HUDSON, { id: 'vuelta-review', categoria: 7, categoriaProveedor: 7,
        sentidoSolicitado: 'VUELTA', status: null, candidatePrice: 14370.19 })],
      [candidato(ESTACION_HUDSON, { id: 'vuelta-review', categoria: 7, categoriaProveedor: 7,
        sentidoSolicitado: 'VUELTA', directionConfidence: 'EXPLICIT', statusSolicitado: null, candidatePrice: 14370.19 })],
      catalog,
      [{ estacionId: ESTACION_HUDSON, importeConsultado: 14370.19, countIdentities: 4,
        tarifaId: null, categoria: null, status: null, sentido: null, importe: null,
        fechaVigenciaInicio: null, fechaVigenciaFin: null, esActual: null, diagnostico: null, enabled: null,
        matches: catalog.map(row => ({ tarifaId: row.tarifa_id, categoria: row.categoria,
          status: row.status, sentido: row.sentido, importe: row.importe! })),
      }],
    );
    const grupo = component.grupos[0];
    component.onReviewStatusChange(grupo, { candidateId: 'vuelta-review', status: 'PICO' });
    expect(grupo.resolvedCandidates.get('vuelta-review')).toEqual({ categoria: 7, status: 'PICO', sentido: 'VUELTA' });
  });

  it('lista las estaciones del peaje con la misma familia y premarca las que coinciden en precio', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Estaciones con la misma tarifa');
    expect(root.querySelector('app-checkbox-multi-select')).toBeTruthy();
    const ids = component.grupos[0].opciones.map((o) => o.estacionId);
    expect(ids).toContain(ESTACION_DOCK_SUD);
    expect(ids).toContain(ESTACION_HUDSON);
    expect(ids).toContain(ESTACION_SAMBOROMBON);
    expect(ids).not.toContain(ESTACION_BERNAL);
    expect(component.grupos[0].sharedSlots[0]).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    expect(component.grupos[0].sharedSlots[0]).not.toContain(ESTACION_SAMBOROMBON);
  });

  it('shows compatible catalog stations for grouping when only one station was detected in the import', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
      [
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_DOCK_SUD, 2, 'NO_PICO', 'AMBAS'),
      ],
    );

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__stations-note')).toBeNull();
    expect(root.querySelector('app-checkbox-multi-select')).toBeTruthy();
    expect(component.grupos[0].opciones.map((option) => option.estacionId)).toEqual([
      ESTACION_HUDSON,
      ESTACION_DOCK_SUD,
    ]);

    await component.onSeleccionChange(component.grupos[0], 0, [ESTACION_HUDSON, ESTACION_DOCK_SUD]);
    expect(component.grupos[0].editors[0].stationIds).toEqual([ESTACION_HUDSON, ESTACION_DOCK_SUD]);
  });

  it('explains why station grouping is unavailable when the review has only one station', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
      [catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'AMBAS')],
    );

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__stations-note')).toBeTruthy();
    expect(root.querySelector('app-checkbox-multi-select')).toBeNull();
    expect(root.querySelector('input[aria-label="Grupos de tarifa"]')).toBeNull();
  });
  it('al abrir selecciona la categoría y status del único precio coincidente y conserva el precio sin match para revisión', async () => {
    const precio = 27153.49;
    const catalogRows = [3, 4, 5, 6].flatMap((categoria) =>
      (['NO_PICO', 'PICO'] as const).map((status) => {
        const row = catalogRow(ESTACION_HUDSON, categoria, status, 'AMBAS');
        return {
          ...row,
          importe: status === 'NO_PICO' && categoria === 5 ? precio : 1000 + categoria,
        };
      }),
    );
    const resultados = [
      pendiente(ESTACION_HUDSON, {
        id: 'provider-cat-wrong', categoria: 7, categoriaProveedor: 7,
        status: null, sentidoSolicitado: 'AMBAS', candidatePrice: precio, rowIndexes: [0],
      }),
      pendiente(ESTACION_HUDSON, {
        id: 'price-without-tariff', categoria: 7, categoriaProveedor: 7,
        status: null, sentidoSolicitado: 'AMBAS', candidatePrice: 5430.70, rowIndexes: [1],
      }),
    ];
    const candidatos = [
      candidato(ESTACION_HUDSON, {
        id: 'provider-cat-wrong', categoria: 7, categoriaProveedor: 7,
        statusSolicitado: null, sentidoSolicitado: 'AMBAS', directionConfidence: 'EXPLICIT',
        candidatePrice: precio, precioDirecto: precio, rowIndexes: [0],
      }),
      candidato(ESTACION_HUDSON, {
        id: 'price-without-tariff', categoria: 7, categoriaProveedor: 7,
        statusSolicitado: null, sentidoSolicitado: 'AMBAS', directionConfidence: 'EXPLICIT',
        candidatePrice: 5430.70, precioDirecto: 5430.70, rowIndexes: [1],
      }),
    ];

    await open(resultados, candidatos, catalogRows);

    const grupo = component.grupos[0];
    expect(component.candidatesFor(grupo).map((item) => item.candidateId)).toEqual(['price-without-tariff']);
    const tabla = grupo.editors[0].tablas[0];
    expect(tabla.detected['5:NO_PICO'].map((item) => item.candidateId)).toContain('provider-cat-wrong');
  });

  it('muestra IDA y VUELTA juntas, sin botones para crear o cambiar de sentido', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-tarifario-editor-board').length).toBe(2);
    expect(root.textContent).toContain('IDA');
    expect(root.textContent).toContain('VUELTA');
    expect(root.querySelectorAll('.at__seg-btn').length).toBe(0);
    expect(root.textContent).toContain('IDA y VUELTA');
  });

  it('muestra una sola tabla cuando la familia es AMBAS', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { candidatePrice: 5000 })],
      [candidato(ESTACION_GUTIERREZ, { precioDirecto: 5000, candidatePrice: 5000 })],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-tarifario-editor-board').length).toBe(1);
    expect(root.textContent).toContain('AMBAS');
    expect(root.querySelectorAll('.trd__sentido-title').length).toBe(0);
    expect(root.querySelectorAll('.at__seg-btn').length).toBe(0);
  });

  it('muestra IDA y VUELTA aunque el catálogo solo tenga IDA', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
      [
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'PICO', 'IDA'),
      ],
    );
    const grupo = component.grupos[0];
    expect(grupo.family).toBe('DIRECCIONAL');
    expect(grupo.editors[0].tablas.map((tabla) => tabla.sentido)).toEqual(['IDA', 'VUELTA']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-tarifario-editor-board').length).toBe(2);
  });

  it('un grupo mixto IDA+VUELTA con una estación solo IDA sigue mostrando ambas tablas', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, { rowIndexes: [0] }),
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [1] }),
      ],
      [
        candidato(ESTACION_HUDSON, { rowIndexes: [0] }),
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [1] }),
      ],
      [
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'VUELTA'),
        catalogRow(ESTACION_HUDSON, 2, 'PICO', 'VUELTA'),
        catalogRow(ESTACION_DOCK_SUD, 2, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_DOCK_SUD, 2, 'PICO', 'IDA'),
      ],
    );
    const grupo = component.grupos[0];
    await component.onSeleccionChange(grupo, 0, [ESTACION_HUDSON, ESTACION_DOCK_SUD]);
    fixture.detectChanges();
    const shared = grupo.editors.find((editor) => editor.stationIds.length === 2);
    expect(shared?.tablas.map((tabla) => tabla.sentido)).toEqual(['IDA', 'VUELTA']);
  });

  it('abre todos los acordeones y cierra solo el que se vuelve a pulsar', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 8100 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 9000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000, candidatePrice: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 8100, candidatePrice: 8100 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 9000, candidatePrice: 9000 }),
      ],
    );
    const grupo = component.grupos[0];
    await component.onSeleccionChange(grupo, 0, []);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const triggers = [...root.querySelectorAll<HTMLButtonElement>('.app-acc-panel__trigger')];
    expect(triggers.length).toBe(grupo.editors.length);
    expect(component.expandedKeysFor(grupo)).toEqual(grupo.editors.map((editor) => editor.key));
    expect(triggers.every((trigger) => trigger.getAttribute('aria-expanded') === 'true')).toBeTrue();
    expect(triggers[0].querySelector('.trd__swatch')).not.toBeNull();
    expect(triggers[0].textContent).toContain(grupo.editors[0].stations[0].estacionNombre);
    const swatch = triggers[0].querySelector<HTMLElement>('.trd__trace');
    expect(swatch?.style.getPropertyValue('--trd-trace')).toBe(grupo.editors[0].stations[0].color);

    triggers[0].click();
    fixture.detectChanges();
    expect(triggers[0].getAttribute('aria-expanded')).toBe('false');
    expect(triggers[1].getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelectorAll('.app-acc-panel__body[hidden]').length).toBe(1);
    expect(component.expandedKeysFor(grupo)).not.toContain(grupo.editors[0].key);

    triggers[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    expect(triggers[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('Tab desde el último Nuevo de IDA entra al primer Nuevo de VUELTA', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
    );
    const root = fixture.nativeElement as HTMLElement;
    const panel = [...root.querySelectorAll('app-accordion-panel')].find((item) =>
      item.querySelector('.trd__acc-stations')?.textContent?.includes('HUDSON'),
    ) as HTMLElement;
    const boards = [...panel.querySelectorAll('app-tarifario-editor-board')];
    expect(boards.length).toBe(2);
    const nuevoInputs = (board: Element) =>
      [...board.querySelectorAll<HTMLInputElement>('.tf__nuevo .tf__input')].filter((input) => !input.disabled);
    const idaInputs = nuevoInputs(boards[0]);
    const vueltaInputs = nuevoInputs(boards[1]);
    const lastIda = idaInputs[idaInputs.length - 1];
    lastIda.focus();
    lastIda.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(vueltaInputs[0]);

    vueltaInputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, shiftKey: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(lastIda);
  });

  it('places Cancelar on the left and groups the primary actions on the right', async () => {
    await open([pendiente(ESTACION_HUDSON)], [candidato(ESTACION_HUDSON)]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__actions .trd__btn--ghost')?.textContent?.trim()).toBe('Cancelar');
    const primary = root.querySelector('.trd__actions-primary') as HTMLElement;
    expect(primary.textContent).toContain('Revalidar precios');
    expect(primary.textContent).toContain('Guardar cambios');
    expect(primary.textContent).not.toContain('Cancelar');
  });

  it('conserva los importes tipeados al sumar una estación', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    await component.onSeleccionChange(grupo, 0, [...grupo.sharedSlots[0], ESTACION_SAMBOROMBON]);
    fixture.detectChanges();
    expect(grupo.tablas[0].drafts[2].no_pico).toBe('25500');
  });

  it('un importe compartido Dock Sud + Hudson guarda dos decisiones con ids independientes', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, {
          rowIndexes: [0, 1, 2],
          candidatePrice: 25500,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          rowIndexes: [3],
          candidatePrice: 25500,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, {
          rowIndexes: [0, 1, 2],
          candidatePrice: 25500,
          precioDirecto: 25500,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_HUDSON, {
          rowIndexes: [3],
          candidatePrice: 25500,
          precioDirecto: 25500,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    expect(grupo.sharedSlots[0]).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);

    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    const current = tabla.currentStations['2:NO_PICO'] ?? [];
    expect(new Set(current.map((station) => station.estacionId))).toEqual(
      new Set([ESTACION_DOCK_SUD, ESTACION_HUDSON]),
    );
    expect(tabla.rows.find((row) => row.categoria === 2)?.no_pico.tarifa_id).toBeTruthy();
    expect(tabla.rows.find((row) => row.categoria === 2)?.no_pico.current_tarifa_importe_id).toBeTruthy();

    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });

    const emitted: TarifaRefrescoGuardada[][] = [];
    component.saved.subscribe((rows) => emitted.push(rows));
    await component.guardar();

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    expect(payload.length).toBe(2);
    expect(payload.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
    expect(payload.every((item) => item.importe === 25500)).toBeTrue();
    expect(payload.every((item) => item.status === 'NO_PICO')).toBeTrue();
    expect(payload.every((item) => item.sentido === 'IDA')).toBeTrue();
    expect(payload.every((item) => item.fechaVigenciaInicio === '2026-03-10')).toBeTrue();
    expect(payload.every((item) => item.peajeId === PEAJE_AUBASA)).toBeTrue();
    expect(payload.map((item) => item.estacionId).sort()).toEqual(
      [ESTACION_DOCK_SUD, ESTACION_HUDSON].sort(),
    );
    expect(payload.every((item) => !('tarifa_id' in item) && !('tarifaId' in item))).toBeTrue();
    expect(payload.every((item) => !('current_tarifa_importe_id' in item))).toBeTrue();
    expect(payload.every((item) => !('tarifa_importe_id' in item))).toBeTrue();
    const byStation = new Map(payload.map((item) => [item.estacionId, item]));
    expect(byStation.get(ESTACION_DOCK_SUD)?.cases).toBe(3);
    expect(byStation.get(ESTACION_HUDSON)?.cases).toBe(1);
    expect(byStation.get(ESTACION_DOCK_SUD)?.candidateId).not.toBe(
      byStation.get(ESTACION_HUDSON)?.candidateId,
    );

    const saved = emitted[0];
    expect(saved.length).toBe(2);
    expect(saved[0].tarifa_id).not.toBe(saved[1].tarifa_id);
    expect(saved[0].tarifa_importe_id).not.toBe(saved[1].tarifa_importe_id);
    expect(new Set(saved.map((row) => row.estacion_id))).toEqual(
      new Set([ESTACION_DOCK_SUD, ESTACION_HUDSON]),
    );
  });

  it('marca requiereNormalizacionIva=false cuando una estación no tiene esa identidad', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          categoria: 7,
          categoriaProveedor: 7,
          candidatePrice: 25500,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          categoria: 7,
          categoriaProveedor: 7,
          candidatePrice: 25500,
          precioDirecto: 25500,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    component.onDraft(grupo, grupo.tablas[0], { categoria: 7, status: 'NO_PICO', value: '25500' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    const cambios = spy.calls.mostRecent().args[0];
    expect(cambios.length).toBeGreaterThan(0);
    expect(cambios.every((c) => c.requiereNormalizacionIva === false)).toBeTrue();
  });

  it('arma opciones solo con estaciones importadas, colores de sesión y aviso de editores independientes', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const grupo = component.grupos[0];
    expect(grupo.opciones.map((o) => o.estacionId)).toEqual([
      ESTACION_DOCK_SUD,
      ESTACION_HUDSON,
      ESTACION_SAMBOROMBON,
    ]);
    expect(grupo.opciones.map((o) => o.estacionId)).not.toContain(ESTACION_INCOMPLETA);
    expect(grupo.opciones.map((o) => o.estacionId)).not.toContain(ESTACION_BERNAL);
    const options = component.checkboxOptions(grupo, 0);
    expect(options[0].style?.badgeColor).toBe(STATION_SESSION_PALETTE[0]);
    expect(options[0].style?.iconColor).toBe(STATION_SESSION_PALETTE[0]);
    expect(options[1].style?.badgeColor).toBe(STATION_SESSION_PALETTE[1]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Las estaciones desmarcadas reciben un editor independiente');
  });

  it('reconstruye editores al desmarcar y deja tres singletons si la selección compartida queda vacía', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const grupo = component.grupos[0];
    await component.onSeleccionChange(grupo, 0, [ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(grupo.editors.map((editor) => [...editor.stationIds])).toEqual([
      [ESTACION_DOCK_SUD, ESTACION_HUDSON],
      [ESTACION_SAMBOROMBON],
    ]);

    await component.onSeleccionChange(grupo, 0, []);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(grupo.sharedSlots[0]).toEqual([]);
    expect(grupo.editors.map((editor) => [...editor.stationIds])).toEqual([
      [ESTACION_DOCK_SUD],
      [ESTACION_HUDSON],
      [ESTACION_SAMBOROMBON],
    ]);
    expect(fixture.nativeElement.querySelectorAll('app-tarifario-editor-board').length).toBe(6);
  });

  it('preselecciona el sentido explícito o AMBAS y pide elección solo si queda ambiguo', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          sentidoAplicado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    expect(component.grupos[0].editors[0].sentidoSeleccionado).toBe('IDA');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-search-select')).toBeNull();

    await open(
      [pendiente(ESTACION_GUTIERREZ, { candidatePrice: 5000 })],
      [candidato(ESTACION_GUTIERREZ, { precioDirecto: 5000, candidatePrice: 5000 })],
    );
    expect(component.grupos[0].editors[0].sentidoSeleccionado).toBe('AMBAS');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-search-select')).toBeNull();

    await open(
      [
        pendiente(ESTACION_HUDSON, {
          codigo: 'DIRECTION_REQUIRED',
          sentidoSolicitado: null,
          sentidoAplicado: null,
          directionConfidence: 'UNRESOLVED',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: null,
          directionConfidence: 'UNRESOLVED',
          unresolvedReason: 'MISSING_MAPPING',
        }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(component.grupos[0].editors[0].sentidoSeleccionado).toBeNull();
    expect(root.querySelector('app-search-select')).toBeTruthy();
    expect(component.sentidoOptions.map((o) => o.id)).toEqual(['IDA', 'VUELTA', 'AMBAS']);
  });

  it('lista candidatos con rastro, categorías, importe, casos, vigencia y motivo', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          codigo: 'AMBIGUOUS_TARIFF_MATCH',
          categoria: 3,
          categoriaProveedor: 3,
          categoriaCalculada: null,
          candidatePrice: 5300,
          fechaPasada: '2026-03-10',
          fechaVigenciaInicio: '2026-01-01',
          possibleMatches: [
            {
              tarifaId: 't-2',
              tarifaImporteId: 'ti-2',
              categoria: 2,
              status: 'PICO',
              sentido: 'IDA',
              importe: 5300,
              diagnostico: 'CONFIRMADO',
              fechaVigenciaInicio: '2026-01-01',
              fechaVigenciaFin: null,
              esActual: true,
              errorRelativo: 0,
            },
            {
              tarifaId: 't-4',
              tarifaImporteId: 'ti-4',
              categoria: 4,
              status: 'PICO',
              sentido: 'IDA',
              importe: 5300,
              diagnostico: 'CONFIRMADO',
              fechaVigenciaInicio: '2026-01-01',
              fechaVigenciaFin: null,
              esActual: true,
              errorRelativo: 0,
            },
          ],
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          categoria: 3,
          categoriaProveedor: 3,
          candidatePrice: 5300,
          precioDirecto: 5300,
          cases: 4,
          rowIndexes: [0, 1, 2, 3],
          fechaPasada: '2026-03-10',
        }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__rail')).toBeNull();
    expect(root.textContent).toContain('HUDSON');
    expect(root.textContent).toContain('$5.300,00 (4)');
    expect(root.textContent).toContain('NO_PICO');
    expect(root.textContent).toContain('La categoría es ambigua');
  });

  it('asigna un candidato a una celda permitida y no deja que otro pise el mismo Nuevo', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-a',
          rowIndexes: [0],
          candidatePrice: 7000,
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 2,
          rowIndexes: [1],
          candidatePrice: 8100,
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-a',
          rowIndexes: [0],
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
        candidato(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 2,
          rowIndexes: [1],
          candidatePrice: 8100,
          precioDirecto: 8100,
        }),
      ],
    );
    const grupo = component.grupos[0];
    const editor = grupo.editors[0];
    const tabla = editor.tablas.find((item) => item.sentido === 'IDA') ?? editor.tablas[0];
    component.onCandidateSelected(grupo, editor, tabla, {
      categoria: 2,
      status: 'NO_PICO',
      candidate: { valor: 7000, count: 1, candidateId: 'cand-a', estacionId: ESTACION_HUDSON },
    });
    expect(tabla.drafts[2].no_pico).toBe('7000');
    component.onCandidateSelected(grupo, editor, tabla, {
      categoria: 2,
      status: 'NO_PICO',
      candidate: { valor: 8100, count: 1, candidateId: 'cand-b', estacionId: ESTACION_HUDSON },
    });
    expect(tabla.drafts[2].no_pico).toBe('7000');
    expect(component.warnings.some((w) => w.code === 'precios')).toBeTrue();
  });

  it('writes Pico into empty Nuevo and saves CONFIRM_NEW for the resolved identity', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          status: null,
          sentidoAplicado: 'VUELTA',
          sentidoSolicitado: 'VUELTA',
          candidatePrice: 16000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          statusSolicitado: null,
          sentidoSolicitado: 'VUELTA',
          candidatePrice: 16000,
          precioDirecto: 16000,
        }),
      ],
      [catalogRow(ESTACION_HUDSON, 7, 'PICO', 'IDA')],
    );
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    await fixture.whenStable();
    fixture.detectChanges();

    const tabla = grupo.editors[0].tablas[grupo.editors[0].tablas.length - 1];
    expect(tabla.drafts[7]?.pico ?? '').toBe('');
    expect(Object.values(tabla.detected).flat().some((item) => item.candidateId === candidateId)).toBeFalse();
    expect(tabla.reviewRows.find((item) => item.candidateId === candidateId)?.status).toBe('PICO');

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({
          action: 'CONFIRM_NEW',
          categoriaProveedor: 9,
          categoriaCalculada: 7,
          status: 'PICO',
          sentido: 'IDA',
          importe: 16000,
          fechaVigenciaInicio: '2026-03-10',
          noCoincideConTarifario: true,
        }),
      ]),
    );
    expect(payload.some((item) => item.action === 'MARK_REVIEW')).toBeFalse();
  });

  it('keeps typed Nuevo and skips leftover MARK_REVIEW on the same cell', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, {
          id: 'typed-sep',
          categoria: 7,
          categoriaProveedor: 7,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20792.47,
          rowIndexes: [0],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'aug-9',
          categoria: 9,
          categoriaProveedor: 9,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20364.81,
          rowIndexes: [1],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'aug-8',
          categoria: 8,
          categoriaProveedor: 8,
          categoriaCalculada: 7,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20364.81,
          rowIndexes: [2],
        }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, {
          id: 'typed-sep',
          categoria: 7,
          categoriaProveedor: 7,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20792.47,
          precioDirecto: 20792.47,
          rowIndexes: [0],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'aug-9',
          categoria: 9,
          categoriaProveedor: 9,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20364.81,
          precioDirecto: 20364.81,
          rowIndexes: [1],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'aug-8',
          categoria: 8,
          categoriaProveedor: 8,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 20364.81,
          precioDirecto: 20364.81,
          rowIndexes: [2],
        }),
      ],
      [
        catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 8, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 9, 'NO_PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas[0];
    component.onDraft(grupo, tabla, { categoria: 9, status: 'NO_PICO', value: '20792.47' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    const keys = payload.map(
      (item) =>
        `${item.estacionId}|${item.sentido}|${item.categoriaCalculada ?? item.categoriaProveedor}|${item.status}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(payload.filter((item) => item.action === 'CONFIRM_NEW').length).toBe(3);
    expect(payload.some((item) => item.action === 'MARK_REVIEW')).toBeFalse();
  });

  it('saves leftover review prices as CONFIRM_NEW on each effective category', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-7',
          categoria: 7,
          categoriaProveedor: 7,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          rowIndexes: [0],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-9',
          categoria: 9,
          categoriaProveedor: 9,
          categoriaCalculada: 7,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          rowIndexes: [1],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-8',
          categoria: 8,
          categoriaProveedor: 8,
          categoriaCalculada: 7,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          rowIndexes: [2],
        }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-7',
          categoria: 7,
          categoriaProveedor: 7,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          precioDirecto: 13263.22,
          rowIndexes: [0],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-9',
          categoria: 9,
          categoriaProveedor: 9,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          precioDirecto: 13263.22,
          rowIndexes: [1],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-8',
          categoria: 8,
          categoriaProveedor: 8,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 13263.22,
          precioDirecto: 13263.22,
          rowIndexes: [2],
        }),
      ],
      [
        catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 8, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 9, 'NO_PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    const keys = payload.map(
      (item) =>
        `${item.estacionId}|${item.sentido}|${item.categoriaCalculada ?? item.categoriaProveedor}|${item.status}`,
    );
    expect(payload.length).toBe(3);
    expect(new Set(keys).size).toBe(keys.length);
    expect(payload.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
    expect(payload.every((item) => item.noCoincideConTarifario === true)).toBeTrue();
  });

  it('merges leftover review prices of the same identity within 1% into one CONFIRM_NEW', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-a',
          categoria: 6,
          categoriaProveedor: 6,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8,
          rowIndexes: [0, 1, 2],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-b',
          categoria: 6,
          categoriaProveedor: 6,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8025,
          rowIndexes: [3],
        }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-a',
          categoria: 6,
          categoriaProveedor: 6,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8,
          precioDirecto: 6961.8,
          rowIndexes: [0, 1, 2],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-b',
          categoria: 6,
          categoriaProveedor: 6,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8025,
          precioDirecto: 6961.8025,
          rowIndexes: [3],
        }),
      ],
      [catalogRow(ESTACION_GUTIERREZ, 6, 'NO_PICO', 'AMBAS')],
    );
    const grupo = component.grupos[0];
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 13), to: null });
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload.length).toBe(1);
    expect(payload[0].action).toBe('CONFIRM_NEW');
    expect(payload[0].cases).toBe(4);
    expect(payload[0].noCoincideConTarifario).toBeTrue();
    expect(withinTarifaPriceTolerance(payload[0].importe, 6961.8)).toBeTrue();
  });

  it('saves leftover distinct unmatched prices as separate CONFIRM_NEW on the same identity', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-low',
          categoria: 6,
          categoriaProveedor: 6,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6772.21,
          rowIndexes: [0],
        }),
        pendiente(ESTACION_GUTIERREZ, {
          id: 'rev-high',
          categoria: 6,
          categoriaProveedor: 6,
          status: 'NO_PICO',
          sentidoAplicado: 'AMBAS',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8,
          rowIndexes: [1],
        }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-low',
          categoria: 6,
          categoriaProveedor: 6,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6772.21,
          precioDirecto: 6772.21,
          rowIndexes: [0],
        }),
        candidato(ESTACION_GUTIERREZ, {
          id: 'rev-high',
          categoria: 6,
          categoriaProveedor: 6,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          candidatePrice: 6961.8,
          precioDirecto: 6961.8,
          rowIndexes: [1],
        }),
      ],
      [catalogRow(ESTACION_GUTIERREZ, 6, 'NO_PICO', 'AMBAS')],
    );
    const grupo = component.grupos[0];
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 13), to: null });
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    expect(guardar).toHaveBeenCalled();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    const leftover = payload.filter((item) => item.noCoincideConTarifario === true);
    expect(leftover.length).toBe(2);
    expect(leftover.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
    expect(leftover.every((item) => item.status === 'NO_PICO')).toBeTrue();
    expect(new Set(leftover.map((item) => item.importe))).toEqual(new Set([6772.21, 6961.8]));
    expect(component.error).toBeNull();
  });

  it('does not overwrite typed Nuevo when Pico targets the same cell', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          status: null,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 16000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          statusSolicitado: null,
          sentidoSolicitado: 'IDA',
          candidatePrice: 16000,
          precioDirecto: 16000,
        }),
      ],
      [catalogRow(ESTACION_HUDSON, 7, 'PICO', 'IDA')],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.editors[0].tablas[0];
    component.onDraft(grupo, tabla, { categoria: 7, status: 'PICO', value: '3138.62' });
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    expect(tabla.drafts[7]?.pico).toBe('3138.62');
  });

  it('keeps the tariff table identity when choosing PICO or NO_PICO', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          status: null,
          sentidoAplicado: 'VUELTA',
          sentidoSolicitado: 'VUELTA',
          candidatePrice: 16000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          categoria: 9,
          categoriaProveedor: 9,
          statusSolicitado: null,
          sentidoSolicitado: 'VUELTA',
          candidatePrice: 16000,
          precioDirecto: 16000,
        }),
      ],
      [catalogRow(ESTACION_HUDSON, 7, 'PICO', 'IDA')],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas[0];
    const review = grupo.editors[0].tablas[grupo.editors[0].tablas.length - 1];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    expect(grupo.editors[0].tablas[0]).toBe(tabla);
    expect(review.reviewRows.find((item) => item.candidateId === candidateId)?.status).toBe('PICO');
  });

  it('confirms Pico on the effective category and does not write the last catalogue row', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { categoria: 3, categoriaProveedor: 3, status: null, candidatePrice: 10202.36 })],
      [candidato(ESTACION_GUTIERREZ, { categoria: 3, categoriaProveedor: 3, statusSolicitado: null, candidatePrice: 10202.36, precioDirecto: 10202.36 })],
      [
        catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 8, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 9, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 7, 'PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 9, 'PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    await fixture.whenStable();
    const tabla = grupo.editors[0].tablas[0];
    expect(tabla.drafts[9]?.pico ?? '').toBe('');
    expect(tabla.drafts[3]?.pico ?? '').toBe('');
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });
    const payload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(payload[0]).toEqual(
      jasmine.objectContaining({
        action: 'CONFIRM_NEW',
        categoriaProveedor: 3,
        categoriaCalculada: 3,
        status: 'PICO',
        sentido: 'AMBAS',
        importe: 10202.36,
        noCoincideConTarifario: true,
      }),
    );
  });

  function historyHit(
    estacionId: string,
    partial: {
      tarifaId: string;
      categoria: number;
      status: 'PICO' | 'NO_PICO';
      sentido: 'IDA' | 'VUELTA' | 'AMBAS';
      importe: number;
      importeConsultado?: number;
      countIdentities?: number;
      matches?: TarifarioHistorialImporteHit['matches'];
      fechaVigenciaInicio?: string | null;
      fechaVigenciaFin?: string | null;
      esActual?: boolean | null;
      diagnostico?: string | null;
      enabled?: boolean | null;
    },
  ): TarifarioHistorialImporteHit {
    return {
      estacionId,
      importeConsultado: partial.importeConsultado ?? partial.importe,
      countIdentities: partial.countIdentities ?? 1,
      matches: partial.matches ?? [
        {
          tarifaId: partial.tarifaId,
          categoria: partial.categoria,
          status: partial.status,
          sentido: partial.sentido,
          importe: partial.importe,
        },
      ],
      tarifaId: partial.tarifaId,
      categoria: partial.categoria,
      status: partial.status,
      sentido: partial.sentido,
      importe: partial.importe,
      fechaVigenciaInicio: partial.fechaVigenciaInicio ?? '2026-08-01',
      fechaVigenciaFin: partial.fechaVigenciaFin ?? '2026-09-01',
      esActual: partial.esActual ?? false,
      diagnostico: partial.diagnostico ?? 'CONFIRMADO',
      enabled: partial.enabled ?? true,
    };
  }

  it('resuelve un importe histórico a la categoría efectiva y no lo guarda como CONFIRM_NEW', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { categoria: 6, categoriaProveedor: 6, status: 'NO_PICO', candidatePrice: 8464.0075 })],
      [candidato(ESTACION_GUTIERREZ, { categoria: 6, categoriaProveedor: 6, statusSolicitado: 'NO_PICO', candidatePrice: 8464.0075, precioDirecto: 8464.0075 })],
      [
        catalogRow(ESTACION_GUTIERREZ, 6, 'NO_PICO', 'AMBAS'),
        { ...catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'), importe: 9200, fechaVigenciaInicio: '2026-09-01' },
      ],
      [
        historyHit(ESTACION_GUTIERREZ, {
          tarifaId: 'tarifa-gut-6-np',
          categoria: 6,
          status: 'NO_PICO',
          sentido: 'AMBAS',
          importe: 8464.0075,
          matches: [
            { tarifaId: 'tarifa-gut-6-np', categoria: 6, status: 'NO_PICO', sentido: 'AMBAS', importe: 8464.0075 },
            { tarifaId: 'tarifa-gut-7-np', categoria: 7, status: 'NO_PICO', sentido: 'AMBAS', importe: 8464.0075 },
          ],
        }),
      ],
    );
    const grupo = component.grupos[0];
    expect(component.candidatesFor(grupo).length).toBe(0);
    expect(grupo.resolvedCandidates.get(`${ESTACION_GUTIERREZ}-7`)).toEqual(
      jasmine.objectContaining({ categoria: 6, status: 'NO_PICO', sentido: 'AMBAS' }),
    );
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });
    const payload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(payload.filter((item) => item.action === 'CONFIRM_NEW')).toEqual([]);
  });

  it('al elegir Pico reutiliza el historial de la categoría efectiva y no escribe Nuevo', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { categoria: 6, categoriaProveedor: 6, status: null, candidatePrice: 8464.0075 })],
      [candidato(ESTACION_GUTIERREZ, { categoria: 6, categoriaProveedor: 6, statusSolicitado: null, candidatePrice: 8464.0075, precioDirecto: 8464.0075 })],
      [
        catalogRow(ESTACION_GUTIERREZ, 6, 'PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 7, 'PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'),
      ],
      [
        {
          ...historyHit(ESTACION_GUTIERREZ, {
            tarifaId: 't6-p',
            categoria: 6,
            status: 'PICO',
            sentido: 'AMBAS',
            importe: 8464.0075,
            countIdentities: 2,
            matches: [
              { tarifaId: 't6-p', categoria: 6, status: 'PICO', sentido: 'AMBAS', importe: 8464.0075 },
              { tarifaId: 't7-p', categoria: 7, status: 'PICO', sentido: 'AMBAS', importe: 8464.0075 },
            ],
          }),
          tarifaId: null,
          categoria: null,
          status: null,
        },
      ],
    );
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    const tabla = grupo.editors[0].tablas[0];
    expect(tabla.drafts[7]?.pico ?? '').toBe('');
    expect(tabla.drafts[6]?.pico ?? '').toBe('');
    expect(grupo.resolvedCandidates.get(candidateId)).toEqual(
      jasmine.objectContaining({ categoria: 6, status: 'PICO' }),
    );
  });

  it('bloquea Guardar si la vigencia nueva empieza antes del vigente con otro importe', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { categoria: 7, categoriaProveedor: 7, status: 'NO_PICO', candidatePrice: 8464.0075 })],
      [candidato(ESTACION_GUTIERREZ, { categoria: 7, categoriaProveedor: 7, candidatePrice: 8464.0075, precioDirecto: 8464.0075 })],
      [{ ...catalogRow(ESTACION_GUTIERREZ, 7, 'NO_PICO', 'AMBAS'), importe: 9200, fechaVigenciaInicio: '2026-09-01' }],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas[0];
    component.onDraft(grupo, tabla, { categoria: 7, status: 'NO_PICO', value: '8464.0075' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 7, 1), to: null });
    const payload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(payload).toEqual([]);
    expect(component.error).toContain('cat. 7');
    expect(component.error).toContain('2026-08-01');
  });

  it('Todas Pico aplica el status a todas las filas de revisión', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, { id: 'cand-a', categoria: 7, categoriaProveedor: 7, status: null, candidatePrice: 10202.36, rowIndexes: [0] }),
        pendiente(ESTACION_BERNAL, { id: 'cand-b', categoria: 7, categoriaProveedor: 7, status: null, candidatePrice: 11000, rowIndexes: [1] }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, { id: 'cand-a', categoria: 7, categoriaProveedor: 7, statusSolicitado: null, candidatePrice: 10202.36, precioDirecto: 10202.36, rowIndexes: [0] }),
        candidato(ESTACION_BERNAL, { id: 'cand-b', categoria: 7, categoriaProveedor: 7, statusSolicitado: null, candidatePrice: 11000, precioDirecto: 11000, rowIndexes: [1] }),
      ],
      [
        catalogRow(ESTACION_GUTIERREZ, 7, 'PICO', 'AMBAS'),
        catalogRow(ESTACION_BERNAL, 7, 'PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    const editor = grupo.editors.find((item) => item.stationIds.includes(ESTACION_GUTIERREZ)) ?? grupo.editors[0];
    component.onBulkReviewStatus(grupo, editor, 'PICO');
    expect(grupo.reviewStatusByCandidate['cand-a']).toBe('PICO');
  });

  it('Todas Pico omite filas sin categoría y no pisa importes de otras categorías', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, { id: 'cand-a', categoria: 7, categoriaProveedor: 7, status: null, candidatePrice: 10202.36, rowIndexes: [0] }),
        pendiente(ESTACION_BERNAL, { id: 'cand-null', categoria: null, categoriaProveedor: null, status: null, candidatePrice: 11000, rowIndexes: [1] }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, { id: 'cand-a', categoria: 7, categoriaProveedor: 7, statusSolicitado: null, candidatePrice: 10202.36, precioDirecto: 10202.36, rowIndexes: [0] }),
        candidato(ESTACION_BERNAL, { id: 'cand-null', categoria: null, categoriaProveedor: null, statusSolicitado: null, candidatePrice: 11000, precioDirecto: 11000, rowIndexes: [1] }),
      ],
      [
        catalogRow(ESTACION_GUTIERREZ, 7, 'PICO', 'AMBAS'),
        catalogRow(ESTACION_BERNAL, 7, 'PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    for (const editor of grupo.editors) {
      component.onBulkReviewStatus(grupo, editor, 'PICO');
    }
    expect(grupo.reviewStatusByCandidate['cand-a']).toBe('PICO');
    expect(grupo.reviewStatusByCandidate['cand-null']).toBeUndefined();
  });

  it('exige categoría manual cuando el proveedor no la informa', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { id: 'cand-null', categoria: null, categoriaProveedor: null, status: null, candidatePrice: 5000 })],
      [candidato(ESTACION_GUTIERREZ, { id: 'cand-null', categoria: null, categoriaProveedor: null, statusSolicitado: null, candidatePrice: 5000, precioDirecto: 5000 })],
      [catalogRow(ESTACION_GUTIERREZ, 5, 'NO_PICO', 'AMBAS')],
    );
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'NO_PICO' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });
    expect((component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions()).toEqual([]);
    expect(component.error).toContain('categoría');
    component.onReviewCategoryChange(grupo, { candidateId, categoria: 4 });
    const payload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(payload[0]).toEqual(
      jasmine.objectContaining({
        action: 'CONFIRM_NEW',
        categoriaProveedor: null,
        categoriaCalculada: 4,
        status: 'NO_PICO',
        importe: 5000,
        noCoincideConTarifario: true,
      }),
    );
  });

  it('capea categoría 8 a la máxima 5 al confirmar Pico', async () => {
    await open(
      [pendiente(ESTACION_GUTIERREZ, { categoria: 8, categoriaProveedor: 8, status: null, candidatePrice: 5000 })],
      [candidato(ESTACION_GUTIERREZ, { categoria: 8, categoriaProveedor: 8, statusSolicitado: null, candidatePrice: 5000, precioDirecto: 5000 })],
      [
        catalogRow(ESTACION_GUTIERREZ, 5, 'NO_PICO', 'AMBAS'),
        catalogRow(ESTACION_GUTIERREZ, 5, 'PICO', 'AMBAS'),
      ],
    );
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    component.onReviewStatusChange(grupo, { candidateId, status: 'PICO' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 8, 1), to: null });
    const payload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(payload[0]).toEqual(
      jasmine.objectContaining({
        action: 'CONFIRM_NEW',
        categoriaProveedor: 8,
        categoriaCalculada: 5,
        status: 'PICO',
        importe: 5000,
        noCoincideConTarifario: true,
      }),
    );
  });

  it('no infiere PICO/NO_PICO ni sentido por importe y deja tres precios visibles', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'p1',
          status: null,
          sentidoAplicado: null,
          sentidoSolicitado: null,
          candidatePrice: 1000,
          rowIndexes: [0],
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'p2',
          status: null,
          sentidoAplicado: null,
          sentidoSolicitado: null,
          candidatePrice: 2000,
          rowIndexes: [1],
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'p3',
          status: null,
          sentidoAplicado: null,
          sentidoSolicitado: null,
          candidatePrice: 3000,
          rowIndexes: [2],
        }),
      ],
      [
        candidato(ESTACION_HUDSON, { id: 'p1', statusSolicitado: null, candidatePrice: 1000, precioDirecto: 1000, rowIndexes: [0] }),
        candidato(ESTACION_HUDSON, { id: 'p2', statusSolicitado: null, candidatePrice: 2000, precioDirecto: 2000, rowIndexes: [1] }),
        candidato(ESTACION_HUDSON, { id: 'p3', statusSolicitado: null, candidatePrice: 3000, precioDirecto: 3000, rowIndexes: [2] }),
      ],
    );
    const drafts = component.grupos[0].editors[0].tablas.flatMap((tabla) =>
      Object.values(tabla.drafts).flatMap((cell) => [cell.no_pico, cell.pico]),
    );
    expect(drafts.every((value) => value === '')).toBeTrue();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('$1.000,00 (1)');
    expect(root.textContent).toContain('$2.000,00 (1)');
    expect(root.textContent).toContain('$3.000,00 (1)');
    expect(root.querySelector('[data-role="revision"]')).toBeTruthy();
    expect(root.querySelector('[data-warn="precios"]')).toBeTruthy();
  });

  it('pide Vigente desde solo al confirmar una tarifa nueva y no muestra fecha hasta', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
    );
    const root = fixture.nativeElement as HTMLElement;
    const picker = root.querySelector('app-date-range-picker');
    expect(picker).toBeTruthy();
    expect(root.textContent).toContain('Vigente desde');
    expect(root.textContent).not.toContain('Vigente hasta');
    expect(root.textContent).not.toContain('Fecha hasta');
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    component.confirmCandidate(component.grupos[0], 'estacion-hudson-7', 'CONFIRM_NEW');
    await component.guardar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.error).toContain('Vigente desde');
  });

  it('no llama al RPC de guardado al abrir, recargar o reagrupar, y autocompleta solo como borrador', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 25500,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 25500,
          precioDirecto: 25500,
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const ida = grupo.editors[0].tablas.find((tabla) => tabla.sentido === 'IDA');
    expect(ida?.drafts[2].no_pico).toBe('');
    expect(JSON.stringify(grupo.editors[0].tablas.map((tabla) => tabla.reviewRows))).toContain('25500');
    await component.onSeleccionChange(grupo, 0, []);
    expect(spy).not.toHaveBeenCalled();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(spy).not.toHaveBeenCalled();
  });

  it('expone avisos accesibles de tarifa, ambigüedad, precios, solapamiento, permiso y REVISAR', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, { codigo: 'NEW_TARIFF' }),
        pendiente(ESTACION_SAMBOROMBON, {
          codigo: 'STATUS_AMBIGUOUS',
          status: null,
          candidatePrice: 8000,
          rowIndexes: [1],
        }),
      ],
      [
        candidato(ESTACION_HUDSON),
        candidato(ESTACION_SAMBOROMBON, {
          statusSolicitado: null,
          candidatePrice: 8000,
          precioDirecto: 8000,
          rowIndexes: [1],
        }),
      ],
    );
    const grupo = component.grupos[0];
    const reviewCandidate = component.candidatesFor(grupo)[0];
    if (reviewCandidate) {
      component.confirmCandidate(grupo, reviewCandidate.candidateId, 'MARK_REVIEW');
    }
    fixture.componentRef.setInput('canManage', false);
    component.error = 'Las vigencias se solapan';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-warn="sin-compatible"][role="alert"]')).toBeTruthy();
    expect(root.querySelector('[data-warn="status"][role="alert"]')).toBeTruthy();
    expect(root.querySelector('[data-warn="permiso"][role="alert"]')).toBeTruthy();
    expect(root.querySelector('[data-warn="solapamiento"][role="alert"]')).toBeTruthy();
    expect(root.querySelector('[data-warn="revisar"]')).toBeTruthy();
    expect(root.textContent).toContain('no cierra la tarifa vigente');
  });

  it('no deja que otro candidato pise el Nuevo después de desmarcar una estación compartida', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, {
          id: 'cand-dock',
          rowIndexes: [0],
          candidatePrice: 7000,
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'cand-a',
          rowIndexes: [1],
          candidatePrice: 7000,
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 2,
          rowIndexes: [2],
          candidatePrice: 8100,
          status: 'NO_PICO',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, {
          id: 'cand-dock',
          rowIndexes: [0],
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
        candidato(ESTACION_HUDSON, {
          id: 'cand-a',
          rowIndexes: [1],
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
        candidato(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 2,
          rowIndexes: [2],
          candidatePrice: 8100,
          precioDirecto: 8100,
        }),
      ],
    );
    const grupo = component.grupos[0];
    const shared = grupo.editors.find((editor) => editor.stationIds.length > 1);
    expect(shared).toBeTruthy();
    const tabla = shared!.tablas.find((item) => item.sentido === 'IDA') ?? shared!.tablas[0];
    component.onCandidateSelected(grupo, shared!, tabla, {
      categoria: 2,
      status: 'NO_PICO',
      candidate: { valor: 7000, count: 1, candidateId: 'cand-a', estacionId: ESTACION_HUDSON },
    });
    expect(tabla.drafts[2].no_pico).toBe('7000');

    await component.onSeleccionChange(grupo, 0, [ESTACION_HUDSON]);
    fixture.detectChanges();
    await fixture.whenStable();

    const hudsonEditor = grupo.editors.find(
      (editor) => editor.stationIds.length === 1 && editor.stationIds[0] === ESTACION_HUDSON,
    );
    expect(hudsonEditor).toBeTruthy();
    const hudsonTabla = hudsonEditor!.tablas.find((item) => item.sentido === 'IDA') ?? hudsonEditor!.tablas[0];
    expect(hudsonTabla.drafts[2].no_pico).toBe('7000');
    component.onCandidateSelected(grupo, hudsonEditor!, hudsonTabla, {
      categoria: 2,
      status: 'NO_PICO',
      candidate: { valor: 8100, count: 1, candidateId: 'cand-b', estacionId: ESTACION_HUDSON },
    });
    expect(hudsonTabla.drafts[2].no_pico).toBe('7000');
  });

  it('no confirma en silencio un candidato sin sentido o status: deshabilita o avisa', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          codigo: 'DIRECTION_REQUIRED',
          sentidoSolicitado: null,
          sentidoAplicado: null,
          directionConfidence: 'UNRESOLVED',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: null,
          directionConfidence: 'UNRESOLVED',
          unresolvedReason: 'MISSING_MAPPING',
        }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__rail')).toBeNull();
    expect(root.querySelector('[data-role="revision"]')).toBeTruthy();

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
    expect(payload[0].sentido).toBe('IDA');
    expect(payload[0].noCoincideConTarifario).toBeTrue();
  });

  it('mantiene el selector de sentido visible después de elegir IDA', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          codigo: 'DIRECTION_REQUIRED',
          sentidoSolicitado: null,
          sentidoAplicado: null,
          directionConfidence: 'UNRESOLVED',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: null,
          directionConfidence: 'UNRESOLVED',
          unresolvedReason: 'MISSING_MAPPING',
        }),
      ],
    );
    const editor = component.grupos[0].editors[0];
    expect((fixture.nativeElement as HTMLElement).querySelector('app-search-select')).toBeTruthy();
    component.onSentidoChange(editor, 'IDA');
    fixture.detectChanges();
    expect(editor.sentidoSeleccionado).toBe('IDA');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-search-select')).toBeTruthy();
  });

  it('no muestra aviso de varios precios cuando 7000 compartido convive con un 8000 independiente', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(component.grupos[0].sharedSlots[0]).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    expect(root.querySelector('[data-warn="precios"]')).toBeNull();
    expect(component.warnings.some((warn) => warn.code === 'precios')).toBeFalse();
  });

  it('no muestra el rail de candidatos y deja las acciones en el tablero', async () => {
    await open([pendiente(ESTACION_HUDSON)], [candidato(ESTACION_HUDSON)]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.trd__rail')).toBeNull();
    expect(root.querySelectorAll('.trd__candidate-actions button').length).toBe(0);
    expect(root.querySelector('app-tarifario-editor-board')).toBeTruthy();
  });

  it('emite TarifaRefreshDecision al confirmar con fecha y deja vigencia nula en Revisar', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const candidateId = component.candidatesFor(grupo)[0].candidateId;
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    component.confirmCandidate(grupo, candidateId, 'CONFIRM_NEW');
    await component.guardar();
    expect(spy).toHaveBeenCalled();
    const confirmPayload = spy.calls.mostRecent().args[0] as Array<{ action?: string }>;
    const confirmed = confirmPayload.find((item) => item.action === 'CONFIRM_NEW') as
      | {
          action: string;
          fechaVigenciaInicio: string | null;
          categoriaProveedor: number;
          status: string;
          sentido: string;
        }
      | undefined;
    expect(confirmed).toBeTruthy();
    expect(confirmed!.action).toBe('CONFIRM_NEW');
    expect(confirmed!.fechaVigenciaInicio).toBe('2026-03-10');
    expect(confirmed!.categoriaProveedor).toBe(2);
    expect(confirmed!.status).toBe('NO_PICO');
    expect(confirmed!.sentido).toBe('IDA');

    spy.calls.reset();
    component.confirmCandidate(grupo, candidateId, 'MARK_REVIEW');
    await component.guardar();
    const reviewPayload = spy.calls.mostRecent().args[0] as Array<{ action?: string }>;
    const reviewed = reviewPayload.find((item) => item.action === 'MARK_REVIEW') as
      | { action: string; fechaVigenciaInicio: string | null }
      | undefined;
    expect(reviewed).toBeTruthy();
    expect(reviewed!.action).toBe('MARK_REVIEW');
    expect(reviewed!.fechaVigenciaInicio).toBeNull();
  });

  it('exige Vigente desde al tipear Nuevo aunque no se pulse Confirmar', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    await component.guardar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.error).toContain('Vigente desde');
  });

  it('no confirma una tarifa nueva si Nuevo está vacío', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    tabla.drafts = { ...tabla.drafts, 2: { no_pico: '', pico: tabla.drafts[2]?.pico ?? '' } };
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    component.confirmCandidate(grupo, component.candidatesFor(grupo)[0].candidateId, 'CONFIRM_NEW');
    await component.guardar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.error).toContain('Nuevo');
  });

  it('omite celdas Nuevo vacías y guarda los no coincidentes como REVISAR', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    tabla.drafts = { ...tabla.drafts, 2: { no_pico: '', pico: '' } };
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    expect(payload.length).toBe(1);
    expect(payload[0].action).toBe('CONFIRM_NEW');
    expect(payload[0].fechaVigenciaInicio).toBe('2026-03-10');
    expect(payload[0].importe).toBe(7000);
    expect(payload[0].noCoincideConTarifario).toBeTrue();
  });

  it('emite IDA y VUELTA en una sola llamada atómica', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const ida = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA');
    const vuelta = grupo.editors[0].tablas.find((item) => item.sentido === 'VUELTA');
    expect(ida && vuelta).toBeTruthy();
    component.onDraft(grupo, ida!, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onDraft(grupo, vuelta!, { categoria: 2, status: 'NO_PICO', value: '26000' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    expect(payload.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
    expect(payload.map((item) => item.sentido).sort()).toEqual(['IDA', 'VUELTA']);
    expect(payload.find((item) => item.sentido === 'IDA')?.importe).toBe(25500);
    expect(payload.find((item) => item.sentido === 'VUELTA')?.importe).toBe(26000);
  });

  it('rechaza identidades duplicadas antes del RPC', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const editor = grupo.editors[0];
    grupo.editors = [editor, { ...editor, key: `${editor.key}-dup`, tablas: editor.tablas }];
    const tabla = editor.tablas.find((item) => item.sentido === 'IDA') ?? editor.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.error).toMatch(/duplicad/i);
  });

  it('preserva borradores y el error tipado si el RPC falla', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    refresh.failNextSave = true;
    const closed: boolean[] = [];
    component.openChange.subscribe((open) => closed.push(open));
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(component.error).toBe('No se pudieron guardar las tarifas.');
    expect(tabla.drafts[2].no_pico).toBe('25500');
    expect(closed).not.toContain(false);
  });

  it('confirma CONFIRM_NEW con categoría calculada 2 aunque el proveedor sea 3', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-cat-corr',
          codigo: 'AMBIGUOUS_TARIFF_MATCH',
          categoria: 3,
          categoriaProveedor: 3,
          categoriaCalculada: null,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 5300,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-cat-corr',
          categoria: 3,
          categoriaProveedor: 3,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 5300,
          precioDirecto: 5300,
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const editor = grupo.editors[0];
    const tabla = editor.tablas.find((item) => item.sentido === 'IDA') ?? editor.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 3, status: 'NO_PICO', value: '' });
    component.onCandidateSelected(grupo, editor, tabla, {
      categoria: 2,
      status: 'NO_PICO',
      candidate: { valor: 5300, count: 1, candidateId: 'cand-cat-corr', estacionId: ESTACION_HUDSON },
    });
    expect(tabla.drafts[2].no_pico).toBe('5300');
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    component.confirmCandidate(grupo, 'cand-cat-corr', 'CONFIRM_NEW');
    await component.guardar();
    expect(component.error).not.toContain('Nuevo');
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    const confirmed = payload.find((item) => item.action === 'CONFIRM_NEW');
    expect(confirmed).toBeTruthy();
    expect(confirmed!.categoriaProveedor).toBe(3);
    expect(confirmed!.categoriaCalculada).toBe(2);
  });

  it('sugiere IVA desde el tarifario y permite override en identidades nuevas', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-iva',
          categoria: 9,
          categoriaProveedor: 9,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-iva',
          categoria: 9,
          categoriaProveedor: 9,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const grupo = component.grupos[0];
    const candidateId = 'cand-iva';
    const editor = grupo.editors[0];
    const tabla = editor.tablas.find((item) => item.sentido === 'IDA') ?? editor.tablas[0];
    await component.addCategoria(grupo, tabla);
    component.onIvaChange(grupo, { candidateId, value: true });
    component.onCandidateSelected(grupo, editor, tabla, {
      categoria: 3,
      status: 'NO_PICO',
      candidate: { valor: 9000, count: 1, candidateId, estacionId: ESTACION_HUDSON },
    });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    const confirmed = payload.find((item) => item.action === 'CONFIRM_NEW');
    expect(confirmed).toBeTruthy();
    expect(confirmed!.requiereNormalizacionIva).toBeTrue();
  });

  it('revalida precios con borradores sin guardar ni perder el valor ingresado', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-a',
          categoria: 2,
          categoriaProveedor: 2,
          candidatePrice: 7000,
          rowIndexes: [0],
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 3,
          categoriaProveedor: 3,
          candidatePrice: 7000,
          rowIndexes: [1],
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-a',
          categoria: 2,
          categoriaProveedor: 2,
          candidatePrice: 7000,
          precioDirecto: 7000,
          rowIndexes: [0],
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_HUDSON, {
          id: 'cand-b',
          categoria: 3,
          categoriaProveedor: 3,
          candidatePrice: 7000,
          precioDirecto: 7000,
          rowIndexes: [1],
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const save = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 3, status: 'NO_PICO', value: '7000' });

    await component.revalidarPrecios();

    expect(save).not.toHaveBeenCalled();
    expect(tabla.drafts[3].no_pico).toBe('7000');
    expect(component.candidatesFor(grupo)).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Revalidar precios');
  });

  it('does not rebuild tables when typing after revalidate', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-a',
          categoria: 2,
          categoriaProveedor: 2,
          candidatePrice: 7000,
          rowIndexes: [0],
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-a',
          categoria: 2,
          categoriaProveedor: 2,
          candidatePrice: 7000,
          precioDirecto: 7000,
          rowIndexes: [0],
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA') ?? grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '7000' });
    await component.revalidarPrecios();
    const afterRevalidate = grupo.editors[0].tablas.find((item) => item.sentido === tabla.sentido) ?? grupo.editors[0].tablas[0];
    component.onDraft(grupo, afterRevalidate, { categoria: 2, status: 'NO_PICO', value: '7100' });
    expect(grupo.editors[0].tablas.find((item) => item.sentido === afterRevalidate.sentido)).toBe(afterRevalidate);
    expect(afterRevalidate.drafts[2].no_pico).toBe('7100');
  });

  it('al revalidar, un Nuevo tipeado gana sobre el catálogo AUSA 7/8/9 y cae en esa categoría', async () => {
    const precio = 13541.75;
    const catalogRows: TarifarioCurrentRow[] = [7, 8, 9].map((categoria) => ({
      tarifa_id: `tarifa-pb-${categoria}`,
      peaje_id: PEAJE_AUBASA,
      peaje_nombre: 'AUSA',
      estacion_id: ESTACION_HUDSON,
      estacion_nombre: 'PASEO DEL BAJO',
      categoria,
      status: 'NO_PICO',
      sentido: 'IDA',
      importe: 13541.74,
      fecha_actualizacion: '2026-09-08T00:00:00Z',
      current_tarifa_importe_id: `importe-pb-${categoria}`,
    }));
    const resultados = [7, 8, 9].map((categoria, index) =>
      pendiente(ESTACION_HUDSON, {
        id: `pb-${categoria}`,
        categoria,
        categoriaProveedor: categoria,
        candidatePrice: precio,
        rowIndexes: [index],
        sentidoSolicitado: 'IDA',
        sentidoAplicado: 'IDA',
      }),
    );
    const candidatos = [7, 8, 9].map((categoria, index) =>
      candidato(ESTACION_HUDSON, {
        id: `pb-${categoria}`,
        categoria,
        categoriaProveedor: categoria,
        candidatePrice: precio,
        precioDirecto: precio,
        rowIndexes: [index],
        sentidoSolicitado: 'IDA',
        directionConfidence: 'EXPLICIT',
      }),
    );
    await open(resultados, candidatos, catalogRows);

    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 7, status: 'NO_PICO', value: String(precio) });
    await component.revalidarPrecios();

    const rebuilt = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(rebuilt.drafts[7].no_pico).toBe(String(precio));
    expect(component.candidatesFor(grupo)).toEqual([]);
    expect(rebuilt.detected['7:NO_PICO'].map((item) => item.candidateId).sort()).toEqual(['pb-7', 'pb-8', 'pb-9']);
    expect(rebuilt.detected['8:NO_PICO'] ?? []).toEqual([]);
    expect(rebuilt.detected['9:NO_PICO'] ?? []).toEqual([]);
  });

  it('al revalidar, un Nuevo en categoría agregada gana aunque el máximo del catálogo sea menor', async () => {
    const precio = 13541.75;
    const catalogRows: TarifarioCurrentRow[] = [4, 5].flatMap((categoria) =>
      (['NO_PICO', 'PICO'] as const).map((status) => catalogRow(ESTACION_HUDSON, categoria, status, 'AMBAS')),
    );
    const resultados = [7, 8, 9].map((categoria, index) =>
      pendiente(ESTACION_HUDSON, {
        id: `pb-draft-${categoria}`,
        codigo: 'DIRECTION_REQUIRED',
        categoria,
        categoriaProveedor: categoria,
        status: null,
        candidatePrice: precio,
        rowIndexes: [index],
        sentidoSolicitado: null,
        sentidoAplicado: null,
      }),
    );
    const candidatos = [7, 8, 9].map((categoria, index) =>
      candidato(ESTACION_HUDSON, {
        id: `pb-draft-${categoria}`,
        categoria,
        categoriaProveedor: categoria,
        statusSolicitado: null,
        candidatePrice: precio,
        precioDirecto: precio,
        rowIndexes: [index],
        sentidoSolicitado: null,
        directionConfidence: 'UNRESOLVED',
      }),
    );
    await open(resultados, candidatos, catalogRows);

    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas[0];
    expect(component.nextCategory(tabla)).toEqual({ categoria: 6, action: 'DRAFT' });
    await component.addCategoria(grupo, tabla);
    component.onDraft(grupo, tabla, { categoria: 6, status: 'NO_PICO', value: String(precio) });
    await component.revalidarPrecios();

    const rebuilt = grupo.editors[0].tablas[0];
    expect(rebuilt.drafts[6].no_pico).toBe(String(precio));
    expect(component.candidatesFor(grupo)).toEqual([]);
    expect(rebuilt.detected['6:NO_PICO'].map((item) => item.candidateId).sort()).toEqual([
      'pb-draft-7',
      'pb-draft-8',
      'pb-draft-9',
    ]);
  });

  it('al revalidar, un mismo Nuevo en 3/4/5 cae en la categoría efectiva y no queda en revisión', async () => {
    const precio = 7453.8;
    const catalogRows: TarifarioCurrentRow[] = [3, 4, 5].flatMap((categoria) =>
      (['NO_PICO', 'PICO'] as const).map((status) => {
        const row = catalogRow(ESTACION_HUDSON, categoria, status, 'AMBAS');
        return { ...row, importe: status === 'NO_PICO' ? 7000 + categoria : 10984.54 };
      }),
    );
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'varela-7453',
          codigo: 'DIRECTION_REQUIRED',
          categoria: 4,
          categoriaProveedor: 4,
          status: null,
          candidatePrice: precio,
          sentidoSolicitado: null,
          sentidoAplicado: null,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'varela-7453',
          categoria: 4,
          categoriaProveedor: 4,
          statusSolicitado: null,
          candidatePrice: precio,
          precioDirecto: precio,
          sentidoSolicitado: null,
          directionConfidence: 'UNRESOLVED',
        }),
      ],
      catalogRows,
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas[0];
    component.onDraft(grupo, tabla, { categoria: 3, status: 'NO_PICO', value: String(precio) });
    component.onDraft(grupo, tabla, { categoria: 4, status: 'NO_PICO', value: String(precio) });
    component.onDraft(grupo, tabla, { categoria: 5, status: 'NO_PICO', value: String(precio) });
    await component.revalidarPrecios();

    const rebuilt = grupo.editors[0].tablas[0];
    expect(component.candidatesFor(grupo)).toEqual([]);
    expect(rebuilt.detected['4:NO_PICO'].map((item) => item.candidateId)).toEqual(['varela-7453']);
    expect(rebuilt.detected['3:NO_PICO'] ?? []).toEqual([]);
    expect(rebuilt.detected['5:NO_PICO'] ?? []).toEqual([]);
  });

  it('muestra una corrección de categoría ya resuelta en Detectado sin volverla una fila de revisión', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'pendiente-7000',
          candidatePrice: 7000,
          sentidoSolicitado: 'IDA',
          sentidoAplicado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          id: 'correccion-pb',
          codigo: 'CURRENT_CATEGORY_CORRECTION',
          categoria: 7,
          categoriaProveedor: 7,
          categoriaCalculada: 9,
          candidatePrice: 13541.75,
          status: 'NO_PICO',
          sentidoSolicitado: 'IDA',
          sentidoAplicado: 'IDA',
          rowIndexes: [1],
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'pendiente-7000',
          candidatePrice: 7000,
          precioDirecto: 7000,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_HUDSON, {
          id: 'correccion-pb',
          categoria: 7,
          categoriaProveedor: 7,
          candidatePrice: 13541.75,
          precioDirecto: 13541.75,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          rowIndexes: [1],
        }),
      ],
    );

    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(tabla.detected['9:NO_PICO'].map((item) => item.candidateId)).toContain('correccion-pb');
    expect(tabla.detected['9:NO_PICO'][0].readOnly).toBeTrue();
    expect(component.candidatesFor(grupo).map((item) => item.candidateId)).toEqual(['pendiente-7000']);
  });

  it('mantiene la tarifa para revisión si dos identidades del máximo nivel coinciden en precio', async () => {
    const precio = 13541.75;
    const catalogRows: TarifarioCurrentRow[] = ['NO_PICO', 'PICO'].map((status) => ({
      tarifa_id: `tarifa-pb-9-${status}`,
      peaje_id: PEAJE_AUBASA,
      peaje_nombre: 'AUSA',
      estacion_id: ESTACION_HUDSON,
      estacion_nombre: 'PASEO DEL BAJO',
      categoria: 9,
      status: status as 'NO_PICO' | 'PICO',
      sentido: 'IDA',
      importe: 13541.74,
      fecha_actualizacion: '2026-09-08T00:00:00Z',
      current_tarifa_importe_id: `importe-pb-9-${status}`,
    }));
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'pb-ambigua',
          categoria: 7,
          categoriaProveedor: 7,
          candidatePrice: precio,
          sentidoSolicitado: 'IDA',
          sentidoAplicado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'pb-ambigua',
          categoria: 7,
          categoriaProveedor: 7,
          candidatePrice: precio,
          precioDirecto: precio,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      catalogRows,
    );

    const grupo = component.grupos[0];
    await component.revalidarPrecios();
    expect(component.candidatesFor(grupo).map((item) => item.candidateId)).toEqual(['pb-ambigua']);
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(tabla.detected['9:NO_PICO'] ?? []).toEqual([]);
  });

  it('no recarga el tarifario cuando llega un array nuevo de plantillas', async () => {
    await open(
      [pendiente(ESTACION_HUDSON, { sentidoAplicado: 'IDA', sentidoSolicitado: 'IDA' })],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const listar = spyOn(tarifario, 'listar').and.callThrough();
    const obtener = spyOn(tarifario, 'obtenerEditor').and.callThrough();
    fixture.componentRef.setInput('configuraciones', [
      {
        id: 'cfg-1',
        plantilla_id: 'p-1',
        nombre_columna: 'PRECIO',
        orden: 1,
        tipo: 'transformacion',
        obligatoria: false,
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(listar).not.toHaveBeenCalled();
    expect(obtener).not.toHaveBeenCalled();
  });

  it('con N=1 sigue mostrando un solo checkbox y el par 2+1 de tres estaciones', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(component.grupos[0].groupCount).toBe(1);
    expect(root.querySelectorAll('app-checkbox-multi-select').length).toBe(1);
    expect(root.querySelector('input[type="number"][aria-label="Grupos de tarifa"]')).toBeTruthy();
    expect(component.grupos[0].editors.map((editor) => [...editor.stationIds])).toEqual([
      [ESTACION_DOCK_SUD, ESTACION_HUDSON],
      [ESTACION_SAMBOROMBON],
    ]);
  });

  it('reuses an unchanged singleton editor when another slot changes', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const grupo = component.grupos[0];
    const singleton = grupo.editors.find((editor) => editor.key === ESTACION_SAMBOROMBON)!;
    const tabla = singleton.tablas[0];
    await component.onSeleccionChange(grupo, 0, [ESTACION_DOCK_SUD]);
    expect(grupo.editors.find((editor) => editor.key === ESTACION_SAMBOROMBON)?.tablas[0]).toBe(tabla);
  });

  it('con N=2 muestra dos checkboxes y dos tablas compartidas para cuatro estaciones', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
        pendiente(ESTACION_INCOMPLETA, { rowIndexes: [3], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
        candidato(ESTACION_INCOMPLETA, { rowIndexes: [3], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const grupo = component.grupos[0];
    await component.onGroupCountChange(grupo, 2);
    await component.onSeleccionChange(grupo, 1, [ESTACION_SAMBOROMBON, ESTACION_INCOMPLETA]);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-checkbox-multi-select').length).toBe(2);
    expect(root.textContent).toContain('Grupo 1 de 2');
    expect(root.textContent).toContain('Grupo 2 de 2');
    expect(grupo.editors.map((editor) => [...editor.stationIds])).toEqual([
      [ESTACION_DOCK_SUD, ESTACION_HUDSON],
      [ESTACION_SAMBOROMBON, ESTACION_INCOMPLETA],
    ]);
    expect(root.querySelectorAll('app-tarifario-editor-board').length).toBeGreaterThanOrEqual(2);
    expect(component.checkboxOptions(grupo, 1).find((option) => option.value === ESTACION_DOCK_SUD)?.disabled).toBeTrue();
  });

  it('el cambio de estado de categoría solo fan-outea a las estaciones del editor', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0], candidatePrice: 7000 }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1], candidatePrice: 7000 }),
        pendiente(ESTACION_SAMBOROMBON, { rowIndexes: [2], candidatePrice: 8000 }),
        pendiente(ESTACION_INCOMPLETA, { rowIndexes: [3], candidatePrice: 8000 }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0], precioDirecto: 7000 }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1], precioDirecto: 7000 }),
        candidato(ESTACION_SAMBOROMBON, { rowIndexes: [2], precioDirecto: 8000, candidatePrice: 8000 }),
        candidato(ESTACION_INCOMPLETA, { rowIndexes: [3], precioDirecto: 8000, candidatePrice: 8000 }),
      ],
    );
    const grupo = component.grupos[0];
    await component.onGroupCountChange(grupo, 2);
    await component.onSeleccionChange(grupo, 1, [ESTACION_SAMBOROMBON, ESTACION_INCOMPLETA]);
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const spy = spyOn(tarifario, 'actualizarEstadoCategorias').and.returnValue(of([]));
    const shared = grupo.editors.find((editor) => editor.stationIds[0] === ESTACION_DOCK_SUD)!;
    const tabla = shared.tablas[0];
    await component.onCategoryStateChange(grupo, tabla, { categoria: 2, enabled: false, tarifaIds: [] });
    const cambios = spy.calls.mostRecent().args[0] as Array<{ estacionId: string }>;
    expect(cambios.map((item) => item.estacionId).sort()).toEqual(
      [ESTACION_DOCK_SUD, ESTACION_HUDSON].sort(),
    );
    expect(cambios.some((item) => item.estacionId === ESTACION_SAMBOROMBON)).toBeFalse();
  });

  it('guardar dos grupos de dos estaciones emite cuatro identidades independientes', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, {
          rowIndexes: [0],
          candidatePrice: 7000,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_HUDSON, {
          rowIndexes: [1],
          candidatePrice: 7000,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_SAMBOROMBON, {
          rowIndexes: [2],
          candidatePrice: 8000,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
        pendiente(ESTACION_INCOMPLETA, {
          rowIndexes: [3],
          candidatePrice: 8000,
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, {
          rowIndexes: [0],
          precioDirecto: 7000,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_HUDSON, {
          rowIndexes: [1],
          precioDirecto: 7000,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_SAMBOROMBON, {
          rowIndexes: [2],
          precioDirecto: 8000,
          candidatePrice: 8000,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
        candidato(ESTACION_INCOMPLETA, {
          rowIndexes: [3],
          precioDirecto: 8000,
          candidatePrice: 8000,
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const grupo = component.grupos[0];
    await component.onGroupCountChange(grupo, 2);
    await component.onSeleccionChange(grupo, 1, [ESTACION_SAMBOROMBON, ESTACION_INCOMPLETA]);
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const first = grupo.editors[0].tablas.find((tabla) => tabla.sentido === 'IDA') ?? grupo.editors[0].tablas[0];
    const second = grupo.editors[1].tablas.find((tabla) => tabla.sentido === 'IDA') ?? grupo.editors[1].tablas[0];
    component.onDraft(grupo, first, { categoria: 2, status: 'NO_PICO', value: '25500' });
    component.onDraft(grupo, second, { categoria: 2, status: 'NO_PICO', value: '26000' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    const payload = spy.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload.length).toBe(4);
    expect(new Set(payload.map((item) => item.estacionId))).toEqual(
      new Set([ESTACION_DOCK_SUD, ESTACION_HUDSON, ESTACION_SAMBOROMBON, ESTACION_INCOMPLETA]),
    );
    expect(payload.every((item) => item.action === 'CONFIRM_NEW')).toBeTrue();
  });

  function saveDecisions(): TarifaRefreshDecision[] {
    return (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
  }

  it('hides a disabled category, skips it on revalidar, and omits it from save until Habilitar', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 7000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
      ],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '8100' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.onCategoryStateChange(grupo, tabla, { categoria: 2, enabled: false, tarifaIds: [] });
    fixture.detectChanges();

    const rebuilt = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(grupo.catalogRows.filter((row) => row.estacion_id === ESTACION_HUDSON && row.categoria === 2 && row.sentido === 'IDA').every((row) => row.enabled === false)).toBeTrue();
    expect(rebuilt.drafts[2]?.no_pico ?? '').toBe('');
    expect(component.nextCategory(rebuilt)).toEqual({ categoria: 2, action: 'ENABLE' });
    const idaBoard = (fixture.nativeElement as HTMLElement).querySelectorAll('app-tarifario-editor-board')[0];
    expect(Array.from(idaBoard.querySelectorAll('.tf__cat-cell')).map((el) => el.textContent?.trim())).toEqual(['1']);
    expect(idaBoard.querySelector('.tf__add')?.textContent).toContain('Habilitar categoría 2');

    await component.revalidarPrecios();
    const afterRevalidate = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect([...grupo.resolvedCandidates.values()].some((identity) => identity.categoria === 2)).toBeFalse();
    expect(saveDecisions().some((item) => (item.categoriaCalculada ?? item.categoriaProveedor) === 2)).toBeFalse();

    await component.addCategoria(grupo, afterRevalidate);
    fixture.detectChanges();
    const enabled = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(grupo.catalogRows.filter((row) => row.estacion_id === ESTACION_HUDSON && row.categoria === 2 && row.sentido === 'IDA').every((row) => row.enabled !== false)).toBeTrue();
    expect(Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-tarifario-editor-board')[0].querySelectorAll('.tf__cat-cell'),
    ).map((el) => el.textContent?.trim())).toContain('2');
    expect(enabled.rows.some((row) => row.categoria === 2 && row.no_pico.enabled !== false)).toBeTrue();
  });

  it('revalidates Nuevo in one click and prefers the typed draft over a stale catalog hit', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-7050',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 7050,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-7050',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 7050,
          precioDirecto: 7050,
        }),
      ],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '7050' });
    await component.revalidarPrecios();

    const rebuilt = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(grupo.resolvedCandidates.get('cand-7050')).toEqual({
      categoria: 2,
      status: 'NO_PICO',
      sentido: 'IDA',
    });
    expect(rebuilt.detected['2:NO_PICO']?.map((item) => item.candidateId)).toEqual(['cand-7050']);
    expect(rebuilt.detected['1:NO_PICO'] ?? []).toEqual([]);
    expect(component.candidatesFor(grupo)).toEqual([]);
  });

  it('keeps a previous revalidar match when typing another Nuevo cell', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          id: 'cand-7000',
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 7000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          id: 'cand-7000',
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
      ],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    await component.revalidarPrecios();
    expect(grupo.resolvedCandidates.has('cand-7000')).toBeTrue();
    const after = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, after, { categoria: 1, status: 'NO_PICO', value: '5500' });
    expect(grupo.resolvedCandidates.has('cand-7000')).toBeTrue();
    expect(after.detected['2:NO_PICO']?.some((item) => item.candidateId === 'cand-7000')).toBeTrue();
  });

  it('saves a catalog-only Nuevo with cases 0', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
          candidatePrice: 7000,
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
          candidatePrice: 7000,
          precioDirecto: 7000,
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 1, status: 'NO_PICO', value: '5600' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    const payload = spy.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    const catalogOnly = payload.find((item) => item.categoriaCalculada === 1 || (item.categoriaProveedor === 1 && item.action === 'CONFIRM_NEW'));
    expect(catalogOnly?.action).toBe('CONFIRM_NEW');
    expect(catalogOnly?.cases).toBe(0);
    expect(catalogOnly?.importe).toBe(5600);
  });

  it('muestra el mensaje real del RPC cuando Guardar falla', async () => {
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    spyOn(refresh, 'guardar').and.callFake(async () => {
      throw { message: 'la identidad de tarifa esta deshabilitada', code: 'P0001' };
    });
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    component.onDraft(grupo, tabla, { categoria: 1, status: 'NO_PICO', value: '5600' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(component.error).toBe('la identidad de tarifa esta deshabilitada');
  });

  it('does not warn IDA/VUELTA on an AMBAS family or always-on REVISAR', async () => {
    await open(
      [
        pendiente(ESTACION_GUTIERREZ, {
          codigo: 'DIRECTION_REQUIRED',
          candidatePrice: 5000,
          sentidoSolicitado: null,
          sentidoAplicado: null,
        }),
      ],
      [
        candidato(ESTACION_GUTIERREZ, {
          candidatePrice: 5000,
          precioDirecto: 5000,
          sentidoSolicitado: null,
          directionConfidence: 'UNRESOLVED',
        }),
      ],
    );
    const grupo = component.grupos[0];
    expect(grupo.family).toBe('AMBAS');
    expect(component.warnings.some((warn) => warn.code === 'direccion')).toBeFalse();
    const tabla = grupo.editors[0].tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '5000' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    (component as unknown as { refreshWarnings(): void }).refreshWarnings();
    expect(component.warnings.some((warn) => warn.code === 'revisar')).toBeFalse();
  });

  it('ofrece Habilitar categoría cuando el catálogo trae una identidad deshabilitada', async () => {
    const disabled = catalogRow(ESTACION_HUDSON, 3, 'NO_PICO', 'IDA');
    disabled.enabled = false;
    const disabledPico = catalogRow(ESTACION_HUDSON, 3, 'PICO', 'IDA');
    disabledPico.enabled = false;
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        catalogRow(ESTACION_HUDSON, 1, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 1, 'PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'PICO', 'IDA'),
        disabled,
        disabledPico,
        catalogRow(ESTACION_HUDSON, 1, 'NO_PICO', 'VUELTA'),
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'VUELTA'),
      ],
    );
    const tabla = component.grupos[0].editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    expect(component.nextCategory(tabla)).toEqual({ categoria: 3, action: 'ENABLE' });
  });

  it('habilita las identidades deshabilitadas agregadas antes de guardar CONFIRM_NEW', async () => {
    const disabled = catalogRow(ESTACION_HUDSON, 3, 'NO_PICO', 'IDA');
    disabled.enabled = false;
    const disabledPico = catalogRow(ESTACION_HUDSON, 3, 'PICO', 'IDA');
    disabledPico.enabled = false;
    await open(
      [
        pendiente(ESTACION_HUDSON, {
          sentidoAplicado: 'IDA',
          sentidoSolicitado: 'IDA',
        }),
      ],
      [
        candidato(ESTACION_HUDSON, {
          sentidoSolicitado: 'IDA',
          directionConfidence: 'EXPLICIT',
        }),
      ],
      [
        catalogRow(ESTACION_HUDSON, 1, 'NO_PICO', 'IDA'),
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'IDA'),
        disabled,
        disabledPico,
        catalogRow(ESTACION_HUDSON, 1, 'NO_PICO', 'VUELTA'),
        catalogRow(ESTACION_HUDSON, 2, 'NO_PICO', 'VUELTA'),
      ],
    );
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const enable = spyOn(tarifario, 'actualizarEstadoCategorias').and.callThrough();
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const save = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    const tabla = grupo.editors[0].tablas.find((item) => item.sentido === 'IDA')!;
    tabla.addedDraftCategories = [3];
    component.onDraft(grupo, tabla, { categoria: 3, status: 'NO_PICO', value: '9000' });
    component.onVigenteDesde(grupo, { from: new Date(2026, 2, 10), to: null });
    await component.guardar();
    expect(enable).toHaveBeenCalled();
    const cambios = enable.calls.mostRecent().args[0] as Array<{ categoria: number; enabled: boolean }>;
    expect(cambios.some((item) => item.categoria === 3 && item.enabled === true)).toBeTrue();
    expect(save).toHaveBeenCalled();
    const payload = save.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload.some((item) => item.action === 'CONFIRM_NEW' && (item.categoriaCalculada ?? item.categoriaProveedor) === 3)).toBeTrue();
    expect(enable).toHaveBeenCalledBefore(save);
  });

  it('lista el catálogo con enabled null para incluir identidades deshabilitadas', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TarifaRefreshDialogComponent],
      providers: [
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        { provide: TARIFA_REFRESH_SERVICE, useClass: TarifaRefreshMockService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaRefreshDialogComponent);
    component = fixture.componentInstance;
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const listar = spyOn(tarifario, 'listar').and.callThrough();
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('resultados', [
      pendiente(ESTACION_HUDSON, { sentidoAplicado: 'IDA', sentidoSolicitado: 'IDA' }),
    ]);
    fixture.componentRef.setInput('candidatos', [
      candidato(ESTACION_HUDSON, { sentidoSolicitado: 'IDA', directionConfidence: 'EXPLICIT' }),
    ]);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listar).toHaveBeenCalled();
    const params = listar.calls.mostRecent().args[0] as { filters?: { enabled?: boolean | null }; pageSize?: number };
    expect(params.filters?.enabled).toBeNull();
    expect(params.pageSize).toBe(100);
  });
});
