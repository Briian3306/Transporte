import { TestBed } from '@angular/core/testing';
import { buildMvpPreview } from '../fixtures/mvp-ejemplo.fixture';
import {
  ConfiguracionPlantillaDraft,
  PeajesWizardStateService,
} from './peajes-wizard-state.service';

function draftStep(
  overrides: Partial<ConfiguracionPlantillaDraft> & Pick<ConfiguracionPlantillaDraft, 'nombre_columna'>
): ConfiguracionPlantillaDraft {
  return {
    clientId: overrides.clientId ?? `c-${overrides.nombre_columna}-${overrides.orden ?? 0}`,
    orden: overrides.orden ?? 10,
    tipo: overrides.tipo ?? 'transformacion',
    nombre_columna: overrides.nombre_columna,
    columna_destino: overrides.columna_destino ?? overrides.nombre_columna,
    algoritmo_combinado_id: overrides.algoritmo_combinado_id ?? null,
    configuracion: overrides.configuracion ?? {
      algoritmo_codigo: 'COPIAR_COLUMNA',
      habilitado: true,
    },
    obligatoria: overrides.obligatoria ?? true,
  };
}

describe('PeajesWizardStateService (F02-9 / F02-10)', () => {
  let state: PeajesWizardStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PeajesWizardStateService] });
    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
  });

  it('conserva configuración al volver atrás y avanzar', () => {
    state.setPreview({
      nombreArchivo: 'a.xlsx',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['A'],
      filasPreview: [{ A: 1 }],
      filasOrigen: [{ A: 1 }],
      tiposInferidos: { A: 'número' },
    });
    state.setFactura({
      factura: 'F-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-01-01',
      importe_sin_iva: 10,
      importe_total: 12,
    });
    state.setPaso(7);
    state.setPaso(5);
    state.setPaso(7);
    expect(state.snapshot().factura.factura).toBe('F-1');
    expect(state.snapshot().preview?.nombreArchivo).toBe('a.xlsx');
  });

  /** U-W01: dirty after setConfiguracionesDraft until markPipelineSaved */
  it('U-W01: dirty after setConfiguracionesDraft until markPipelineSaved', () => {
    expect(state.isPipelineDirty()).toBeFalse();

    state.setConfiguracionesDraft([
      draftStep({ clientId: 'a', orden: 10, nombre_columna: 'FECHA' }),
    ]);
    expect(state.isPipelineDirty()).toBeTrue();

    state.markPipelineSaved();
    expect(state.isPipelineDirty()).toBeFalse();
  });

  /** U-W02: discard restores snapshot */
  it('U-W02: discard restores snapshot', () => {
    const saved = [
      draftStep({ clientId: 'saved-1', orden: 10, nombre_columna: 'FECHA', columna_destino: 'FECHA_HORA' }),
    ];
    state.setConfiguracionesDraft(saved);
    state.markPipelineSaved();

    state.addDraftStep({
      tipo: 'transformacion',
      nombre_columna: 'EXTRA',
      columna_destino: 'EXTRA',
      configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', parametros: { valor: 1 }, habilitado: true },
      obligatoria: false,
    });
    expect(state.isPipelineDirty()).toBeTrue();
    expect(state.getConfiguracionesDraft().length).toBe(2);

    state.discardPipelineChanges();
    const restored = state.getConfiguracionesDraft();
    expect(restored.length).toBe(1);
    expect(restored[0].clientId).toBe('saved-1');
    expect(restored[0].nombre_columna).toBe('FECHA');
    expect(state.isPipelineDirty()).toBeFalse();
  });

  /** U-W03: seed MVP headers → non-empty draft */
  it('U-W03: seed MVP headers → non-empty draft', () => {
    state.setPreview(buildMvpPreview());
    expect(state.getConfiguracionesDraft().length).toBe(0);

    const seeded = state.seedDemoPipelineIfEmpty();
    expect(seeded).toBeTrue();
    const draft = state.getConfiguracionesDraft();
    expect(draft.length).toBeGreaterThan(0);

    const codigos = draft.map((d) => d.configuracion?.algoritmo_codigo);
    expect(codigos).toContain('FORMATEAR_FECHA_HORA');
    expect(codigos).toContain('BORRAR_ESPACIOS');
    expect(codigos).toContain('ELIMINAR_GUIONES');
    expect(codigos).toContain('CONVERTIR_MAYUSCULAS');
    expect(codigos).toContain('COPIAR_COLUMNA');
    expect(codigos).toContain('CALCULAR_IMPORTE_NETO');
    expect(codigos).toContain('ASIGNAR_VALOR');

    // Idempotent when already seeded
    expect(state.seedDemoPipelineIfEmpty()).toBeFalse();
  });

  /** U-W04: reorder updates orden ascending */
  it('U-W04: reorder updates orden ascending', () => {
    state.setConfiguracionesDraft([
      draftStep({ clientId: 'first', orden: 10, nombre_columna: 'A' }),
      draftStep({ clientId: 'second', orden: 20, nombre_columna: 'B' }),
      draftStep({ clientId: 'third', orden: 30, nombre_columna: 'C' }),
    ]);

    // Move index 0 → 2 (A goes to end)
    state.reorderDraftSteps(0, 2);
    const after = state.getConfiguracionesDraft();
    expect(after.map((d) => d.clientId)).toEqual(['second', 'third', 'first']);
    expect(after.map((d) => d.orden)).toEqual([10, 20, 30]);
    for (let i = 1; i < after.length; i++) {
      expect(after[i].orden).toBeGreaterThan(after[i - 1].orden);
    }
  });

  it('F02-11: setPreview genera recomendaciones pendientes', () => {
    state.setPreview({
      nombreArchivo: 'ausol.csv',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['FECHA', 'HORA', 'PATENTE', 'DISPOSITIVO', 'ESTACION', 'TARIFA', 'BONIFICACION'],
      filasPreview: [
        {
          FECHA: '2026-01-01',
          HORA: '08:30:15',
          PATENTE: 'AB-123',
          DISPOSITIVO: '1',
          ESTACION: 'X',
          TARIFA: '100',
          BONIFICACION: '0',
        },
      ],
      filasOrigen: [],
      tiposInferidos: {},
    });
    const pending = state.recomendacionesPendientes();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.map((r) => r.kind)).toContain('patente');
    expect(state.getConfiguracionesDraft().length).toBe(0);
  });

  it('F02-11: aceptar recomendación escribe draft y no duplica', () => {
    state.setPreview({
      nombreArchivo: 'a.xlsx',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['FECHA', 'HORA', 'PATENTE'],
      filasPreview: [{ FECHA: '2026-01-01', HORA: '08:00:00', PATENTE: 'ab-1' }],
      filasOrigen: [],
      tiposInferidos: {},
    });
    expect(state.aceptarRecomendacion('rec-patente')).toBeTrue();
    const draft = state.getConfiguracionesDraft();
    expect(draft.length).toBe(3);
    expect(state.snapshot().recomendaciones.find((r) => r.id === 'rec-patente')?.status).toBe(
      'accepted'
    );
    expect(state.aceptarRecomendacion('rec-patente')).toBeFalse();
    expect(state.getConfiguracionesDraft().length).toBe(3);
  });

  it('F02-11: descartar oculta pendiente', () => {
    state.setPreview({
      nombreArchivo: 'a.xlsx',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: 'E1' }],
      filasOrigen: [],
      tiposInferidos: {},
    });
    expect(state.descartarRecomendacion('rec-estacion')).toBeTrue();
    expect(state.recomendacionesPendientes().some((r) => r.id === 'rec-estacion')).toBeFalse();
  });
});
