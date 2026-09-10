import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AnalisisRefrescoInput,
  CandidatoRefrescoTarifa,
  ResultadoDetectarRefresco,
  ResumenRefrescoTarifas,
  TARIFA_REFRESH_SERVICE,
  TarifaRefreshService,
  extraerCandidatosRefresco,
  resumirFilasRefresco,
} from '../models/tarifa-refresh.contracts';
import {
  CambioRefrescoTarifa,
  DetectarRefrescoTarifaInput,
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  PrepararRefrescoTarifaInput,
  TarifaRefreshDecision,
  TarifaRefrescoGuardada,
} from '../models/tarifario.contracts';
import { DocumentoTipo } from '../models/peajes.types';
import { TarifaComparisonAdapterService } from './tarifa-comparison-adapter.service';

function contextKey(c: {
  estacionId: string;
  categoria: number | null;
  statusSolicitado: string | null;
  sentidoSolicitado: string | null;
}): string {
  return [
    c.estacionId,
    c.categoria == null ? '' : String(c.categoria),
    c.statusSolicitado ?? '',
    c.sentidoSolicitado,
  ].join('|');
}

function tiposPorIndice(
  length: number,
  documentos: AnalisisRefrescoInput['documentos'],
): DocumentoTipo[] {
  const tipos: DocumentoTipo[] = Array.from({ length }, () => 'FC');
  for (const doc of documentos) {
    if (doc.omitido) continue;
    const tipo: DocumentoTipo = doc.tipo === 'NC' ? 'NC' : 'FC';
    for (const idx of doc.rowIndexes ?? []) {
      if (idx >= 0 && idx < length) tipos[idx] = tipo;
    }
  }
  return tipos;
}

function resumenVacio(candidatos: CandidatoRefrescoTarifa[] = [], resultados: ResultadoDetectarRefresco[] = []): ResumenRefrescoTarifas {
  return {
    candidatos,
    resultados,
    ...resumirFilasRefresco(resultados),
  };
}

function resultadoDesdeCandidato(
  candidate: CandidatoRefrescoTarifa,
  codigo: ResultadoDetectarRefresco['codigo'],
): ResultadoDetectarRefresco {
  return {
    id: candidate.id,
    codigo,
    peajeId: candidate.peajeId,
    estacionId: candidate.estacionId,
    categoria: candidate.categoria,
    categoriaProveedor: candidate.categoriaProveedor,
    categoriaCalculada: candidate.categoriaCalculada,
    status: candidate.statusSolicitado,
    sentidoSolicitado: null,
    sentidoAplicado: null,
    importeActual: null,
    tarifaId: null,
    tarifaImporteId: null,
    requiereNormalizacionIva: null,
    diagnostico: null,
    fechaVigenciaInicio: null,
    fechaVigenciaFin: null,
    fechaPasada: candidate.fechaPasada,
    possibleMatches: [],
    rowIndexes: candidate.rowIndexes,
    directionConfidence: candidate.directionConfidence,
    sourceLane: candidate.sourceLane,
    candidatePrice: candidate.candidatePrice,
  };
}

@Injectable()
export class TarifaRefreshServiceImpl implements TarifaRefreshService {
  private readonly tarifario = inject(PEAJES_TARIFARIO_SERVICE);
  private readonly adapter = inject(TarifaComparisonAdapterService);

