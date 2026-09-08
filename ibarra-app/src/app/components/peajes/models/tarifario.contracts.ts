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
}

export interface TarifarioHistorialItem {
  id: string;
  importe: number;
  fecha_aparicion: string;
  es_actual: boolean;
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
}

export const PEAJES_TARIFARIO_SERVICE = new InjectionToken<PeajesTarifarioService>(
  'PEAJES_TARIFARIO_SERVICE',
);
