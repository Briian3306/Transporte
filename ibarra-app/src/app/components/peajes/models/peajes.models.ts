import { CategoriaPatente, EstadoRecursoPeaje, PasadaColumnKey, TipoConfiguracionPlantilla } from './peajes.types';

/** Empresa/proveedor de peajes (tabla empresas). */
export interface Empresa {
  id: string;
  nombre: string;
  descripcion?: string | null;
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
  created_at?: string;
  /** Join opcional. */
  peaje?: Peaje;
}

export interface Patente {
  id: string;
  patente: string;
  categoria: CategoriaPatente;
  created_at?: string;
}

export interface Pase {
  id: string;
  pase: string;
  patente_id: string;
  created_at?: string;
  patente?: Patente;
}

/** Factura / Bill (PRD §11.2 → facturas). */
export interface Factura {
  id: string;
  factura: string;
  cuenta: string;
  empresa_id: string;
  fecha_factura: string;
  importe_sin_iva: number;
  importe_total: number;
  created_at?: string;
}

/**
 * Pasada persistida (PRD §11.1 + §12).
 * Referencia estacion_id (no peaje_id directo). factura_id es FK técnica (§13.5).
 */
export interface Pasada {
  id: string;
  fecha_hora: string;
  pase_id: string;
  patente_id: string;
  estacion_id: string;
  factura_id: string;
  precio: number;
  bonificacion: number;
  quantity: number;
  importe_neto: number;
  created_at?: string;
  estacion?: Estacion;
  factura?: Factura;
}

/** Fila ya mapeada a Structure Goal (pre-persistencia / preview). */
export type PasadaEstandarizada = Record<PasadaColumnKey, string | number | null> & {
  PASADA_ID?: string | null;
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
}

/** Snapshot de auditoría de una carga confirmada (RF-26 / F01-9). */
export interface RegistroCargaPeajes {
  id: string;
  plantilla_id?: string | null;
  factura_id: string;
  parametros_efectivos?: Record<string, unknown> | null;
  filas_procesadas: number;
  errores?: ErrorValidacionPasada[] | null;
  created_at?: string;
}
