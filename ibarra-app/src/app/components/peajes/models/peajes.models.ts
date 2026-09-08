import {
  CategoriaPatente,
  DocumentoTipo,
  EstadoRecursoPeaje,
  PasadaColumnKey,
  TipoConfiguracionPlantilla,
} from './peajes.types';

/** Empresa/proveedor de peajes (tabla empresas). */
export interface Empresa {
  id: string;
  nombre: string;
  descripcion?: string | null;
  /** URL pública de tarifas (http/https). */
  tarifa_url?: string | null;
  created_at?: string;
}

/** Catálogo Peaje (PRD §11.5 / tabla peajes). */
export interface Peaje {
  id: string;
  nombre: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  empresa_id?: string | null;
  created_at?: string;
}

/**
 * Estación pertenece a un peaje (PRD §11.6 / §12.1).
 * La pasada referencia estación; el peaje se deriva desde aquí.
 */
export interface Estacion {
  id: string;
  peaje_id: string;
  nombre: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  /** Códigos/nombres del proveedor para sugerencia de match (RF-17). */
  codigos_proveedor?: string[] | null;
  latitud?: number | null;
  longitud?: number | null;
  camino?: string | null;
  estado_geocodificacion?: 'OK' | 'REVIEW';
  created_at?: string;
  /** Join opcional. */
  peaje?: Peaje;
}

/** Alias normalizado y confirmado para resolver nombres heterogéneos del proveedor. */
export interface EstacionAliasProveedor {
  id: string;
  empresa_id: string;
  estacion_id: string;
  valor_proveedor: string;
  valor_normalizado: string;
  origen?: 'seed' | 'usuario' | 'plantilla';
  created_at?: string;
}

export interface ResultadoReconocimientoEstacion {
  valorProveedor: string;
  tipo: 'exacta' | 'sugerencias' | 'sin_coincidencia';
  estacion?: Estacion | null;
  sugerencias: Estacion[];
}

export interface Patente {
  id: string;
  patente: string;
  categoria: CategoriaPatente;
  tipo_trabajo?: string | null;
  activa: boolean;
  created_at?: string;
}

export interface Pase {
  id: string;
  pase: string;
  patente_id: string;
  created_at?: string;
  patente?: Patente;
}

/** Documento / Bill (PRD §11.2 → documentos; FC o NC). */
export interface Documento {
  id: string;
  /** Número de documento (columna Excel FACTURA / formulario). */
  factura: string;
  /** Opcional; NULL/vacío permitido en DB. */
  cuenta: string | null;
  empresa_id: string;
  fecha_factura: string;
  tipo: DocumentoTipo;
  importe_sin_iva: number;
  /**
   * Bonificación de cabecera (manual desde la factura PDF; no viene del Excel).
   * Conciliación: Σ IMPORTE_NETO − bonificacion ≈ importe_sin_iva.
   */
  bonificacion: number;
  /** Percepciones declaradas en el documento. */
  percepciones: number;
  /** IVA declarado en el documento. */
  iva: number;
  importe_total: number;
  created_at?: string;
}

/**
 * Pasada persistida (PRD §11.1 + §12).
 * Referencia estacion_id (no peaje_id directo). documento_id es FK técnica (§13.5).
 */
export interface Pasada {
  id: string;
  fecha_hora: string;
  pase_id: string;
  patente_id: string;
  estacion_id: string;
  documento_id: string;
  precio: number;
  bonificacion: number;
  quantity: number;
  importe_neto: number;
  created_at?: string;
  /** Usuario que creó el registro (auth.uid()). */
  user_id?: string | null;
  /** Nombre del archivo de carga (auditoría). */
  file_upload_name?: string | null;
  /** TRUE si se insertó con consentimiento de duplicado (F18-2). */
  duplicado?: boolean;
  estacion?: Estacion;
  documento?: Documento;
}

/** Fila de la vista `pasadas_gestion` / RPC listar. */
export interface PasadaGestion extends Pasada {
  estacion_nombre: string;
  estacion_latitud?: number | null;
  estacion_longitud?: number | null;
  peaje_id: string;
  peaje_nombre: string;
  empresa_id?: string | null;
  empresa_nombre?: string | null;
  patente_codigo: string;
  patente_categoria?: string | null;
  pase_codigo: string;
  documento_numero: string;
  documento_cuenta?: string | null;
  documento_tipo?: DocumentoTipo | null;
  /** Alias de compatibilidad (vista). */
  factura_numero?: string;
  factura_cuenta?: string | null;
  fecha_factura?: string | null;
  documento_importe_sin_iva?: number | null;
  documento_importe_total?: number | null;
  factura_importe_sin_iva?: number | null;
  factura_importe_total?: number | null;
}

