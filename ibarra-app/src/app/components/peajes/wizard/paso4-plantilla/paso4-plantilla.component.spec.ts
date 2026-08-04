import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Paso4PlantillaComponent } from './paso4-plantilla.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { PeajesPlantillaApplyService } from '../services/peajes-plantilla-apply.service';
import {
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PlantillaConfiguracion,
} from '../../models';

describe('Paso4PlantillaComponent F09', () => {
  let fixture: ComponentFixture<Paso4PlantillaComponent>;
  let component: Paso4PlantillaComponent;
  let state: PeajesWizardStateService;
  let plantillaActual: PlantillaConfiguracion;

  const estacionId = 'est-campana';
  const patenteId = 'pat-ae751pa';

  const plantillaAusolLike: PlantillaConfiguracion = {
    id: 'plt-ausol-v2',
    nombre: 'AUSOL-V2-08-2026',
    empresa_id: 'emp-1',
    estado: 'activa',
    mapeos: [
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
      { columnaOrigen: 'FECHA_HORA', columnaDestino: 'FECHA_HORA', excluida: false },
      { columnaOrigen: 'PASE_ID', columnaDestino: 'PASE_ID', excluida: false },
      { columnaOrigen: 'PATENTE', columnaDestino: 'PATENTE_ID', excluida: false },
      { columnaOrigen: 'PRECIO', columnaDestino: 'PRECIO', excluida: false },
      { columnaOrigen: 'BONIFICACION', columnaDestino: 'BONIFICACION', excluida: false },
      { columnaOrigen: 'QUANTITY', columnaDestino: 'QUANTITY', excluida: false },
      { columnaOrigen: 'IMPORTE_NETO', columnaDestino: 'IMPORTE_NETO', excluida: false },
    ],
    estaciones_reconocidas: [
      {
        id: 'rel-1',
        plantilla_id: 'plt-ausol-v2',
        valor_proveedor: 'CAMPANA',
        valor_normalizado: 'CAMPANA',
        estacion_id: estacionId,
        origen: 'plantilla',
      },
    ],
    configuraciones: [
      {
        id: 'c10',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: {
          algoritmo_codigo: 'COMBINAR_COLUMNAS',
          columnas_entrada: ['FECHA', 'HORA'],
          separador: ' ',
        },
      },
      {
        id: 'c20',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'DISPOSITIVO',
        columna_destino: 'PASE_ID',
        orden: 20,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'DISPOSITIVO' },
      },
      {
        id: 'c30',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'PATENTE',
        columna_destino: 'PATENTE_ID',
        orden: 30,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'BORRAR_ESPACIOS', columna: 'PATENTE' },
      },
      {
        id: 'c40',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'QUANTITY',
        columna_destino: 'QUANTITY',
        orden: 40,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
      },
      {
        id: 'c50',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 50,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
      },
      {
        id: 'c60',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'BONIFICACION',
        columna_destino: 'BONIFICACION',
        orden: 60,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'BONIFICACION' },
      },
      {
        id: 'c70',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 70,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          precio_columna: 'TARIFA',
          bonificacion_columna: 'BONIFICACION',
        },
      },
    ],
  };

  beforeEach(async () => {
    plantillaActual = structuredClone(plantillaAusolLike);

    await TestBed.configureTestingModule({
      imports: [Paso4PlantillaComponent],
      providers: [
        PeajesWizardStateService,
        PeajesPlantillaApplyService,
        {
          provide: PEAJES_PLANTILLAS_SERVICE,
          useValue: {
            listarPlantillas: () => of([plantillaAusolLike]),
            obtenerPlantilla: () => of(plantillaActual),
            listarAlgoritmos: () => of([]),
          },
        },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarEstaciones: () =>
              of([{ id: estacionId, nombre: 'Campana', peaje_id: 'peaje-1', codigos_proveedor: ['CAMPANA'] }]),
            listarPatentes: () =>
              of([{ id: patenteId, patente: 'AE751PA', categoria: 'TRANSPORTE' }]),
          },
        },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setEmpresaId('emp-1');
    state.setPreview({
      nombreArchivo: '557074.csv',
      tamanioBytes: 100,
      totalFilas: 1,
      columnas: ['FECHA', 'HORA', 'ESTACION', 'DISPOSITIVO', 'PATENTE', 'TARIFA', 'BONIFICACION'],
      filasPreview: [
        {
          FECHA: '2026-07-16',
          HORA: '01:34:14',
          ESTACION: 'CAMPANA',
          DISPOSITIVO: '94891934',
          PATENTE: 'AE751PA',
          TARIFA: '3976.59',
          BONIFICACION: '0.00',
        },
      ],
      filasOrigen: [
        {
          FECHA: '2026-07-16',
          HORA: '01:34:14',
          ESTACION: 'CAMPANA',
          DISPOSITIVO: '94891934',
          PATENTE: 'AE751PA',
          TARIFA: '3976.59',
          BONIFICACION: '0.00',
        },
      ],
      tiposInferidos: {},
    });

    fixture = TestBed.createComponent(Paso4PlantillaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('aplica plantilla AUSOL-like sin error ESTACION_ID y emite facturaDirecta', async () => {
    component.plantillaId = plantillaAusolLike.id;
    const facturaSpy = jasmine.createSpy('facturaDirecta');
    const excepcionSpy = jasmine.createSpy('irAExcepcion');
    component.facturaDirecta.subscribe(facturaSpy);
    component.irAExcepcion.subscribe(excepcionSpy);

    await component.continuar();

    expect(component.errores).toEqual([]);
    expect(state.mapeosActivos().some((m) => m.columnaDestino === 'ESTACION_ID')).toBeTrue();
    expect(state.snapshot().relacionesEstacion[0]?.estacionId).toBe(estacionId);
    expect(facturaSpy).toHaveBeenCalled();
    expect(excepcionSpy).not.toHaveBeenCalled();
  });

  it('con estación desconocida emite irAExcepcion Paso 6', async () => {
    plantillaActual = { ...plantillaAusolLike, estaciones_reconocidas: [] };

    component.plantillaId = plantillaAusolLike.id;
    const facturaSpy = jasmine.createSpy('facturaDirecta');
    const excepcionSpy = jasmine.createSpy('irAExcepcion');
    component.facturaDirecta.subscribe(facturaSpy);
    component.irAExcepcion.subscribe(excepcionSpy);

    await component.continuar();

    expect(component.errores).toEqual([]);
    expect(facturaSpy).not.toHaveBeenCalled();
    expect(excepcionSpy).toHaveBeenCalledWith(6);
  });
});
