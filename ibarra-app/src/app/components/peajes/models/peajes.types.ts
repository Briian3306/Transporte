/** Categoría interna de patente (PRD §11.4). */
export type CategoriaPatente = 'FLOTA CAMIONES' | 'FLOTA UTILITARIA' | 'REMIS' | 'OBRA' | 'AUTO';

/** Estado de plantilla / algoritmo combinado. */
export type EstadoRecursoPeaje = 'borrador' | 'activa' | 'inactiva';

/** Tipo de documento de peajes (FC factura / NC nota de crédito). */
export type DocumentoTipo = 'FC' | 'NC';

export const DOCUMENTO_TIPOS: readonly DocumentoTipo[] = ['FC', 'NC'] as const;

/** Tipo de fila en configuraciones_plantilla. */
export type TipoConfiguracionPlantilla = 'transformacion' | 'mapeo' | 'validacion';

/**
 * Claves de columnas estándar Pasada-Columns (Structure Goal §11.1).
 * `IMPORTE_NETO` es el nombre canónico de "IMPORTE NETO".
 * `CATEGORIA` es opcional (F14 / RN-15): texto crudo del proveedor; Patrón B si se mapea.
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
  | 'IMPORTE_NETO'
  | 'CATEGORIA';

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
  'CATEGORIA',
] as const;

/** Columnas obligatorias para avanzar el mapeo. CATEGORIA y PASE_ID son opcionales (Patrón A / sin dispositivo). */
export const PASADA_COLUMNAS_OBLIGATORIAS: readonly PasadaColumnKey[] = [
  'FECHA_HORA',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
] as const;