export type EstacionCoordsBadge = 'OK' | 'PENDING';

/** Badge estación: solo coordenadas (lat y lng informados). */
export function stationBadgeFromCoords(
  lat?: number | null,
  lng?: number | null
): EstacionCoordsBadge {
  return lat != null && lng != null ? 'OK' : 'PENDING';
}

/**
 * Fila agregada de `peajes_listar_estaciones_pendientes`
 * (estaciones PENDING con pasadas asociadas).
 */
export interface EstacionPendienteGrupo {
  /** Alias de fila para DataTable (`rowIdKey`). */
  id: string;
  estacion_id: string;
  estacion_nombre: string;
  peaje_id: string;
  peaje_nombre?: string | null;
  empresa_id?: string | null;
  empresa_nombre?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  cantidad_pasadas: number;
  total_importe: number;
  ubicacion?: string | null;
  camino?: string | null;
  estacion_latitud?: number | null;
  estacion_longitud?: number | null;
}

/** Fila ya mapeada a Structure Goal (pre-persistencia / preview). */
export type PasadaEstandarizada = Omit<
  Record<PasadaColumnKey, string | number | null>,
  'SENTIDO' | 'TARIFA_STATUS'
> & {
  PASADA_ID?: string | null;
  SENTIDO?: string | number | null;
  TARIFA_STATUS?: string | number | null;
};

export interface PlantillaConfiguracion {
  id: string;
  nombre: string;
  descripcion?: string | null;
  empresa_id: string;
  estrategia_codigo?: string | null;
  estado: EstadoRecursoPeaje;
  created_at?: string;
  updated_at?: string;
  configuraciones?: ConfiguracionPlantilla[];
  /** Snapshot del Paso 5; se restaura antes de validar una importación recurrente. */
  mapeos?: PlantillaMapeoColumna[];
  /** Reconocimientos de estación propios de la plantilla (prioridad máxima). */
  estaciones_reconocidas?: PlantillaEstacionReconocida[];
}

export interface PlantillaMapeoColumna {
  columnaOrigen: string;
  columnaDestino: PasadaColumnKey | null;
  excluida: boolean;
}

export interface PlantillaEstacionReconocida {
  id: string;
  plantilla_id: string;
  valor_proveedor: string;
  valor_normalizado: string;
  estacion_id: string;
  origen?: 'usuario' | 'plantilla';
  created_at?: string;
}

export interface ConfiguracionPlantilla {
  id: string;
  plantilla_id: string;
  nombre_columna: string;
  columna_destino?: PasadaColumnKey | string | null;
  orden: number;
  tipo: TipoConfiguracionPlantilla | string;
  algoritmo_combinado_id?: string | null;
  configuracion?: Record<string, unknown> | null;
  obligatoria: boolean;
}

export interface AlgoritmoCombinado {
  id: string;
  nombre: string;
  descripcion?: string | null;
  empresa_id: string;
  estado: EstadoRecursoPeaje;
  created_at?: string;
  updated_at?: string;
  pasos?: AlgoritmoCombinadoPaso[];
}

export interface AlgoritmoCombinadoPaso {
  id: string;
  algoritmo_combinado_id: string;
  orden: number;
  algoritmo_codigo: string;
  parametros?: Record<string, unknown> | null;
}

/** Error de validación por fila (RNF-08). */
export interface ErrorValidacionPasada {
  fila: number;
  columna: string;
  valor: unknown;
  motivo: string;
  /** Valores de ambos lados cuando el error proviene de un duplicado contra BD. */
  pasada?: unknown;
  patente?: unknown;
  fecha_hora?: unknown;
  fecha_hora_repetida?: unknown;
  valor_repetido?: unknown;
  pase_nombre?: unknown;
  patente_nombre?: unknown;
  file_upload_name?: unknown;
  duplicado?: boolean;
}

/** Snapshot de auditoría de una carga confirmada (RF-26 / F01-9). */
export interface RegistroCargaPeajes {
  id: string;
  plantilla_id?: string | null;
  documento_id: string;
  parametros_efectivos?: Record<string, unknown> | null;
  filas_procesadas: number;
  errores?: ErrorValidacionPasada[] | null;
  created_at?: string;
  nombre_archivo?: string | null;
  user_id?: string | null;
}
