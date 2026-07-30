/** Categoría interna de patente (PRD §11.4). */
export type CategoriaPatente = 'TRANSPORTE' | 'REMIS';

/** Estado de plantilla / algoritmo combinado. */
export type EstadoRecursoPeaje = 'borrador' | 'activa' | 'inactiva';

/** Tipo de fila en configuraciones_plantilla. */
export type TipoConfiguracionPlantilla = 'transformacion' | 'mapeo' | 'validacion';

/**
 * Claves de columnas estándar Pasada-Columns (Structure Goal §11.1).
 * `IMPORTE_NETO` es el nombre canónico de "IMPORTE NETO".
 */
export type PasadaColumnKey =
  | 'PASADA_ID'
  | 'FECHA_HORA'
  | 'PASE_ID'
  | 'PATENTE_ID'
  | 'ESTACION_ID'
  | 'PRECIO'
  | 'BONIFICACION'
  | 'QUANTITY'
  | 'IMPORTE_NETO';

export const PASADA_COLUMN_KEYS: readonly PasadaColumnKey[] = [
  'PASADA_ID',
  'FECHA_HORA',
  'PASE_ID',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
] as const;

/** Columnas obligatorias para avanzar el mapeo (MVP). */
export const PASADA_COLUMNAS_OBLIGATORIAS: readonly PasadaColumnKey[] = [
  'FECHA_HORA',
  'PASE_ID',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
] as const;
