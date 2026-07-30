import { Injectable } from '@angular/core';
import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
  PasadaEstandarizada,
} from '../../models/peajes.models';
import { PASADA_COLUMNAS_OBLIGATORIAS, PasadaColumnKey } from '../../models/peajes.types';
import { PeajesMotorTransformacion } from '../../models/peajes-services.contracts';
import { createDefaultRegistry, PipelineBuilder } from './pipeline-builder';
import { StrategyRegistry } from './strategy-registry';
import { PasoEjecucion, StrategyContext } from './strategy.types';

/**
 * Motor de transformación Peajes (Agente 03).
 * Implementa PeajesMotorTransformacion — el wizard solo consume esta interfaz.
 */
@Injectable({ providedIn: 'root' })
export class PeajesMotorTransformacionService implements PeajesMotorTransformacion {
  private readonly registry: StrategyRegistry = createDefaultRegistry();

  getRegistry(): StrategyRegistry {
    return this.registry;
  }

  /**
   * Expande un algoritmo combinado a pasos efectivos (RF-30).
   * Valida que cada código esté en el registry.
   */
  expandirAlgoritmo(algoritmo: AlgoritmoCombinado): PasoEjecucion[] {
    const pasos = [...(algoritmo.pasos ?? [])].sort((a, b) => a.orden - b.orden);
    return pasos.map((p) => {
      if (!this.registry.tiene(p.algoritmo_codigo)) {
        throw new Error(
          `Algoritmo no registrado en StrategyRegistry: ${p.algoritmo_codigo}`
        );
      }
      return {
        orden: p.orden,
        algoritmoCodigo: p.algoritmo_codigo as PasoEjecucion['algoritmoCodigo'],
        parametros: p.parametros ?? null,
        origen: `algoritmo:${algoritmo.id}:${p.id}`,
      };
    });
  }

  construirPipeline(
    configuraciones: ConfiguracionPlantilla[],
    algoritmos?: AlgoritmoCombinado[]
  ): PasoEjecucion[] {
    return new PipelineBuilder(this.registry)
      .conConfiguraciones(configuraciones)
      .conAlgoritmos(algoritmos ?? [])
      .build();
  }

  aplicarPipeline(
    filas: Record<string, unknown>[],
    configuraciones: ConfiguracionPlantilla[],
    algoritmos?: AlgoritmoCombinado[]
  ): PasadaEstandarizada[] {
    const pasos = this.construirPipeline(configuraciones, algoritmos);
    return filas.map((fila) => this.aplicarPasosAFila(fila, pasos));
  }

  validarDefinicionPlantilla(
    configuraciones: ConfiguracionPlantilla[],
    columnasDisponibles: string[]
  ): ErrorValidacionPasada[] {
    const errores: ErrorValidacionPasada[] = [];
    const disponibles = new Set(columnasDisponibles.map((c) => c.toUpperCase()));

    // Órdenes duplicados en el pipeline
    const ordenes = configuraciones.map((c) => c.orden);
    const vistos = new Set<number>();
    for (const o of ordenes) {
      if (vistos.has(o)) {
        errores.push({
          fila: 0,
          columna: 'orden',
          valor: o,
          motivo: `Orden duplicado en la plantilla: ${o}`,
        });
      }
      vistos.add(o);
    }

    for (const cfg of configuraciones) {
      // Referencias a algoritmos en configuracion.algoritmo_codigo
      const codigo = cfg.configuracion?.['algoritmo_codigo'] as string | undefined;
      if (codigo && !this.registry.tiene(codigo)) {
        errores.push({
          fila: 0,
          columna: cfg.nombre_columna,
          valor: codigo,
          motivo: `Algoritmo no registrado en StrategyRegistry: ${codigo}`,
        });
      }

      // Columnas de origen requeridas por parámetros
      const colsParam = cfg.configuracion?.['columnas'] as string[] | undefined;
      if (colsParam) {
        for (const col of colsParam) {
          if (!disponibles.has(col.toUpperCase()) && !columnasDisponibles.includes(col)) {
            errores.push({
              fila: 0,
              columna: col,
              valor: null,
              motivo: `Columna requerida por la plantilla no está en el archivo: ${col}`,
            });
          }
        }
      } else if (
        cfg.nombre_columna &&
        cfg.tipo !== 'transformacion' &&
        !disponibles.has(cfg.nombre_columna.toUpperCase()) &&
        !esColumnaGenerada(cfg)
      ) {
        if (cfg.obligatoria) {
          errores.push({
            fila: 0,
            columna: cfg.nombre_columna,
            valor: null,
            motivo: `Columna obligatoria ausente en el archivo: ${cfg.nombre_columna}`,
          });
        }
      }

      if (cfg.obligatoria && !cfg.columna_destino && !cfg.nombre_columna) {
        errores.push({
          fila: 0,
          columna: 'obligatoria',
          valor: null,
          motivo: 'Configuración obligatoria sin columna de destino',
        });
      }
    }

    // Destinos obligatorios del Structure Goal presentes en el mapeo
    const destinos = new Set(
      configuraciones
        .map((c) => c.columna_destino)
        .filter((d): d is string => !!d)
    );
    for (const obl of PASADA_COLUMNAS_OBLIGATORIAS) {
      const tieneDestino = destinos.has(obl);
      const tieneNombre = configuraciones.some(
        (c) => c.nombre_columna === obl || c.columna_destino === obl
      );
      if (!tieneDestino && !tieneNombre) {
        // Solo advertir si la plantilla declara publicar (activa) — caller decide
        // Aquí reportamos ausencia de mapeo obligatorio cuando hay configs.
        if (configuraciones.length > 0) {
          errores.push({
            fila: 0,
            columna: obl,
            valor: null,
            motivo: `Columna obligatoria no mapeada en la plantilla: ${obl}`,
          });
        }
      }
    }

    return errores;
  }

