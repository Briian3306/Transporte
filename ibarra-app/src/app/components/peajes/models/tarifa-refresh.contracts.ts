/**
 * Contratos F14-19 — refresh de tarifas durante Paso 9.
 * El extractor es puro; los wrappers RPC viven en PeajesTarifarioService.
 */

import { InjectionToken } from '@angular/core';
import { normalizarImportesPasada } from './documento.helpers';
import { ConfiguracionPlantilla, PasadaEstandarizada } from './peajes.models';
import { EstacionViaSentidoRef, resolvePasadaSentido } from './direction-resolution';
import { DocumentoTipo } from './peajes.types';
import {
  CambioRefrescoTarifa,
  TarifaMatchOption,
  TarifaRefrescoGuardada,
  TarifaRefreshDecision,
  TarifaSentido,
  TarifaStatusPico,
} from './tarifario.contracts';

export type { TarifaMatchOption, TarifaRefreshDecision };

export type RefreshTarifaCodigo =
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

export interface EstacionCatalogoCandidato {
  estacionId: string;
  estacionNombre: string;
  peajeId: string;
  peajeNombre: string;
}

export interface CandidatoRefrescoTarifa {
  id: string;
  estacionId: string;
  categoria: number | null;
  categoriaProveedor: number | null;
  categoriaCalculada: number | null;
  statusSolicitado: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido | null;
  directionConfidence: 'EXPLICIT' | 'LANE_MAP' | 'UNRESOLVED';
  unresolvedReason?: 'MISSING_MAPPING' | 'CONFLICT';
  sourceStationCode: string | null;
  sourceLane: string | null;
  fechaPasada: string | null;
  estacionNombre: string | null;
  peajeId: string | null;
  peajeNombre: string | null;
  candidatePrice: number;
  precioDirecto: number;
  cases: number;
  filaRepresentativa: Record<string, unknown>;
  rowIndexes: number[];
}

export interface ExtraerCandidatosRefrescoOpciones {
  tipoDocumento?: DocumentoTipo | ReadonlyArray<DocumentoTipo | null | undefined>;
  estacionesViasSentido?: readonly EstacionViaSentidoRef[];
  documentos?: AnalisisRefrescoInput['documentos'];
  estacionesCatalogo?: readonly EstacionCatalogoCandidato[];
}

export interface AnalisisRefrescoInput {
  pasadas: PasadaEstandarizada[];
  documentos: ReadonlyArray<{
    tipo?: DocumentoTipo;
    rowIndexes: number[];
    omitido?: boolean;
  }>;
  configuraciones: ConfiguracionPlantilla[];
  estacionesViasSentido?: readonly EstacionViaSentidoRef[];
  estacionesCatalogo?: readonly EstacionCatalogoCandidato[];
}

export interface ResultadoDetectarRefresco {
  id: string;
  codigo: RefreshTarifaCodigo;
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
  diagnostico?: string | null;
  fechaVigenciaInicio?: string | null;
  fechaVigenciaFin?: string | null;
  fechaPasada?: string | null;
  possibleMatches?: TarifaMatchOption[];
  rowIndexes: number[];
  directionConfidence?: 'EXPLICIT' | 'LANE_MAP' | 'UNRESOLVED';
  sourceLane?: string | null;
  candidatePrice?: number | null;
}

export interface ResumenRefrescoTarifas {
  candidatos: CandidatoRefrescoTarifa[];
  resultados: ResultadoDetectarRefresco[];
  filasVigentes: number;
  filasHistoricas: number;
  filasCorreccionCategoria: number;
  filasNuevasConfirmadas: number;
  filasSinResolver: number;
  filasCambioVigencia: number;
  /** @deprecated Use filasSinResolver. Kept for Paso 9 until Task 10. */
  pendientes: number;
  contextIncomplete: boolean;
}

