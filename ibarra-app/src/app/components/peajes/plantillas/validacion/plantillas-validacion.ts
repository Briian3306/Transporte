import {
  AlgoritmoCombinado,
  AlgoritmoCombinadoPaso,
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
  PlantillaConfiguracion,
} from '../../models/peajes.models';
import { EstadoRecursoPeaje } from '../../models/peajes.types';
import { StrategyRegistry } from '../motor/strategy-registry';
import { esRecursoGlobal } from '../mocks/peajes-plantillas.mock';

export interface ResultadoValidacionPublicacion {
  ok: boolean;
  errores: ErrorValidacionPasada[];
}

/**
 * Validaciones previas a publicar plantilla/algoritmo (RF-31, RN-18, RN-20).
 */
export function validarPublicacionPlantilla(
  plantilla: Pick<PlantillaConfiguracion, 'nombre' | 'empresa_id' | 'estado'>,
  configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[],
  registry: StrategyRegistry,
  algoritmos?: AlgoritmoCombinado[]
): ResultadoValidacionPublicacion {
  const errores: ErrorValidacionPasada[] = [];

  if (!plantilla.nombre?.trim()) {
    errores.push({
      fila: 0,
      columna: 'nombre',
      valor: plantilla.nombre,
      motivo: 'El nombre de la plantilla es obligatorio',
    });
  }
  if (!plantilla.empresa_id?.trim()) {
    errores.push({
      fila: 0,
      columna: 'empresa_id',
      valor: plantilla.empresa_id,
      motivo: 'empresa_id es obligatorio',
    });
  }

  const ordenes = new Set<number>();
  for (const cfg of configuraciones) {
    if (ordenes.has(cfg.orden)) {
      errores.push({
        fila: 0,
        columna: 'orden',
        valor: cfg.orden,
        motivo: `Orden duplicado: ${cfg.orden}`,
      });
    }
    ordenes.add(cfg.orden);

    if (cfg.obligatoria && !cfg.nombre_columna && !cfg.columna_destino) {
      errores.push({
        fila: 0,
        columna: 'obligatoria',
        valor: null,
        motivo: 'Columna obligatoria ausente en la definición',
      });
    }

    const codigo = cfg.configuracion?.['algoritmo_codigo'] as string | undefined;
    if (codigo && !registry.tiene(codigo)) {
      errores.push({
        fila: 0,
        columna: cfg.nombre_columna || 'algoritmo_codigo',
        valor: codigo,
        motivo: `Referencia a algoritmo no registrado: ${codigo}`,
      });
    }

    if (cfg.algoritmo_combinado_id && algoritmos) {
      const alg = algoritmos.find((a) => a.id === cfg.algoritmo_combinado_id);
      if (!alg) {
        errores.push({
          fila: 0,
          columna: cfg.nombre_columna || 'algoritmo_combinado_id',
          valor: cfg.algoritmo_combinado_id,
          motivo: `Referencia rota a algoritmo combinado: ${cfg.algoritmo_combinado_id}`,
        });
      } else {
        for (const p of alg.pasos ?? []) {
          if (!registry.tiene(p.algoritmo_codigo)) {
            errores.push({
              fila: 0,
              columna: p.algoritmo_codigo,
              valor: p.algoritmo_codigo,
              motivo: `Paso del algoritmo combinado no registrado: ${p.algoritmo_codigo}`,
            });
          }
        }
      }
    }
  }

  if (plantilla.estado === ('activa' as EstadoRecursoPeaje) && configuraciones.length === 0) {
    errores.push({
      fila: 0,
      columna: 'configuraciones',
      valor: null,
      motivo: 'No se puede publicar una plantilla activa sin configuraciones',
    });
  }

  return { ok: errores.length === 0, errores };
}

export function validarPublicacionAlgoritmo(
  algoritmo: Pick<AlgoritmoCombinado, 'nombre' | 'empresa_id'>,
  pasos: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[],
  registry: StrategyRegistry
): ResultadoValidacionPublicacion {
  const errores: ErrorValidacionPasada[] = [];

  if (!algoritmo.nombre?.trim()) {
    errores.push({
      fila: 0,
      columna: 'nombre',
      valor: algoritmo.nombre,
      motivo: 'El nombre del algoritmo es obligatorio',
    });
  }

  const ordenes = new Set<number>();
  for (const p of pasos) {
    if (ordenes.has(p.orden)) {
      errores.push({
        fila: 0,
        columna: 'orden',
        valor: p.orden,
        motivo: `Orden duplicado en pasos: ${p.orden}`,
      });
    }
    ordenes.add(p.orden);

    if (!registry.tiene(p.algoritmo_codigo)) {
      errores.push({
        fila: 0,
        columna: 'algoritmo_codigo',
        valor: p.algoritmo_codigo,
        motivo: `No se permite referenciar códigos no registrados: ${p.algoritmo_codigo}`,
      });
    }
  }

  if (pasos.length === 0) {
    errores.push({
      fila: 0,
      columna: 'pasos',
      valor: null,
      motivo: 'El algoritmo combinado debe tener al menos un paso',
    });
  }

  return { ok: errores.length === 0, errores };
}

/**
 * Alcance por empresa (RN-22 / RN-23).
 * Una plantilla de empresa A no aplica a B salvo recurso global.
 */
export function puedeAplicarRecurso(
  recursoEmpresaId: string,
  empresaActivaId: string
): boolean {
  if (esRecursoGlobal(recursoEmpresaId)) return true;
  return recursoEmpresaId === empresaActivaId;
}

export function filtrarPorEmpresa<T extends { empresa_id: string }>(
  items: T[],
  empresaId: string
): T[] {
  return items.filter(
    (i) => i.empresa_id === empresaId || esRecursoGlobal(i.empresa_id)
  );
}