  /**
   * Compatibilidad plantilla ↔ columnas del archivo (RF-13 / RN-21).
   */
  validarCompatibilidad(
    configuraciones: ConfiguracionPlantilla[],
    columnasArchivo: string[]
  ): ErrorValidacionPasada[] {
    const cols = new Set(columnasArchivo.map((c) => c.toUpperCase()));
    const errores: ErrorValidacionPasada[] = [];

    for (const cfg of configuraciones) {
      const requeridas: string[] = [];
      const paramCols = cfg.configuracion?.['columnas'] as string[] | undefined;
      if (paramCols?.length) {
        requeridas.push(...paramCols);
      } else if (cfg.nombre_columna && necesitaColumnaOrigen(cfg)) {
        requeridas.push(cfg.nombre_columna);
      }

      for (const col of requeridas) {
        if (!cols.has(col.toUpperCase())) {
          errores.push({
            fila: 0,
            columna: col,
            valor: null,
            motivo: `Columna faltante requerida por la plantilla: ${col}`,
          });
        }
      }
    }
    return errores;
  }

  private aplicarPasosAFila(
    fila: Record<string, unknown>,
    pasos: PasoEjecucion[]
  ): PasadaEstandarizada {
    const resultado: Record<string, unknown> = {};

    for (const paso of pasos) {
      const strategy = this.registry.obtener(paso.algoritmoCodigo);
      const ctx: StrategyContext = {
        fila,
        resultado,
        parametros: paso.parametros,
        columnaOrigen: paso.columnaOrigen,
        columnaDestino: paso.columnaDestino,
      };
      const valor = strategy.ejecutar(ctx);
      const destino = paso.columnaDestino ?? paso.columnaOrigen;
      if (destino) {
        resultado[destino] = valor;
        // Si normalizamos sobre la misma columna origen (p.ej. DOMINIO → PATENTE_ID),
        // también actualizamos origen para cadenas de pasos del algoritmo combinado.
        if (paso.columnaOrigen && paso.columnaOrigen !== destino) {
          // Mantener valor intermedio en origen solo si es la misma semántica de normalización
          if (
            paso.algoritmoCodigo === 'BORRAR_ESPACIOS' ||
            paso.algoritmoCodigo === 'ELIMINAR_GUIONES' ||
            paso.algoritmoCodigo === 'CONVERTIR_MAYUSCULAS'
          ) {
            resultado[paso.columnaOrigen] = valor;
          }
        } else if (paso.columnaOrigen) {
          resultado[paso.columnaOrigen] = valor;
        }
      }
    }

    return resultado as PasadaEstandarizada;
  }
}

function esColumnaGenerada(cfg: ConfiguracionPlantilla): boolean {
  const codigo = cfg.configuracion?.['algoritmo_codigo'];
  return (
    codigo === 'ASIGNAR_VALOR' ||
    codigo === 'CALCULAR_IMPORTE_NETO' ||
    codigo === 'FORMATEAR_FECHA_HORA' ||
    codigo === 'COMBINAR_COLUMNAS' ||
    !!cfg.algoritmo_combinado_id
  );
}

function necesitaColumnaOrigen(cfg: ConfiguracionPlantilla): boolean {
  if (esColumnaGenerada(cfg)) return false;
  const codigo = cfg.configuracion?.['algoritmo_codigo'];
  return codigo === 'COPIAR_COLUMNA' || codigo === 'CONVERTIR_TEXTO' || codigo === 'CONVERTIR_NUMERO' || cfg.tipo === 'mapeo';
}

/** Factory helper para tests sin DI. */
export function crearMotor(): PeajesMotorTransformacionService {
  return new PeajesMotorTransformacionService();
}

export type { PasadaColumnKey };
