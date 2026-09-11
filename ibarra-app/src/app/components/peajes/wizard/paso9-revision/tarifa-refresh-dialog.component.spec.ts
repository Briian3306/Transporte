import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  PEAJES_TARIFARIO_SERVICE,
  TarifaRefreshDecision,
  TarifaRefrescoGuardada,
  TarifarioCurrentRow,
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
import { STATION_SESSION_PALETTE } from './tarifa-refresh-dialog.helpers';

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
    if (catalogRows) {
      const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE) as TarifarioMockService;
      spyOn(tarifario, 'listar').and.returnValue(of({ rows: catalogRows, total: catalogRows.length, page: 1, pageSize: 500 }));
    }
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('resultados', resultados);
    fixture.componentRef.setInput('candidatos', candidatos);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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
    expect(component.grupos[0].seleccionadas).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    expect(component.grupos[0].seleccionadas).not.toContain(ESTACION_SAMBOROMBON);
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
    expect(root.querySelectorAll('.at__seg-btn').length).toBe(0);
  });

  it('conserva los importes tipeados al sumar una estación', async () => {
    await open(
      [pendiente(ESTACION_HUDSON)],
      [candidato(ESTACION_HUDSON)],
    );
    const grupo = component.grupos[0];
    const tabla = grupo.tablas[0];
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '25500' });
    await component.onSeleccionChange(grupo, [...grupo.seleccionadas, ESTACION_SAMBOROMBON]);
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
    expect(grupo.seleccionadas).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);

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
    const options = component.checkboxOptions(grupo);
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
    await component.onSeleccionChange(grupo, [ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(grupo.editors.map((editor) => [...editor.stationIds])).toEqual([
      [ESTACION_DOCK_SUD, ESTACION_HUDSON],
      [ESTACION_SAMBOROMBON],
    ]);

    await component.onSeleccionChange(grupo, []);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(grupo.seleccionadas).toEqual([]);
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

  it('keeps a selected review status out of Nuevo and saves the existing higher-priority identity', async () => {
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

    const tabla = grupo.editors[0].tablas[0];
    expect(tabla.drafts[7]?.pico ?? '').toBe('');
    expect(Object.values(tabla.detected).flat().some((item) => item.candidateId === candidateId)).toBeFalse();
    expect(tabla.reviewRows.find((item) => item.candidateId === candidateId)?.status).toBe('PICO');

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const guardar = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = guardar.calls.mostRecent().args[0] as TarifaRefreshDecision[];
    expect(payload).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({
          action: 'MARK_REVIEW',
          categoriaProveedor: 9,
          categoriaCalculada: 7,
          status: 'PICO',
          sentido: 'IDA',
          importe: 16000,
          fechaVigenciaInicio: null,
        }),
      ]),
    );
  });

  it('uses the highest selected-status category, then the station highest category as fallback', async () => {
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
    const firstPayload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(firstPayload[0]).toEqual(jasmine.objectContaining({ categoriaProveedor: 3, categoriaCalculada: 9, status: 'PICO', sentido: 'AMBAS' }));

    grupo.reviewStatusByCandidate[candidateId] = 'PICO';
    grupo.catalogRows = grupo.catalogRows.filter((row) => row.status !== 'PICO');
    const fallbackPayload = (component as unknown as { collectSaveDecisions(): TarifaRefreshDecision[] }).collectSaveDecisions();
    expect(fallbackPayload[0]).toEqual(jasmine.objectContaining({ categoriaProveedor: 3, categoriaCalculada: 9, status: 'PICO', sentido: 'AMBAS' }));
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
    expect(JSON.stringify(ida?.detected)).toContain('25500');
    await component.onSeleccionChange(grupo, []);
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

    await component.onSeleccionChange(grupo, [ESTACION_HUDSON]);
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
    expect(spy).not.toHaveBeenCalled();
    expect(component.error).toContain('sentido');
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
    expect(component.grupos[0].seleccionadas).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
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
    component.onDraft(grupo, tabla, { categoria: 2, status: 'NO_PICO', value: '7000' });
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
    expect(payload[0].action).toBe('MARK_REVIEW');
    expect(payload[0].fechaVigenciaInicio).toBeNull();
    expect(payload[0].importe).toBe(7000);
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
    component.onIvaChange(grupo, { candidateId, value: true });
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    await component.guardar();
    const payload = spy.calls.mostRecent().args[0] as unknown as TarifaRefreshDecision[];
    expect(payload[0].action).toBe('MARK_REVIEW');
    expect(payload[0].categoriaProveedor).toBe(9);
    expect(payload[0].requiereNormalizacionIva).toBeTrue();
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

  it('muestra en Detectado la categoría 9 del tarifario al revalidar precios AUSA de categorías 7, 8 y 9', async () => {
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
    expect(rebuilt.detected['9:NO_PICO'].map((item) => item.candidateId)).toEqual(['pb-7', 'pb-8', 'pb-9']);
    expect(rebuilt.detected['7:NO_PICO'] ?? []).toEqual([]);
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
});
