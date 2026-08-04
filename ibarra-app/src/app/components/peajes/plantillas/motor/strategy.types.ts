/**
 * Contratos del motor Strategy (Agente 03).
 * Códigos estables — no dependen del texto de UI (PRD §7.4.2).
 */

export const ALGORITMO_CODIGOS = [
  'BORRAR_ESPACIOS',
  'ELIMINAR_GUIONES',
  'CONVERTIR_MAYUSCULAS',
  'REEMPLAZAR_TEXTO',
  'COMBINAR_COLUMNAS',
  'FORMATEAR_FECHA_HORA',
  'CALCULAR_IMPORTE_NETO',
  'ELIMINAR_IVA',
  'OPERAR_NUMERO',
  'CONVERTIR_NUMERO',
  'CONVERTIR_TEXTO',
  'ASIGNAR_VALOR',
  'COPIAR_COLUMNA',
] as const;

export type AlgoritmoCodigo = (typeof ALGORITMO_CODIGOS)[number];

export interface StrategyContext {
  /** Fila original del archivo. */
  fila: Record<string, unknown>;
  /** Acumulado de columnas estandarizadas / intermedias. */
  resultado: Record<string, unknown>;
  parametros?: Record<string, unknown> | null;
  columnaOrigen?: string | null;
  columnaDestino?: string | null;
}

export interface TransformStrategy {
  readonly codigo: AlgoritmoCodigo;
  readonly nombre: string;
  readonly descripcion: string;
  ejecutar(ctx: StrategyContext): unknown;
}

/** Paso efectivo tras expandir algoritmos combinados. */
export interface PasoEjecucion {
  orden: number;
  algoritmoCodigo: AlgoritmoCodigo;
  parametros?: Record<string, unknown> | null;
  columnaOrigen?: string | null;
  columnaDestino?: string | null;
  /** Origen del paso (config id o algoritmo combinado). */
  origen?: string;
}
