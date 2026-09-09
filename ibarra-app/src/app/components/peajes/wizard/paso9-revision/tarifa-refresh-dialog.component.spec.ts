import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PEAJES_TARIFARIO_SERVICE } from '../../models/tarifario.contracts';
import { TARIFA_REFRESH_SERVICE } from '../../models/tarifa-refresh.contracts';
import {
  ESTACION_BERNAL,
  ESTACION_DOCK_SUD,
  ESTACION_GUTIERREZ,
  ESTACION_HUDSON,
  ESTACION_SAMBOROMBON,
  PEAJE_AUBASA,
  TarifarioMockService,
} from '../../tarifario/mocks/tarifario.mock';
import { TarifaRefreshMockService } from '../mocks/tarifa-refresh.mock';
import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { TarifaRefreshDialogComponent } from './tarifa-refresh-dialog.component';

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
    statusSolicitado: 'NO_PICO',
    sentidoSolicitado: null,
    directionConfidence: 'UNRESOLVED',
    unresolvedReason: 'MISSING_MAPPING',
    sourceStationCode: null,
    sourceLane: null,
    candidatePrice: opts.candidatePrice ?? 7000,
    precioDirecto: opts.precioDirecto ?? opts.candidatePrice ?? 7000,
    filaRepresentativa: {},
    rowIndexes: opts.rowIndexes ?? [0],
    ...opts,
  };
}

describe('TarifaRefreshDialogComponent', () => {
  let fixture: ComponentFixture<TarifaRefreshDialogComponent>;
  let component: TarifaRefreshDialogComponent;

  async function open(resultados: ResultadoDetectarRefresco[], candidatos: CandidatoRefrescoTarifa[]): Promise<void> {
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

  it('aplica el mismo importe a cada estación seleccionada sin compartir tarifas.id', async () => {
    await open(
      [
        pendiente(ESTACION_DOCK_SUD, { rowIndexes: [0] }),
        pendiente(ESTACION_HUDSON, { rowIndexes: [1] }),
      ],
      [
        candidato(ESTACION_DOCK_SUD, { rowIndexes: [0] }),
        candidato(ESTACION_HUDSON, { rowIndexes: [1] }),
      ],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    expect(grupo.seleccionadas).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    component.onDraft(grupo, grupo.tablas[0], { categoria: 2, status: 'NO_PICO', value: '25500' });
    await component.guardar();
    const cambios = spy.calls.mostRecent().args[0] as Array<{ estacionId: string; importe: number; peajeId: string }>;
    const estaciones = [...new Set(cambios.map((c) => c.estacionId))];
    expect(estaciones).toEqual([ESTACION_DOCK_SUD, ESTACION_HUDSON]);
    expect(cambios.every((c) => c.importe === 25500)).toBeTrue();
    expect(cambios.every((c) => c.peajeId === PEAJE_AUBASA)).toBeTrue();
  });

  it('marca requiereNormalizacionIva=false cuando una estación no tiene esa identidad', async () => {
    await open(
      [pendiente(ESTACION_HUDSON, { categoria: 7, candidatePrice: 25500 })],
      [candidato(ESTACION_HUDSON, { categoria: 7, candidatePrice: 25500, precioDirecto: 25500 })],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE) as TarifaRefreshMockService;
    const spy = spyOn(refresh, 'guardar').and.callThrough();
    const grupo = component.grupos[0];
    component.onDraft(grupo, grupo.tablas[0], { categoria: 7, status: 'NO_PICO', value: '25500' });
    await component.guardar();
    const cambios = spy.calls.mostRecent().args[0];
    expect(cambios.length).toBeGreaterThan(0);
    expect(cambios.every((c) => c.requiereNormalizacionIva === false)).toBeTrue();
  });
});
