import { AlgoritmoCodigo, TransformStrategy } from './strategy.types';

/**
 * Registro seguro de estrategias (PRD §7.4.3 / RN-20).
 * Solo códigos registrados son resolubles; no ejecuta código desde jsonb.
 */
export class StrategyRegistry {
  private readonly estrategias = new Map<string, TransformStrategy>();

  registrar(strategy: TransformStrategy): void {
    if (this.estrategias.has(strategy.codigo)) {
      throw new Error(`Estrategia ya registrada: ${strategy.codigo}`);
    }
    this.estrategias.set(strategy.codigo, strategy);
  }

  obtener(codigo: string): TransformStrategy {
    const strategy = this.estrategias.get(codigo);
    if (!strategy) {
      throw new Error(`Algoritmo no registrado en StrategyRegistry: ${codigo}`);
    }
    return strategy;
  }

  tiene(codigo: string): codigo is AlgoritmoCodigo {
    return this.estrategias.has(codigo);
  }

  listar(): TransformStrategy[] {
    return Array.from(this.estrategias.values());
  }

  codigos(): string[] {
    return Array.from(this.estrategias.keys());
  }
}