const CODIGOS_SIN_RESOLVER: ReadonlySet<RefreshTarifaCodigo> = new Set([
  'NEW_TARIFF',
  'AMBIGUOUS_TARIFF_MATCH',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
  'CONTEXT_INCOMPLETE',
  'DIRECTION_REQUIRED',
  'DIRECTION_CONFLICT',
]);

const CODIGOS_CORRECCION: ReadonlySet<RefreshTarifaCodigo> = new Set([
  'CURRENT_CATEGORY_CORRECTION',
  'HISTORICAL_CATEGORY_CORRECTION',
]);

export function asociacionDesdeResultadoRefresco(input: {
  codigo: RefreshTarifaCodigo | string;
  tarifaImporteId: string | null;
  categoriaProveedor?: number | null;
  categoriaCalculada?: number | null;
}): { tarifa_importe_id: string; codigo: 'AL_DIA' | 'HISTORICA' } | null {
  if (!input.tarifaImporteId) return null;
  switch (input.codigo) {
    case 'CURRENT_TARIFF':
    case 'CURRENT_CATEGORY_CORRECTION':
      return { tarifa_importe_id: input.tarifaImporteId, codigo: 'AL_DIA' };
    case 'HISTORICAL_TARIFF_MATCH':
    case 'HISTORICAL_CATEGORY_CORRECTION':
    case 'REVIEW_RECORDED':
      return { tarifa_importe_id: input.tarifaImporteId, codigo: 'HISTORICA' };
    default:
      return null;
  }
}

export function resumirFilasRefresco(resultados: readonly ResultadoDetectarRefresco[]): Pick<
  ResumenRefrescoTarifas,
  | 'filasVigentes'
  | 'filasHistoricas'
  | 'filasCorreccionCategoria'
  | 'filasNuevasConfirmadas'
  | 'filasSinResolver'
  | 'filasCambioVigencia'
  | 'pendientes'
  | 'contextIncomplete'
> {
  const count = (pred: (r: ResultadoDetectarRefresco) => boolean): number =>
    resultados.filter(pred).reduce((n, r) => n + r.rowIndexes.length, 0);
  const filasSinResolver = count((r) => CODIGOS_SIN_RESOLVER.has(r.codigo));
  return {
    filasVigentes: count((r) => r.codigo === 'CURRENT_TARIFF'),
    filasHistoricas: count((r) => r.codigo === 'HISTORICAL_TARIFF_MATCH'),
    filasCorreccionCategoria: count((r) => CODIGOS_CORRECCION.has(r.codigo)),
    filasNuevasConfirmadas: 0,
    filasSinResolver,
    filasCambioVigencia: count((r) => r.fechaVigenciaFin != null && String(r.fechaVigenciaFin).trim() !== ''),
    pendientes: filasSinResolver,
    contextIncomplete: resultados.some((r) =>
      ['CONTEXT_INCOMPLETE', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(r.codigo),
    ),
  };
}

export interface TarifaRefreshService {
  analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas>;
  guardar(cambios: Array<CambioRefrescoTarifa | TarifaRefreshDecision>): Promise<TarifaRefrescoGuardada[]>;
}

export const TARIFA_REFRESH_SERVICE = new InjectionToken<TarifaRefreshService>(
  'TARIFA_REFRESH_SERVICE',
);

function parseFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseCategoria(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function parseStatus(value: unknown): TarifaStatusPico | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'PICO' || raw === 'NO_PICO') return raw;
  return null;
}

function precioBrutoCandidato(pasada: PasadaEstandarizada): number | null {
  const precio = parseFiniteNumber(pasada.PRECIO);
  if (precio != null) return precio;
  return parseFiniteNumber(pasada.IMPORTE_NETO);
}

/** Clave de agrupación no redondeada; el precio original se conserva para comparar. */
export function clavePrecioCanonico(precio: number): string {
  return Object.is(precio, -0) ? '0' : String(precio);
}

export function fechaPasadaCanonico(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso ? iso[1] : null;
}

