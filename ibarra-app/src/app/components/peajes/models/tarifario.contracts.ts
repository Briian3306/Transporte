/**
 * Contratos F14-17 — Tarifario de precios actuales (`tarifas` + `tarifa_importe`).
 * Consumidos por `/peajes/tarifario` y el mock/RPC detrás de PEAJES_TARIFARIO_SERVICE.
 */

import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const TARIFA_CATEGORIAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type TarifaCategoria = (typeof TARIFA_CATEGORIAS)[number];

export type TarifaSentido = 'IDA' | 'VUELTA' | 'AMBAS';
export type TarifaStatusPico = 'PICO' | 'NO_PICO';

export interface TarifarioCurrentRow {
  tarifa_id: string;
  peaje_id: string;
  peaje_nombre: string | null;
  estacion_id: string;
  estacion_nombre: string;
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
  importe: number | null;
  fecha_actualizacion: string | null;
  current_tarifa_importe_id: string | null;
  fechaVigenciaInicio?: string | null;
  fechaVigenciaFin?: string | null;
  diagnostico?: string | null;
  categoriaCalculada?: number | null;
}

export interface TarifarioFilters {
  peaje_ids?: string[];
  estacion_ids?: string[];
  categorias?: number[];
  status?: TarifaStatusPico[];
  sentidos?: TarifaSentido[];
  q_estacion?: string | null;
}