  async analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas> {
    const tipos = tiposPorIndice(input.pasadas.length, input.documentos);
    const candidatos = extraerCandidatosRefresco(input.pasadas, {
      tipoDocumento: tipos,
      estacionesViasSentido: input.estacionesViasSentido,
      documentos: input.documentos,
      estacionesCatalogo: input.estacionesCatalogo,
    });
    if (!candidatos.length) {
      return resumenVacio();
    }

    const unresolvedCandidates = candidatos.filter((candidate) => candidate.sentidoSolicitado == null);
    const resolvedCandidates = candidatos.filter((candidate) => candidate.sentidoSolicitado != null);
    const unresolvedResults: ResultadoDetectarRefresco[] = unresolvedCandidates.map((candidate) =>
      resultadoDesdeCandidato(
        candidate,
        candidate.unresolvedReason === 'CONFLICT' ? 'DIRECTION_CONFLICT' : 'DIRECTION_REQUIRED',
      ),
    );
    if (!resolvedCandidates.length) {
      return resumenVacio(candidatos, unresolvedResults);
    }

    const prepareSeen = new Set<string>();
    const prepareInputs: PrepararRefrescoTarifaInput[] = [];
    for (const c of resolvedCandidates) {
      const key = contextKey(c);
      if (prepareSeen.has(key)) continue;
      prepareSeen.add(key);
      prepareInputs.push({
        id: key,
        estacionId: c.estacionId,
        categoria: c.categoria,
        statusSolicitado: c.statusSolicitado,
        sentidoSolicitado: c.sentidoSolicitado,
      });
    }

    const prepared = await firstValueFrom(this.tarifario.prepararRefresco(prepareInputs));
    const ivaByContext = new Map<string, boolean>();
    for (const row of prepared) {
      const key = [
        row.estacionId,
        row.categoria == null ? '' : String(row.categoria),
        row.status ?? '',
        row.sentido,
      ].join('|');
      const requested = prepareInputs.find(
        (p) =>
          p.estacionId === row.estacionId &&
          p.categoria === row.categoria &&
          (p.statusSolicitado == null || p.statusSolicitado === row.status) &&
          p.sentidoSolicitado === row.sentido,
      );
      const ctx = requested
        ? contextKey({
            estacionId: requested.estacionId,
            categoria: requested.categoria,
            statusSolicitado: requested.statusSolicitado,
            sentidoSolicitado: requested.sentidoSolicitado,
          })
        : key;
      ivaByContext.set(ctx, ivaByContext.get(ctx) === true || row.requiereNormalizacionIva);
    }

    const detectSeen = new Set<string>();
    const detectInputs: DetectarRefrescoTarifaInput[] = [];
    const detectToCandidates = new Map<string, CandidatoRefrescoTarifa[]>();

    for (const c of resolvedCandidates) {
      const ctx = contextKey(c);
      const needsIva = ivaByContext.get(ctx) === true;
      const comparable = needsIva
        ? this.adapter.obtenerPrecioComparable({
            precioDirecto: c.precioDirecto,
            requiereNormalizacionIva: true,
            fila: c.filaRepresentativa,
            configuraciones: input.configuraciones,
          })
        : c.precioDirecto;
      const detectKey = `${ctx}|${c.fechaPasada ?? ''}|${comparable}`;
      const existing = detectToCandidates.get(detectKey);
      if (existing) {
        existing.push(c);
        continue;
      }
      detectToCandidates.set(detectKey, [c]);
      if (detectSeen.has(detectKey)) continue;
      detectSeen.add(detectKey);
      detectInputs.push({
        id: detectKey,
        estacionId: c.estacionId,
        categoria: c.categoria,
        categoriaProveedor: c.categoriaProveedor,
        statusSolicitado: c.statusSolicitado,
        sentidoSolicitado: c.sentidoSolicitado,
        fechaPasada: c.fechaPasada,
        precioDirecto: c.precioDirecto,
        precioNormalizado: needsIva ? comparable : null,
      });
    }

    const detected = await firstValueFrom(this.tarifario.detectarRefresco(detectInputs));
    const resultados: ResultadoDetectarRefresco[] = detected.flatMap((item) => {
      const group = detectToCandidates.get(item.id) ?? [];
      const rowIndexes = group.flatMap((c) => c.rowIndexes);
      const first = group[0];
      return [
        {
          id: item.id,
          codigo: item.codigo,
          peajeId: item.peajeId,
          estacionId: item.estacionId,
          categoria: item.categoriaProveedor ?? item.categoria,
          categoriaProveedor: item.categoriaProveedor ?? item.categoria,
          categoriaCalculada: item.categoriaCalculada,
          status: item.status,
          sentidoSolicitado: item.sentidoSolicitado,
          sentidoAplicado: item.sentidoAplicado,
          importeActual: item.importeActual,
          tarifaId: item.tarifaId,
          tarifaImporteId: item.tarifaImporteId,
          requiereNormalizacionIva: item.requiereNormalizacionIva,
          diagnostico: item.diagnostico,
          fechaVigenciaInicio: item.fechaVigenciaInicio,
          fechaVigenciaFin: item.fechaVigenciaFin,
          fechaPasada: first?.fechaPasada ?? null,
          possibleMatches: item.possibleMatches,
          rowIndexes,
          directionConfidence: first?.directionConfidence,
          sourceLane: first?.sourceLane,
          candidatePrice: first?.candidatePrice,
        },
      ];
    });
    resultados.unshift(...unresolvedResults);

    return {
      candidatos,
      resultados,
      ...resumirFilasRefresco(resultados),
    };
  }

  async guardar(
    cambios: Array<CambioRefrescoTarifa | TarifaRefreshDecision>,
  ): Promise<TarifaRefrescoGuardada[]> {
    return firstValueFrom(this.tarifario.guardarRefresco(cambios));
  }
}

export { TARIFA_REFRESH_SERVICE };
export type { TarifaRefreshService };
