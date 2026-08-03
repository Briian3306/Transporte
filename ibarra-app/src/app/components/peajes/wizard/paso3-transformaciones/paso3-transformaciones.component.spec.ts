import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PEAJES_PLANTILLAS_SERVICE, PeajesPlantillasService } from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { buildMvpPreview, MVP_COLUMNAS_EXCLUIDAS, MVP_COLUMNAS_INCLUIDAS } from '../fixtures/mvp-ejemplo.fixture';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { Paso3TransformacionesComponent } from './paso3-transformaciones.component';

describe('Paso3TransformacionesComponent (editable pipeline I-P*)', () => {
  let fixture: ComponentFixture<Paso3TransformacionesComponent>;
  let component: Paso3TransformacionesComponent;
  let state: PeajesWizardStateService;
  let motor: PeajesMotorTransformacionService;

  const plantillasMock: jasmine.SpyObj<PeajesPlantillasService> = jasmine.createSpyObj(
    'PeajesPlantillasService',
    [
      'listarPlantillas',
      'obtenerPlantilla',
      'guardarPlantilla',
      'sobrescribirConfiguraciones',
      'listarAlgoritmos',
      'guardarAlgoritmo',
      'expandirAlgoritmo',
    ]
  );

  beforeEach(async () => {
    plantillasMock.listarPlantillas.and.returnValue(of([]));
    plantillasMock.obtenerPlantilla.and.returnValue(of(null));
    plantillasMock.guardarPlantilla.and.callFake((meta, _cfgs) =>
      of({
        id: meta.id ?? 'plt-saved',
        nombre: meta.nombre,
        descripcion: meta.descripcion ?? null,
        empresa_id: meta.empresa_id,
        estado: (meta.estado as 'borrador') || 'borrador',
        created_at: '2026-07-31T00:00:00Z',
        updated_at: '2026-07-31T00:00:00Z',
        configuraciones: [],
      })
    );
    plantillasMock.sobrescribirConfiguraciones.and.returnValue(of([]));
    plantillasMock.listarAlgoritmos.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Paso3TransformacionesComponent],
      providers: [
        PeajesWizardStateService,
        PeajesMotorTransformacionService,
        { provide: PEAJES_PLANTILLAS_SERVICE, useValue: plantillasMock },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    motor = TestBed.inject(PeajesMotorTransformacionService);
    state.reiniciar();
    state.setPreview(buildMvpPreview());
    state.setSeleccionColumnas([...MVP_COLUMNAS_INCLUIDAS], [...MVP_COLUMNAS_EXCLUIDAS]);

    fixture = TestBed.createComponent(Paso3TransformacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** I-P01: seed draft on init with MVP headers */
  it('I-P01: seed draft al iniciar con headers MVP', () => {
    expect(component.drafts.length).toBeGreaterThan(0);
    const codigos = component.drafts.map((d) => d.configuracion?.algoritmo_codigo);
    expect(codigos).toContain('FORMATEAR_FECHA_HORA');
    expect(codigos).toContain('CALCULAR_IMPORTE_NETO');
    expect(component.descriptors.length).toBe(10);
  });

  /** I-P02: add step */
  it('I-P02: anadirPaso agrega un draft', () => {
    const before = component.drafts.length;
    component.anadirPaso();
    expect(component.drafts.length).toBe(before + 1);
    expect(component.selectedClientId).toBeTruthy();
    const added = component.drafts.find((d) => d.clientId === component.selectedClientId);
    expect(added?.configuracion?.algoritmo_codigo).toBe('COPIAR_COLUMNA');
  });

  /** I-P03: edit step */
  it('I-P03: aplicarEdicion actualiza algoritmo y salida', () => {
    component.anadirPaso();
    const id = component.selectedClientId!;
    component.editAlgoritmo = 'ASIGNAR_VALOR';
    component.editSalida = 'QUANTITY_EXTRA';
    component.editEntradas = [];
    component.editParams = { valor: 2 };
    component.editHabilitado = true;
    component.aplicarEdicion();

    const step = state.getConfiguracionesDraft().find((d) => d.clientId === id);
    expect(step?.configuracion?.algoritmo_codigo).toBe('ASIGNAR_VALOR');
    expect(step?.columna_destino).toBe('QUANTITY_EXTRA');
    expect(step?.configuracion?.parametros?.['valor']).toBe(2);
  });

  /** I-P04: delete step */
  it('I-P04: confirmarBorrar elimina el paso', () => {
    const target = component.drafts[0];
    const before = component.drafts.length;
    component.pedirBorrar(target.clientId);
    component.confirmarBorrar();
    expect(component.drafts.length).toBe(before - 1);
    expect(component.drafts.some((d) => d.clientId === target.clientId)).toBeFalse();
  });

  /** I-P05: duplicate step */
  it('I-P05: duplicarPaso clona el paso', () => {
    const source = component.drafts[0];
    const before = component.drafts.length;
    component.duplicarPaso(source.clientId);
    expect(component.drafts.length).toBe(before + 1);
    const copy = component.drafts.find((d) => d.clientId === component.selectedClientId);
    expect(copy).toBeTruthy();
    expect(copy!.clientId).not.toBe(source.clientId);
    expect(copy!.configuracion?.algoritmo_codigo).toBe(
      source.configuracion?.algoritmo_codigo
    );
  });

  /** I-P06: reorder */
  it('I-P06: onDrop reordena drafts y orden', () => {
    const idsBefore = component.drafts.map((d) => d.clientId);
    expect(idsBefore.length).toBeGreaterThan(2);
    component.onDrop({
      previousIndex: 0,
      currentIndex: 2,
      item: null as never,
      container: null as never,
      previousContainer: null as never,
      isPointerOverContainer: true,
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
      event: new MouseEvent('mouseup'),
    });
    const idsAfter = component.drafts.map((d) => d.clientId);
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[2]);
    expect(idsAfter[2]).toBe(idsBefore[0]);
    expect(component.drafts.map((d) => d.orden)).toEqual(
      component.drafts.map((_, i) => (i + 1) * 10)
    );
  });

  /** I-P07: disable step */
  it('I-P07: toggleHabilitado deshabilita el paso', () => {
    const target = component.drafts.find(
      (d) => d.configuracion?.algoritmo_codigo === 'ASIGNAR_VALOR'
    )!;
    expect(component.estaHabilitado(target)).toBeTrue();
    component.toggleHabilitado(target.clientId);
    const updated = component.drafts.find((d) => d.clientId === target.clientId)!;
    expect(component.estaHabilitado(updated)).toBeFalse();
    expect(component.badgeValidacion(updated)).toBe('off');
  });

  /** I-P08: dependency errors appear */
  it('I-P08: errores de dependencia aparecen tras editar mal', () => {
    const importe = component.drafts.find(
      (d) => d.columna_destino === 'IMPORTE_NETO'
    )!;
    component.seleccionarPaso(importe.clientId);
    component.editAlgoritmo = 'CALCULAR_IMPORTE_NETO';
    component.editEntradas = ['PRECIO_FANTASMA', 'BONIFICACION_FANTASMA'];
    component.editSalida = 'IMPORTE_NETO';
    component.editParams = {
      precio_columna: 'PRECIO_FANTASMA',
      bonificacion_columna: 'BONIFICACION_FANTASMA',
    };
    component.aplicarEdicion();

    expect(component.errores.length).toBeGreaterThan(0);
    expect(
      component.errores.some(
        (e) =>
          /ausente|no disponible|uso antes|faltante|PRECIO_FANTASMA|BONIFICACION_FANTASMA/i.test(
            e.motivo
          ) || /PRECIO_FANTASMA|BONIFICACION_FANTASMA/i.test(e.columna ?? '')
      )
    ).toBeTrue();
  });

  /** Preview uses motor — Demo row1 ground truth */
  it('I-P preview: motor produce FECHA_HORA e IMPORTE_NETO fila 1 Demo', () => {
    const importe = component.drafts.find(
      (d) => d.columna_destino === 'IMPORTE_NETO'
    )!;
    spyOn(motor, 'previsualizarPaso').and.callThrough();
    component.seleccionarPaso(importe.clientId);

    expect(motor.previsualizarPaso).toHaveBeenCalled();
    const row1 = component.filasPreviewIo[0];
    expect(row1).toBeTruthy();
    expect(String(row1['FECHA_HORA'])).toBe('2026-06-25 20:50:05');
    expect(Number(row1['IMPORTE_NETO'])).toBe(12180);
  });

  /** completado / atras emitters */
  it('I-P emitters: completado y atras', () => {
    const completadoSpy = jasmine.createSpy('completado');
    const atrasSpy = jasmine.createSpy('atras');
    component.completado.subscribe(completadoSpy);
    component.atras.subscribe(atrasSpy);

    component.errores = [];
    component.continuar();
    expect(completadoSpy).toHaveBeenCalled();

    component.atras.emit();
    expect(atrasSpy).toHaveBeenCalled();
  });

  /** Integration via state seed → motor sum Demo 10 */
  it('I-P Demo: aplicarPipeline seed draft → suma IMPORTE_NETO = 102060', () => {
    const configs = state.toConfiguracionesPlantilla();
    const filas = (state.snapshot().preview?.filasPreview ?? []).slice(0, 10);
    const out = motor.aplicarPipeline(filas, configs);
    expect(out.length).toBe(10);
    const sum = out.reduce((acc, r) => acc + Number(r['IMPORTE_NETO'] ?? 0), 0);
    expect(sum).toBe(102060);
    expect(String(out[0]['FECHA_HORA'])).toBe('2026-06-25 20:50:05');
    expect(Number(out[0]['IMPORTE_NETO'])).toBe(12180);
  });
});
