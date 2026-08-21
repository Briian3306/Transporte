/**
 * Contratos F16 — Auditoría de reconocimiento de estaciones.
 * RPC: peajes_listar_auditoria_estaciones(p_filtros, p_page, p_page_size, p_sort)
 */

import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { claveCanonicoCodigoEstacion } from './estacion-reconocimiento.helpers';

export const PEAJES_AUDITORIA_ESTACIONES_LISTAR_RPC = 'peajes_listar_auditoria_estaciones';
export const AUDITORIA_ESTACIONES_ALGORITMO_VERSION = 'v1';

export const HALLAZGOS_AUDITORIA_ESTACION = [
  'CODIGO_REPETIDO_ENTRE_ESTACIONES',
  'SECUENCIA_NUMERICA_CON_SALTO',
  'SECUENCIA_NUMERICA_INVERTIDA',
  'ALIAS_DIFERENTE_CATALOGO',
] as const;

export type HallazgoAuditoriaEstacion = (typeof HALLAZGOS_AUDITORIA_ESTACION)[number];

export const ESTADOS_CASO_AUDITORIA_ESTACION = [
  'PENDIENTE',
  'VALIDADO',
  'DESCARTADO',
  'REQUIERE_CORRECCION',
  'CORREGIDO',
] as const;

export type EstadoCasoAuditoriaEstacion = (typeof ESTADOS_CASO_AUDITORIA_ESTACION)[number];

export const TRANSICIONES_CASO_AUDITORIA_ESTACION = [
  { from: 'PENDIENTE', to: 'VALIDADO' },
  { from: 'PENDIENTE', to: 'DESCARTADO' },
  { from: 'PENDIENTE', to: 'REQUIERE_CORRECCION' },
  { from: 'REQUIERE_CORRECCION', to: 'CORREGIDO' },
  { from: 'REQUIERE_CORRECCION', to: 'PENDIENTE' },
  { from: 'REQUIERE_CORRECCION', to: 'DESCARTADO' },
] as const;

export type FuenteCodigoEstacion = 'catalogo' | 'alias';

export type ModalidadCorreccionEstacion = 'SOLO_FUTUROS' | 'FUTUROS_E_HISTORICOS';

export interface SecuenciaEsperadaEstacion {
  minimo: number;
  maximo: number;
  faltantes: number[];
}

export interface AuditoriaEstacionRow {
  empresaId: string;
  peajeId: string;
  estacionId: string;
  empresaNombre: string;
  peajeNombre: string;
  estacionNombre: string;
  codigoProveedor: string;
  codigoNormalizado: string;
  fuentes: FuenteCodigoEstacion[];
  codigosEstacion: string[];
  estacionesMismoCodigo: number;
  secuenciaEsperada: SecuenciaEsperadaEstacion | null;
  hallazgos: HallazgoAuditoriaEstacion[];
  casoId: string | null;
  estado: EstadoCasoAuditoriaEstacion;
  observacion: string | null;
  movimientosAfectados: number | null;
  fingerprint: string;
  detalle?: AuditoriaEstacionRow[];
}

export interface AuditoriaEstacionesFilters {
  empresa_ids?: string[];
  peaje_ids?: string[];
  estacion_ids?: string[];
  estados?: EstadoCasoAuditoriaEstacion[];
  hallazgos?: HallazgoAuditoriaEstacion[];
  q?: string | null;
}

export interface AuditoriaEstacionesListParams {
  filters?: AuditoriaEstacionesFilters;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface AuditoriaEstacionesListResult {
  rows: AuditoriaEstacionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PreviewCorreccionEstacion {
  casoId: string;
  previewHash: string;
  estacionOrigenId: string;
  estacionDestinoId: string;
  aliasAjustes: Array<{ aliasId: string | null; valor: string; accion: 'crear' | 'mover' | 'eliminar' }>;
  catalogoAjustes: Array<{ estacionId: string; codigos: string[] }>;
  pasadas: Array<{ id: string; fechaHora: string; patente?: string | null }>;
}

export interface CorreccionEstacionInput {
  casoId: string;
  estacionDestinoId: string;
  modalidad: ModalidadCorreccionEstacion;
  previewHash: string;
  observacion?: string | null;
}

export interface PeajesAuditoriaEstacionesService {
  listar(params: AuditoriaEstacionesListParams): Observable<AuditoriaEstacionesListResult>;
  transicionar(
    casoId: string | null,
    fingerprint: string,
    estado: EstadoCasoAuditoriaEstacion,
    observacion: string | null,
    row: Pick<AuditoriaEstacionRow, 'empresaId' | 'peajeId' | 'estacionId' | 'hallazgos' | 'codigosEstacion'>,
  ): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }>;
  previsualizar(casoId: string, estacionDestinoId: string): Observable<PreviewCorreccionEstacion>;
  corregir(input: CorreccionEstacionInput): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }>;
}

export const PEAJES_AUDITORIA_ESTACIONES_SERVICE = new InjectionToken<PeajesAuditoriaEstacionesService>(
  'PEAJES_AUDITORIA_ESTACIONES_SERVICE',
);

export function claveRelacionEstacion(valorProveedor: unknown): string {
  return claveCanonicoCodigoEstacion(valorProveedor);
}

export function fingerprintCasoEstacion(input: {
  empresaId: string;
  peajeId: string;
  tipo: HallazgoAuditoriaEstacion | string;
  codigosNormalizados: string[];
  algoritmoVersion?: string;
}): string {
  const codes = [...new Set(input.codigosNormalizados.map((c) => claveRelacionEstacion(c)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true }),
  );
  const version = input.algoritmoVersion ?? AUDITORIA_ESTACIONES_ALGORITMO_VERSION;
  return `${input.empresaId}|${input.peajeId}|${input.tipo}|${codes.join(',')}|${version}`;
}

export function puedeTransicionarCasoEstacion(
  from: EstadoCasoAuditoriaEstacion | string,
  to: EstadoCasoAuditoriaEstacion | string,
): boolean {
  return TRANSICIONES_CASO_AUDITORIA_ESTACION.some((t) => t.from === from && t.to === to);
}