function tipoDocumentoDe(
  tipo: ExtraerCandidatosRefrescoOpciones['tipoDocumento'],
  index: number,
): DocumentoTipo {
  if (Array.isArray(tipo)) {
    const item = tipo[index];
    return item === 'NC' ? 'NC' : 'FC';
  }
  return tipo === 'NC' ? 'NC' : 'FC';
}

function indicesOmitidos(documentos: ExtraerCandidatosRefrescoOpciones['documentos']): Set<number> {
  const omit = new Set<number>();
  for (const doc of documentos ?? []) {
    if (!doc.omitido) continue;
    for (const idx of doc.rowIndexes ?? []) omit.add(idx);
  }
  return omit;
}

export function extraerCandidatosRefresco(
  pasadas: PasadaEstandarizada[],
  opciones: ExtraerCandidatosRefrescoOpciones = {},
): CandidatoRefrescoTarifa[] {
  const grupos = new Map<string, CandidatoRefrescoTarifa>();
  const orden: string[] = [];
  const omitidos = indicesOmitidos(opciones.documentos);
  const catalogo = new Map((opciones.estacionesCatalogo ?? []).map((row) => [row.estacionId, row]));

  pasadas.forEach((fila, index) => {
    if (omitidos.has(index)) return;
    const bruto = precioBrutoCandidato(fila);
    if (bruto == null) return;

    const tipo = tipoDocumentoDe(opciones.tipoDocumento, index);
    const firmado = normalizarImportesPasada(tipo, {
      precio: bruto,
      bonificacion: parseFiniteNumber(fila.BONIFICACION) ?? 0,
      importe_neto: parseFiniteNumber(fila.IMPORTE_NETO) ?? undefined,
    });
    const precioDirecto = Math.abs(firmado.precio);
    if (!Number.isFinite(precioDirecto)) return;

    const estacionId = String(fila.ESTACION_ID ?? '').trim();
    const categoria = parseCategoria(fila.CATEGORIA);
    const statusSolicitado = parseStatus(fila.TARIFA_STATUS);
    const fechaPasada = fechaPasadaCanonico(fila.FECHA_HORA);
    const sourceStationCode = fila.SOURCE_ESTACION ?? (fila as Record<string, unknown>)['ESTACION'] ?? null;
    const sourceLane = fila.SOURCE_VIA ?? (fila as Record<string, unknown>)['VIA'] ?? null;
    const direction = resolvePasadaSentido({
      explicit: fila.SENTIDO,
      codigoEstacion: sourceStationCode,
      via: sourceLane,
      map: opciones.estacionesViasSentido ?? [],
    });
    const sentidoSolicitado = direction.sentido;
    const id = [
      estacionId,
      categoria == null ? '' : String(categoria),
      statusSolicitado ?? '',
      sentidoSolicitado ?? '',
      fechaPasada ?? '',
      clavePrecioCanonico(precioDirecto),
    ].join('|');

    const existente = grupos.get(id);
    if (existente) {
      existente.rowIndexes.push(index);
      existente.cases = existente.rowIndexes.length;
      return;
    }

    const meta = catalogo.get(estacionId);
    grupos.set(id, {
      id,
      estacionId,
      categoria,
      categoriaProveedor: categoria,
      categoriaCalculada: null,
      statusSolicitado,
      sentidoSolicitado,
      directionConfidence: direction.confidence,
      ...(direction.confidence === 'UNRESOLVED' ? { unresolvedReason: direction.reason } : {}),
      sourceStationCode: sourceStationCode == null ? null : String(sourceStationCode),
      sourceLane: sourceLane == null ? null : String(sourceLane),
      fechaPasada,
      estacionNombre: meta?.estacionNombre ?? null,
      peajeId: meta?.peajeId ?? null,
      peajeNombre: meta?.peajeNombre ?? null,
      candidatePrice: precioDirecto,
      precioDirecto,
      cases: 1,
      filaRepresentativa: { ...fila },
      rowIndexes: [index],
    });
    orden.push(id);
  });

  return orden.map((key) => grupos.get(key)!);
}
