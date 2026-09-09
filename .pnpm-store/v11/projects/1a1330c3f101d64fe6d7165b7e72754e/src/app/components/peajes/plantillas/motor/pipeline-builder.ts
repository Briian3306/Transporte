import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
} from '../../models/peajes.models';
import { normalizarParametrosConfig } from './algorithm-descriptor';
import { StrategyRegistry } from './strategy-registry';
import { ESTRATEGIAS_ATOMICAS } from './strategies/estrategias-atomicas';
import { AlgoritmoCodigo, PasoEjecucion } from './strategy.types';

/**
 * Builder del pipeline (PRD §7.4.3).
 * Ordena por `orden` ascendente, expande algoritmos combinados y valida códigos.
 */
export class PipelineBuilder {
  private configuraciones: ConfiguracionPlantilla[] = [];
  private algoritmos: AlgoritmoCombinado[] = [];
  private readonly registry: StrategyRegistry;

  constructor(registry?: StrategyRegistry) {
    this.registry = registry ?? createDefaultRegistry();
  }

  getRegistry(): StrategyRegistry {
    return this.registry;
  }

  conConfiguraciones(configs: ConfiguracionPlantilla[]): this {
    this.configuraciones = [...configs];
    return this;
  }

  conAlgoritmos(algoritmos: AlgoritmoCombinado[]): this {
    this.algoritmos = [...algoritmos];
    return this;
  }

  /**
   * Expande la definición a pasos efectivos ordenados.
   * No muta el registry.
   */
  build(): PasoEjecucion[] {
    const sorted = [...this.configuraciones]
      .filter((c) => c.configuracion?.['habilitado'] !== false)
      .sort((a, b) => a.orden - b.orden);
    const pasos: PasoEjecucion[] = [];
    let seq = 0;

    for (const cfg of sorted) {
      if (cfg.algoritmo_combinado_id) {
        const alg = this.algoritmos.find((a) => a.id === cfg.algoritmo_combinado_id);
        if (!alg) {
          throw new Error(
            `Algoritmo combinado no encontrado: ${cfg.algoritmo_combinado_id}`
          );
        }
        const pasosAlg = [...(alg.pasos ?? [])].sort((a, b) => a.orden - b.orden);
        for (const p of pasosAlg) {
          this.assertRegistrado(p.algoritmo_codigo);
          pasos.push({
            orden: cfg.orden * 1000 + p.orden,
            algoritmoCodigo: p.algoritmo_codigo as AlgoritmoCodigo,
            parametros: mergeParams(cfg.configuracion, p.parametros),
            columnaOrigen: cfg.nombre_columna,
            columnaDestino: (cfg.columna_destino as string) ?? cfg.nombre_columna,
            origen: `algoritmo:${alg.id}:${p.id}`,
          });
          seq++;
        }
        continue;
      }

      const codigo =
        (cfg.configuracion?.['algoritmo_codigo'] as string | undefined) ??
        inferCodigoDesdeTipo(cfg);

      if (!codigo) {
        throw new Error(
          `Configuración sin algoritmo_codigo ni algoritmo_combinado_id (orden=${cfg.orden})`
        );
      }
      this.assertRegistrado(codigo);
      pasos.push({
        orden: cfg.orden * 1000 + seq,
        algoritmoCodigo: codigo as AlgoritmoCodigo,
        parametros: normalizarParametrosConfig(cfg.configuracion),
        columnaOrigen: cfg.nombre_columna,
        columnaDestino: (cfg.columna_destino as string) ?? cfg.nombre_columna,
        origen: `config:${cfg.id || cfg.orden}`,
      });
      seq++;
    }

    return pasos.sort((a, b) => a.orden - b.orden);
  }

  private assertRegistrado(codigo: string): void {
    if (!this.registry.tiene(codigo)) {
      throw new Error(`Algoritmo no registrado en StrategyRegistry: ${codigo}`);
    }
  }
}

export function createDefaultRegistry(): StrategyRegistry {
  const registry = new StrategyRegistry();
  for (const s of ESTRATEGIAS_ATOMICAS) {
    registry.registrar(s);
  }
  return registry;
}

function mergeParams(
  a?: Record<string, unknown> | null,
  b?: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!a && !b) return null;
  return normalizarParametrosConfig({ ...(a ?? {}), ...(b ?? {}) });
}

function inferCodigoDesdeTipo(cfg: ConfiguracionPlantilla): string | null {
  if (cfg.tipo === 'mapeo') return 'COPIAR_COLUMNA';
  return null;
}
