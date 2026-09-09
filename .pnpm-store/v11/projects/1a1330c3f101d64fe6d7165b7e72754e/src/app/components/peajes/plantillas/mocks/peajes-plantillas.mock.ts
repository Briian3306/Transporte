import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  AlgoritmoCombinado,
  AlgoritmoCombinadoPaso,
  ConfiguracionPlantilla,
  PlantillaConfiguracion,
  PlantillaEstacionReconocida,
  PlantillaMapeoColumna,
} from '../../models/peajes.models';
import { PeajesPlantillasService } from '../../models/peajes-services.contracts';
import { EstadoRecursoPeaje } from '../../models/peajes.types';

/**
 * Mock tipado de PeajesPlantillasService (hasta F01-3/4/7/8 passing).
 * Contrato requerido de 01: implementar esta interfaz contra Supabase.
 * Ver docs/session-handoff.md.
 */
@Injectable({ providedIn: 'root' })
export class PeajesPlantillasMockService implements PeajesPlantillasService {
  private plantillas = new Map<string, PlantillaConfiguracion>();
  private algoritmos = new Map<string, AlgoritmoCombinado>();
  private seq = 1;

  constructor() {
    this.seedDemo();
  }

  listarPlantillas(empresaId?: string): Observable<PlantillaConfiguracion[]> {
    let list = Array.from(this.plantillas.values());
    if (empresaId) {
      list = list.filter(
        (p) => p.empresa_id === empresaId || p.empresa_id === GLOBAL_EMPRESA_ID
      );
    }
    return of(list).pipe(delay(10));
  }

  obtenerPlantilla(id: string): Observable<PlantillaConfiguracion | null> {
    return of(this.plantillas.get(id) ?? null).pipe(delay(10));
  }

  guardarPlantilla(
    plantilla: Omit<
      PlantillaConfiguracion,
      'id' | 'created_at' | 'updated_at' | 'configuraciones'
    > & { id?: string },
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[],
    mapeos?: PlantillaMapeoColumna[],
    estacionesReconocidas?: Omit<PlantillaEstacionReconocida, 'id' | 'plantilla_id' | 'created_at'>[]
  ): Observable<PlantillaConfiguracion> {
    const now = new Date().toISOString();
    const id = plantilla.id ?? `plt-${this.seq++}`;
    const configs: ConfiguracionPlantilla[] = configuraciones.map((c, i) => ({
      ...c,
      id: `cfg-${id}-${i}`,
      plantilla_id: id,
    }));
    const saved: PlantillaConfiguracion = {
      id,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion ?? null,
      empresa_id: plantilla.empresa_id,
      estrategia_codigo: plantilla.estrategia_codigo ?? null,
      estado: plantilla.estado,
      created_at: this.plantillas.get(id)?.created_at ?? now,
      updated_at: now,
      configuraciones: configs,
      mapeos: structuredClone(mapeos ?? this.plantillas.get(id)?.mapeos ?? []),
      estaciones_reconocidas: (estacionesReconocidas ?? this.plantillas.get(id)?.estaciones_reconocidas ?? []).map((r, i) => ({
        ...r, id: `est-${id}-${i}`, plantilla_id: id, created_at: now,
      })),
    };
    this.plantillas.set(id, saved);
    return of(saved).pipe(delay(10));
  }

  sobrescribirConfiguraciones(
    plantillaId: string,
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[]
  ): Observable<ConfiguracionPlantilla[]> {
    const existing = this.plantillas.get(plantillaId);
    if (!existing) {
      return throwError(() => new Error(`Plantilla no encontrada: ${plantillaId}`));
    }
    const configs: ConfiguracionPlantilla[] = configuraciones.map((c, i) => ({
      ...c,
      id: `cfg-${plantillaId}-${i}-${Date.now()}`,
      plantilla_id: plantillaId,
    }));
    existing.configuraciones = configs;
    existing.updated_at = new Date().toISOString();
    this.plantillas.set(plantillaId, existing);
    return of(configs).pipe(delay(10));
  }

  listarAlgoritmos(empresaId?: string): Observable<AlgoritmoCombinado[]> {
    let list = Array.from(this.algoritmos.values());
    if (empresaId) {
      list = list.filter(
        (a) => a.empresa_id === empresaId || a.empresa_id === GLOBAL_EMPRESA_ID
      );
    }
    return of(list).pipe(delay(10));
  }

  guardarAlgoritmo(
    algoritmo: Omit<
      AlgoritmoCombinado,
      'id' | 'created_at' | 'updated_at' | 'pasos'
    > & { id?: string },
    pasos: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[]
  ): Observable<AlgoritmoCombinado> {
    const now = new Date().toISOString();
    const id = algoritmo.id ?? `alg-${this.seq++}`;
    const pasosSaved: AlgoritmoCombinadoPaso[] = pasos.map((p, i) => ({
      ...p,
      id: `paso-${id}-${i}`,
      algoritmo_combinado_id: id,
    }));
    const saved: AlgoritmoCombinado = {
      id,
      nombre: algoritmo.nombre,
      descripcion: algoritmo.descripcion ?? null,
      empresa_id: algoritmo.empresa_id,
      estado: algoritmo.estado,
      created_at: this.algoritmos.get(id)?.created_at ?? now,
      updated_at: now,
      pasos: pasosSaved,
    };
    this.algoritmos.set(id, saved);
    return of(saved).pipe(delay(10));
  }

  expandirAlgoritmo(algoritmoId: string): Observable<AlgoritmoCombinadoPaso[]> {
    return of(null).pipe(
      delay(10),
      map(() => {
        const alg = this.algoritmos.get(algoritmoId);
        if (!alg) throw new Error(`Algoritmo no encontrado: ${algoritmoId}`);
        return [...(alg.pasos ?? [])].sort((a, b) => a.orden - b.orden);
      })
    );
  }

