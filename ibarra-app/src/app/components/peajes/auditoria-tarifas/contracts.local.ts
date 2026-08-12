/**
 * Local contracts for F14-4 until `models/auditoria-tarifas.contracts.ts` lands (F14-0/F14-2).
 * TODO(agent-01): migrate imports to `../models` when the canonical contract is exported.
 */

import { Observable } from 'rxjs';

export type TarifaDiagnostico =
  | 'MUESTRA_INSUFICIENTE'
  | 'TARIFA_UNICA'
  | 'CATEGORIA'
  | 'POSIBLE_HORARIO'
  | 'REVISAR'
  | 'CONFIRMADO';

export type TarifaStatusTipoMeta = 'PICO' | 'NO_PICO' | 'NEUTRO';

export interface TarifaStatusCatalogo {
  peaje_id: string;
  codigo: string;
  etiqueta: string;
  color: string;
  tipo_meta: TarifaStatusTipoMeta;
  orden: number;
}

export interface TarifaNormalizadaRow {
  id: string;
  peaje_id: string;
  peaje_nombre: string | null;
  estacion_id: string;
  estacion_nombre: string;
  categoria: string | null;
  importe: number;
  cases: number;
  importe_base: number;
  multiplicador: number;
  hora_min: number | null;
  hora_max: number | null;
  hora_media: number | null;
  desvio: number | null;
  muestra_confiable: boolean;
  diagnostico: TarifaDiagnostico;
  status: string;
  confirmado_manual: boolean;
}

export interface TarifasNormalizadasFilters {
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  peaje_ids?: string[];
  estacion_ids?: string[];
  categorias?: string[];
  diagnosticos?: TarifaDiagnostico[];
  status?: string[];
  patron?: 'A' | 'B' | null;
  solo_muestra_confiable?: boolean;
  q_estacion?: string | null;
}

export interface TarifasNormalizadasListParams {
  filters?: TarifasNormalizadasFilters;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface TarifasNormalizadasListResult {
  rows: TarifaNormalizadaRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TarifaAsignacion {
  tarifa_normalizada_id: string;
  status_codigo: string;
}

export interface TarifaGrupoSimilar {
  estacion_id: string;
  estacion_nombre: string;
  categoria: string | null;
  niveles: number;
  cases: number;
  importe_min: number;
  importe_max: number;
  ratio: number;
  pendientes: number;
  /** Populated by mock / RPC for bulk apply pairing. */
  tarifa_ids?: string[];
}

export interface TarifaFamilia {
  estacion_id: string;
  estacion_nombre: string;
  peaje_id: string;
  categoria: string | null;
  niveles: TarifaNormalizadaRow[];
}

export interface PeajesAuditoriaTarifasService {
  listar(params: TarifasNormalizadasListParams): Observable<TarifasNormalizadasListResult>;
  listarStatusCatalogo(peajeId: string): Observable<TarifaStatusCatalogo[]>;
  listarCategorias(peajeIds?: string[]): Observable<string[]>;
  confirmarStatus(asignaciones: TarifaAsignacion[]): Observable<{ actualizadas: number }>;
  marcarDiagnostico(
    tarifaNormalizadaId: string,
    diagnostico: TarifaDiagnostico
  ): Observable<TarifaNormalizadaRow>;
  gruposSimilares(
    tarifaNormalizadaId: string,
    tolerancia: number
  ): Observable<TarifaGrupoSimilar[]>;
  recalcular(peajeId: string): Observable<{ familias: number }>;
}

export const PEAJES_AUDITORIA_TARIFAS_SERVICE = 'PEAJES_AUDITORIA_TARIFAS_SERVICE';