export interface TarifarioListParams {
  filters?: TarifarioFilters;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface TarifarioListResult {
  rows: TarifarioCurrentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TarifarioEditorContext {
  peaje_id: string;
  peaje_nombre: string;
  estacion_id: string;
  estacion_nombre: string;
  sentido: TarifaSentido;
}

export interface TarifarioEditorCell {
  tarifa_id: string | null;
  current_tarifa_importe_id: string | null;
  importe: number | null;
  fecha_actualizacion: string | null;
}

export interface TarifarioEditorRow {
  categoria: number;
  no_pico: TarifarioEditorCell;
  pico: TarifarioEditorCell;
}

export interface TarifarioIdentidadExistente {
  tarifa_id: string;
  categoria: number;
  status: TarifaStatusPico;
  current_tarifa_importe_id: string | null;
  importe: number | null;
  fecha_actualizacion: string | null;
  fechaVigenciaInicio?: string | null;
  fechaVigenciaFin?: string | null;
  diagnostico?: string | null;
  categoriaCalculada?: number | null;
}

export interface TarifarioEditorPayload {
  context: TarifarioEditorContext;
  existentes: TarifarioIdentidadExistente[];
}

export interface TarifarioEditorDrafts {
  [categoria: number]: { no_pico: string; pico: string };
}

export interface TarifarioImporteCambio {
  categoria: number;
  status: TarifaStatusPico;
  importe: number;
  fechaVigenciaInicio?: string | null;
}

export interface TarifarioHistorialItem {
  id: string;
  importe: number;
  fecha_aparicion: string;
  es_actual: boolean;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  diagnostico: string | null;
  categoriaCalculada: number | null;
}

export interface PrepararRefrescoTarifaInput {
  id: string;
  estacionId: string;
  categoria: number | null;
  statusSolicitado: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido | null;
}

export interface PrepararRefrescoTarifaItem {
  id: string;
  peajeId: string | null;
  estacionId: string;
  categoria: number | null;
  status: TarifaStatusPico | null;
  sentido: TarifaSentido | null;
  tarifaId: string | null;
  importe: number | null;
  requiereNormalizacionIva: boolean;
}

export interface DetectarRefrescoTarifaInput {
  id: string;
  estacionId: string;
  categoria: number | null;
  categoriaProveedor?: number | null;
  statusSolicitado: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido | null;
  fechaPasada?: string | null;
  precioDirecto: number;
  precioNormalizado: number | null;
}

export type RefreshTarifaCodigoRpc =
  | 'CURRENT_TARIFF'
  | 'HISTORICAL_TARIFF_MATCH'
  | 'CURRENT_CATEGORY_CORRECTION'
  | 'HISTORICAL_CATEGORY_CORRECTION'
  | 'NEW_TARIFF'
  | 'AMBIGUOUS_TARIFF_MATCH'
  | 'STATUS_REQUIRED'
  | 'STATUS_AMBIGUOUS'
  | 'DIRECTION_REQUIRED'
  | 'DIRECTION_CONFLICT'
  | 'CONTEXT_INCOMPLETE'
  | 'REVIEW_RECORDED';

export interface TarifaMatchOption {
  tarifaId: string;
  tarifaImporteId: string;
  categoria: number;
  status: 'PICO' | 'NO_PICO';
  sentido: 'IDA' | 'VUELTA' | 'AMBAS';
  importe: number;
  diagnostico: string | null;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  esActual: boolean;
  errorRelativo: number;
}

export interface DetectarRefrescoTarifaItem {
  id: string;
  codigo: RefreshTarifaCodigoRpc;
  peajeId: string | null;
  estacionId: string;
  categoria: number | null;
  categoriaProveedor: number | null;
  categoriaCalculada: number | null;
  status: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido | null;
  sentidoAplicado: TarifaSentido | null;
  importeActual: number | null;
  tarifaId: string | null;
  tarifaImporteId: string | null;
  requiereNormalizacionIva: boolean | null;
  diagnostico: string | null;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  possibleMatches: TarifaMatchOption[];
}

export interface CambioRefrescoTarifa {
  peajeId: string;
  estacionId: string;
  sentido: TarifaSentido;
  categoria: number;
  status: TarifaStatusPico;
  importe: number;
  /** Immutable number of source pasadas that evidenced this price snapshot. */
  cases: number;
  requiereNormalizacionIva: boolean | null;
}

export interface TarifaRefreshDecision {
  candidateId: string;
  action: 'CONFIRM_NEW' | 'MARK_REVIEW';
  peajeId: string;
  estacionId: string;
  categoriaProveedor: number;
  categoriaCalculada: number | null;
  status: 'PICO' | 'NO_PICO';
  sentido: 'IDA' | 'VUELTA' | 'AMBAS';
  importe: number;
  fechaVigenciaInicio: string | null;
  cases: number;
  requiereNormalizacionIva: boolean | null;
}

export interface TarifaRefrescoGuardada {
  peaje_id: string;
  estacion_id: string;
  sentido: TarifaSentido;
  categoria: number;
  status: TarifaStatusPico;
  tarifa_id: string;
  anterior: number | null;
  nueva: number;
  tarifa_importe_id: string | null;
  accion: 'ACTUALIZADA' | 'IDENTIDAD_CREADA' | 'SIN_CAMBIO';
  candidate_id?: string | null;
  anterior_fin?: string | null;
  fecha_vigencia_inicio?: string | null;
  fecha_vigencia_fin?: string | null;
  diagnostico?: string | null;
  categoria_calculada?: number | null;
  fechaVigenciaInicio?: string | null;
  fechaVigenciaFin?: string | null;
  categoriaCalculada?: number | null;
}

export interface PeajesTarifarioService {
  listar(params: TarifarioListParams): Observable<TarifarioListResult>;
  obtenerEditor(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
  ): Observable<TarifarioEditorPayload>;
  guardar(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
    cambios: TarifarioImporteCambio[],
  ): Observable<{ actualizadas: number }>;
  listarHistorial(tarifaId: string): Observable<TarifarioHistorialItem[]>;
  prepararRefresco(
    candidatos: PrepararRefrescoTarifaInput[],
  ): Observable<PrepararRefrescoTarifaItem[]>;
  detectarRefresco(
    candidatos: DetectarRefrescoTarifaInput[],
  ): Observable<DetectarRefrescoTarifaItem[]>;
  guardarRefresco(cambios: Array<CambioRefrescoTarifa | TarifaRefreshDecision>): Observable<TarifaRefrescoGuardada[]>;
}

export const PEAJES_TARIFARIO_SERVICE = new InjectionToken<PeajesTarifarioService>(
  'PEAJES_TARIFARIO_SERVICE',
);