  /** Acceso de test / seed. */
  reset(): void {
    this.plantillas.clear();
    this.algoritmos.clear();
    this.seq = 1;
    this.seedDemo();
  }

  private seedDemo(): void {
    const normalizarPatente: AlgoritmoCombinado = {
      id: 'alg-normalizar-patente',
      nombre: 'NORMALIZAR_PATENTE',
      descripcion: 'Borrar espacios + eliminar guiones + mayúsculas',
      empresa_id: GLOBAL_EMPRESA_ID,
      estado: 'activa',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      pasos: [
        {
          id: 'paso-np-1',
          algoritmo_combinado_id: 'alg-normalizar-patente',
          orden: 1,
          algoritmo_codigo: 'BORRAR_ESPACIOS',
        },
        {
          id: 'paso-np-2',
          algoritmo_combinado_id: 'alg-normalizar-patente',
          orden: 2,
          algoritmo_codigo: 'ELIMINAR_GUIONES',
        },
        {
          id: 'paso-np-3',
          algoritmo_combinado_id: 'alg-normalizar-patente',
          orden: 3,
          algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
        },
      ],
    };
    this.algoritmos.set(normalizarPatente.id, normalizarPatente);

    const combinarFechaHora: AlgoritmoCombinado = {
      id: 'alg-combinar-fecha-hora',
      nombre: 'COMBINAR_FECHA_HORA',
      descripcion: 'Combina FECHA + HORA (HHMMSS)',
      empresa_id: GLOBAL_EMPRESA_ID,
      estado: 'activa',
      pasos: [
        {
          id: 'paso-cfh-1',
          algoritmo_combinado_id: 'alg-combinar-fecha-hora',
          orden: 1,
          algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
          parametros: { columnas: ['FECHA', 'HORA'], formato_hora: 'HHMMSS' },
        },
      ],
    };
    this.algoritmos.set(combinarFechaHora.id, combinarFechaHora);

    const plantillaDemo = buildPlantillaDemoProveedor(normalizarPatente.id, combinarFechaHora.id);
    this.plantillas.set(plantillaDemo.id, plantillaDemo);
  }
}

/** Marcador de recurso global (RN-23). Contrato: 01 puede usar empresa_id especial o flag. */
export const GLOBAL_EMPRESA_ID = '__global__';

export function esRecursoGlobal(empresaId: string): boolean {
  return empresaId === GLOBAL_EMPRESA_ID;
}

export function buildPlantillaDemoProveedor(
  algPatenteId: string,
  algFechaId: string,
  empresaId = 'empresa-demo'
): PlantillaConfiguracion {
  return {
    id: 'plt-demo-pasadas',
    nombre: 'Proveedor Demo - Pasadas',
    descripcion: 'Normaliza archivos con FECHA y HORA separadas (caso §21)',
    empresa_id: empresaId,
    estrategia_codigo: 'PROVEEDOR_DEMO',
    estado: 'activa' as EstadoRecursoPeaje,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    configuraciones: [
      {
        id: 'cfg-1',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        tipo: 'transformacion',
        algoritmo_combinado_id: algFechaId,
        configuracion: { columnas: ['FECHA', 'HORA'], formato_hora: 'HHMMSS' },
        obligatoria: true,
      },
      {
        id: 'cfg-2',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'DISPOSITIVON',
        columna_destino: 'PASE_ID',
        orden: 20,
        tipo: 'transformacion',
        configuracion: { algoritmo_codigo: 'CONVERTIR_TEXTO', columna: 'DISPOSITIVON' },
        obligatoria: true,
      },
      {
        id: 'cfg-3',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'DOMINIO',
        columna_destino: 'PATENTE_ID',
        orden: 30,
        tipo: 'transformacion',
        algoritmo_combinado_id: algPatenteId,
        configuracion: { mayusculas: true },
        obligatoria: true,
      },
      {
        id: 'cfg-4',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'ESTACION',
        columna_destino: 'ESTACION_ID',
        orden: 40,
        tipo: 'mapeo',
        configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'ESTACION' },
        obligatoria: true,
      },
      {
        id: 'cfg-5',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 50,
        tipo: 'transformacion',
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
        obligatoria: true,
      },
      {
        id: 'cfg-6',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'BONIFICACION',
        columna_destino: 'BONIFICACION',
        orden: 60,
        tipo: 'transformacion',
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'BONIFICACION' },
        obligatoria: true,
      },
      {
        id: 'cfg-7',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'QUANTITY',
        columna_destino: 'QUANTITY',
        orden: 70,
        tipo: 'transformacion',
        configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
        obligatoria: true,
      },
      {
        id: 'cfg-8',
        plantilla_id: 'plt-demo-pasadas',
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 80,
        tipo: 'transformacion',
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          precio_columna: 'PRECIO',
          bonificacion_columna: 'BONIFICACION',
        },
        obligatoria: true,
      },
    ],
  };
}

/** Fila del caso de aceptación PRD §21.1 */
export const FILA_EJEMPLO_PRD_21: Record<string, unknown> = {
  FECHA: '25/06/2026',
  HORA: '205005',
  ESTACION: '3',
  DISPOSITIVON: 98702170,
  DOMINIO: 'AD625QB',
  TARIFA: 17400,
  BONIFICACION: 5220,
};

export const COLUMNAS_ARCHIVO_DEMO = [
  'FECHA',
  'HORA',
  'ESTACION',
  'VIA',
  'DISPOSITIVOT',
  'DISPOSITIVON',
  'DOMINIO',
  'CATEGORIA',
  'TARIFA',
  'BONIFICACION',
];
