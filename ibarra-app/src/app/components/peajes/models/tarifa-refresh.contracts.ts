/**
 * Contratos F14-18 — refresh de tarifas durante Paso 9.
 * El extractor es puro; los wrappers RPC viven en PeajesTarifarioService.
 */

import { InjectionToken } from '@angular/core';
import { normalizarImportesPasada } from './documento.helpers';
import { ConfiguracionPlantilla, PasadaEstandarizada } from './peajes.models';
import { DocumentoTipo } from './peajes.types';
import {
  CambioRefrescoTarifa,
  TarifaRefrescoGuardada,
  TarifaSentido,
  TarifaStatusPico,
} from './tarifario.contracts';

export type RefreshTarifaCodigo =
  | 'CURRENT_TARIFF'
  | 'HISTORICAL_TARIFF_MATCH'
  | 'NEW_TARIFF'
  | 'STATUS_REQUIRED'
  | 'STATUS_AMBIGUOUS'
  | 'CONTEXT_INCOMPLETE';

export interface CandidatoRefrescoTarifa {
  id: string;
  estacionId: string;
  categoria: number | null;
  statusSolicitado: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido;
  precioDirecto: number;
  filaRepresentativa: Record<string, unknown>;
  rowIndexes: number[];
}

export interface ExtraerCandidatosRefrescoOpciones {
  tipoDocumento?: DocumentoTipo | ReadonlyArray<DocumentoTipo | null | undefined>;
}

export interface AnalisisRefrescoInput {
  pasadas: PasadaEstandarizada[];
  documentos: ReadonlyArray<{
    tipo?: DocumentoTipo;
    rowIndexes: number[];
    omitido?: boolean;
  }>;
  configuraciones: ConfiguracionPlantilla[];
}

export interface ResultadoDetectarRefresco {
  id: string;
  codigo: RefreshTarifaCodigo;
  peajeId: string | null;
  estacionId: string;
  categoria: number | null;
  status: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido;
  sentidoAplicado: TarifaSentido | null;
  importeActual: number | null;
  tarifaId: string | null;
  tarifaImporteId: string | null;
  requiereNormalizacionIva: boolean | null;
  rowIndexes: number[];
}

export interface ResumenRefrescoTarifas {
  candidatos: CandidatoRefrescoTarifa[];
  resultados: ResultadoDetectarRefresco[];
  filasVigentes: number;
  filasHistoricas: number;
  pendientes: number;
  contextIncomplete: boolean;
}

export interface TarifaRefreshService {
  analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas>;
  guardar(cambios: CambioRefrescoTarifa[]): Promise<TarifaRefrescoGuardada[]>;
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

function parseSentido(value: unknown): TarifaSentido {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'IDA' || raw === 'VUELTA' || raw === 'AMBAS') return raw;
  return 'AMBAS';
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

export function extraerCandidatosRefresco(
  pasadas: PasadaEstandarizada[],
  opciones: ExtraerCandidatosRefrescoOpciones = {},
): CandidatoRefrescoTarifa[] {
  const grupos = new Map<string, CandidatoRefrescoTarifa>();
  const orden: string[] = [];

  pasadas.forEach((fila, index) => {
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
    const sentidoSolicitado = parseSentido(fila.SENTIDO);
    const id = [
      estacionId,
      categoria == null ? '' : String(categoria),
      statusSolicitado ?? '',
      sentidoSolicitado,
      clavePrecioCanonico(precioDirecto),
    ].join('|');

    const existente = grupos.get(id);
    if (existente) {
      existente.rowIndexes.push(index);
      return;
    }

    grupos.set(id, {
      id,
      estacionId,
      categoria,
      statusSolicitado,
      sentidoSolicitado,
      precioDirecto,
      filaRepresentativa: { ...fila },
      rowIndexes: [index],
    });
    orden.push(id);
  });

  return orden.map((key) => grupos.get(key)!);
}
