import { Injectable } from '@angular/core';
import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
  PasadaEstandarizada,
  PlantillaMapeoColumna,
} from '../../models/peajes.models';
import { PASADA_COLUMNAS_OBLIGATORIAS, PasadaColumnKey } from '../../models/peajes.types';
import {
  MapeoColumna,
  PeajesMotorTransformacion,
} from '../../models/peajes-services.contracts';
import {
  AlgorithmDescriptor,
  getAlgorithmDescriptors,
  resolverColumnasEntrada,
} from './algorithm-descriptor';
import { createDefaultRegistry, PipelineBuilder } from './pipeline-builder';
import { StrategyRegistry } from './strategy-registry';
import { PasoEjecucion, StrategyContext } from './strategy.types';
import {
  filtrarConfigsHabilitadas,
  validarDependenciasConfigs,
} from '../validacion/dependencias-pipeline';

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

  /** Metadata UI de los 10 códigos atómicos (F03-9). */
  getAlgorithmDescriptors(): AlgorithmDescriptor[] {
    return getAlgorithmDescriptors();
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
    const habilitadas = filtrarConfigsHabilitadas(configuraciones);
    return new PipelineBuilder(this.registry)
      .conConfiguraciones(habilitadas)
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

  /**
   * Aplica solo pasos con `orden <= hastaOrden` (omitendo deshabilitados).
   */
  previsualizarPaso(
    configs: ConfiguracionPlantilla[],
    filas: Record<string, unknown>[],
    hastaOrden: number,
    algoritmos?: AlgoritmoCombinado[]
  ): PasadaEstandarizada[] {
    const subset = filtrarConfigsHabilitadas(configs).filter(
      (c) => c.orden <= hastaOrden
    );
    return this.aplicarPipeline(filas, subset, algoritmos);
  }

  /**
   * Fuentes ausentes, use-before-create, ciclos entre productores, outputs vacíos.
   */
  validarDependenciasPipeline(
    configs: ConfiguracionPlantilla[],
    columnasOrigen: string[],
    algoritmos?: AlgoritmoCombinado[]
  ): ErrorValidacionPasada[] {
    return validarDependenciasConfigs(configs, columnasOrigen, algoritmos);
  }

  validarDefinicionPlantilla(
    configuraciones: ConfiguracionPlantilla[],
    columnasDisponibles: string[],
    algoritmos?: AlgoritmoCombinado[],
    mapeos?: PlantillaMapeoColumna[] | MapeoColumna[]
  ): ErrorValidacionPasada[] {
    const errores: ErrorValidacionPasada[] = [];
    const disponibles = new Set(columnasDisponibles.map((c) => c.toUpperCase()));
    const mapeosActivos = (mapeos ?? []).filter((m) => !m.excluida && !!m.columnaDestino);

    // Órdenes duplicados en el pipeline (sobre todas las configs, incl. deshabilitadas)
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
      const codigo = cfg.configuracion?.['algoritmo_codigo'] as string | undefined;
      if (codigo && !this.registry.tiene(codigo)) {
        errores.push({
          fila: 0,
          columna: cfg.nombre_columna,
          valor: codigo,
          motivo: `Algoritmo no registrado en StrategyRegistry: ${codigo}`,
        });
      }

      const colsParam = resolverColumnasEntrada(cfg.configuracion);
      if (colsParam.length) {
        for (const col of colsParam) {
          if (!disponibles.has(col.toUpperCase()) && !columnasDisponibles.includes(col)) {
            // Puede ser producida por otro paso — lo cubre validarDependenciasPipeline
            // Aquí solo marcamos si claramente no está y no es transformación generada.
            if (!esColumnaGenerada(cfg) && cfg.tipo !== 'transformacion') {
              errores.push({
                fila: 0,
                columna: col,
                valor: null,
                motivo: `Columna requerida por la plantilla no está en el archivo: ${col}`,
              });
            }
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

    // Columnas producidas por el pipeline (válidas como origen de mapeo post-transformación)
    const producidasPipeline = new Set<string>();
    for (const c of configuraciones) {
      if (c.nombre_columna) producidasPipeline.add(c.nombre_columna.toUpperCase());
      if (c.columna_destino) producidasPipeline.add(c.columna_destino.toUpperCase());
    }

    // Origen de mapeos activos debe existir en el archivo o ser salida del pipeline
    for (const m of mapeosActivos) {
      const origen = m.columnaOrigen;
      if (
        !disponibles.has(origen.toUpperCase()) &&
        !columnasDisponibles.includes(origen) &&
        !producidasPipeline.has(origen.toUpperCase())
      ) {
        errores.push({
          fila: 0,
          columna: origen,
          valor: null,
          motivo: `La columna de origen «${origen}» (mapeo a ${m.columnaDestino}) no está en el archivo`,
        });
      }
    }

    // Destinos obligatorios: pipeline (`configuraciones`) o snapshot Paso 5 (`mapeos`)
    const destinosPipeline = new Set(
      configuraciones
        .map((c) => c.columna_destino)
        .filter((d): d is string => !!d)
    );
    const destinosMapeo = new Set(
      mapeosActivos.map((m) => m.columnaDestino as string)
    );
    for (const obl of PASADA_COLUMNAS_OBLIGATORIAS) {
      const tieneDestino = destinosPipeline.has(obl) || destinosMapeo.has(obl);
      const tieneNombre = configuraciones.some(
        (c) => c.nombre_columna === obl || c.columna_destino === obl
      );
      if (!tieneDestino && !tieneNombre) {
        if (configuraciones.length > 0 || mapeosActivos.length > 0) {
          errores.push({
            fila: 0,
            columna: obl,
            valor: null,
            motivo: `Columna obligatoria no mapeada en la plantilla: ${obl}`,
          });
        }
      }
    }

    errores.push(
      ...this.validarDependenciasPipeline(
        configuraciones,
        columnasDisponibles,
        algoritmos
      )
    );

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

    for (const cfg of filtrarConfigsHabilitadas(configuraciones)) {
      const requeridas: string[] = [];
      const paramCols = resolverColumnasEntrada(cfg.configuracion);
      if (paramCols.length) {
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
        if (paso.columnaOrigen && paso.columnaOrigen !== destino) {
          if (
            paso.algoritmoCodigo === 'BORRAR_ESPACIOS' ||
            paso.algoritmoCodigo === 'ELIMINAR_GUIONES' ||
            paso.algoritmoCodigo === 'CONVERTIR_MAYUSCULAS' ||
            paso.algoritmoCodigo === 'REEMPLAZAR_TEXTO'
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
  return (
    codigo === 'COPIAR_COLUMNA' ||
    codigo === 'CONVERTIR_TEXTO' ||
    codigo === 'CONVERTIR_NUMERO' ||
    codigo === 'CONVERTIR_NUMERO_ARS' ||
    cfg.tipo === 'mapeo'
  );
}

/** Factory helper para tests sin DI. */
export function crearMotor(): PeajesMotorTransformacionService {
  return new PeajesMotorTransformacionService();
}

export type { PasadaColumnKey };
