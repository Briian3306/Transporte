import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PlantillaConfiguracion,
} from '../../models';
import { PeajesPlantillaApplyService } from './peajes-plantilla-apply.service';
import { PeajesWizardStateService } from './peajes-wizard-state.service';

describe('PeajesPlantillaApplyService QUANTITY repair', () => {
  let apply: PeajesPlantillaApplyService;
  let state: PeajesWizardStateService;
  let plantillaSinQuantity: PlantillaConfiguracion;

  const estacionId = 'est-campana';
  const patenteId = 'pat-ae751pa';

  beforeEach(() => {
    plantillaSinQuantity = {
      id: 'plt-ausol-7',
      nombre: 'AUSOL-7-2026',
      empresa_id: 'emp-1',
      estado: 'activa',
      mapeos: [
        { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
        { columnaOrigen: 'FECHA_HORA', columnaDestino: 'FECHA_HORA', excluida: false },
        { columnaOrigen: 'PASE_ID', columnaDestino: 'PASE_ID', excluida: false },
        { columnaOrigen: 'PATENTE', columnaDestino: 'PATENTE_ID', excluida: false },
        { columnaOrigen: 'PRECIO', columnaDestino: 'PRECIO', excluida: false },
        { columnaOrigen: 'BONIFICACION', columnaDestino: 'BONIFICACION', excluida: false },
        { columnaOrigen: 'IMPORTE_NETO', columnaDestino: 'IMPORTE_NETO', excluida: false },
      ],
      estaciones_reconocidas: [
        {
          id: 'rel-1',
          plantilla_id: 'plt-ausol-7',
          valor_proveedor: 'CAMPANA',
          valor_normalizado: 'CAMPANA',
          estacion_id: estacionId,
          origen: 'plantilla',
        },
      ],
      configuraciones: [
        {
          id: 'c10',
          plantilla_id: 'plt-ausol-7',
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
          plantilla_id: 'plt-ausol-7',
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
          plantilla_id: 'plt-ausol-7',
          nombre_columna: 'PATENTE',
          columna_destino: 'PATENTE_ID',
          orden: 30,
          tipo: 'transformacion',
          algoritmo_combinado_id: null,
          obligatoria: true,
          configuracion: { algoritmo_codigo: 'BORRAR_ESPACIOS', columna: 'PATENTE' },
        },
        {
          id: 'c50',
          plantilla_id: 'plt-ausol-7',
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
          plantilla_id: 'plt-ausol-7',
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
          plantilla_id: 'plt-ausol-7',
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

    TestBed.configureTestingModule({
      providers: [
        PeajesWizardStateService,
        PeajesPlantillaApplyService,
        {
          provide: PEAJES_PLANTILLAS_SERVICE,
          useValue: {
            obtenerPlantilla: () => of(plantillaSinQuantity),
            listarAlgoritmos: () => of([]),
          },
        },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarEstaciones: () =>
              of([{ id: estacionId, nombre: 'Campana', peaje_id: 'p1', codigos_proveedor: ['CAMPANA'] }]),
            listarPatentes: () =>
              of([{ id: patenteId, patente: 'AE751PA', categoria: 'TRANSPORTE' }]),
          },
        },
      ],
    });

    apply = TestBed.inject(PeajesPlantillaApplyService);
    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
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
  });

  it('repara plantilla sin QUANTITY (AUSOL-7-2026) y aplica con QUANTITY=1', async () => {
    const result = await apply.aplicarYEvaluar(plantillaSinQuantity.id);

    expect(result.ok).toBeTrue();
    expect(result.errores).toEqual([]);
    expect(result.errores.some((e) => /QUANTITY/i.test(e))).toBeFalse();
    expect(state.mapeosActivos().some((m) => m.columnaDestino === 'QUANTITY')).toBeTrue();
    expect(
      state.getConfiguracionesDraft().some(
        (d) =>
          d.columna_destino === 'QUANTITY' &&
          d.configuracion?.['algoritmo_codigo'] === 'ASIGNAR_VALOR'
      )
    ).toBeTrue();
    const pasadas = state.snapshot().pasadasEstandarizadas;
    expect(pasadas.length).toBe(1);
    expect(pasadas[0].QUANTITY).toBe(1);
  });
});
