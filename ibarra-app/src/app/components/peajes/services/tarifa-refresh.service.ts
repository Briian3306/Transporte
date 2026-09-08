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
} from '../models/tarifa-refresh.contracts';
import {
  CambioRefrescoTarifa,
  DetectarRefrescoTarifaInput,
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  PrepararRefrescoTarifaInput,
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

@Injectable({ providedIn: 'root' })
export class TarifaRefreshServiceImpl implements TarifaRefreshService {
  private readonly tarifario = inject(PEAJES_TARIFARIO_SERVICE);
  private readonly adapter = inject(TarifaComparisonAdapterService);

  async analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas> {
    const tipos = tiposPorIndice(input.pasadas.length, input.documentos);
    const candidatos = extraerCandidatosRefresco(input.pasadas, {
      tipoDocumento: tipos,
      estacionesViasSentido: input.estacionesViasSentido,
    });
    if (!candidatos.length) {
      return {
        candidatos: [],
        resultados: [],
        filasVigentes: 0,
        filasHistoricas: 0,
        pendientes: 0,
        contextIncomplete: false,
      };
    }

    const unresolvedCandidates = candidatos.filter((candidate) => candidate.sentidoSolicitado == null);
    const resolvedCandidates = candidatos.filter((candidate) => candidate.sentidoSolicitado != null);
    const unresolvedResults: ResultadoDetectarRefresco[] = unresolvedCandidates.map((candidate) => ({
      id: candidate.id,
      codigo: candidate.unresolvedReason === 'CONFLICT' ? 'DIRECTION_CONFLICT' : 'DIRECTION_REQUIRED',
      peajeId: null,
      estacionId: candidate.estacionId,
      categoria: candidate.categoria,
      status: candidate.statusSolicitado,
      sentidoSolicitado: null,
      sentidoAplicado: null,
      importeActual: null,
      tarifaId: null,
      tarifaImporteId: null,
      requiereNormalizacionIva: null,
      rowIndexes: candidate.rowIndexes,
      directionConfidence: candidate.directionConfidence,
      sourceLane: candidate.sourceLane,
      candidatePrice: candidate.candidatePrice,
    }));
    if (!resolvedCandidates.length) {
      return {
        candidatos,
        resultados: unresolvedResults,
        filasVigentes: 0,
        filasHistoricas: 0,
        pendientes: unresolvedResults.reduce((sum, item) => sum + item.rowIndexes.length, 0),
        contextIncomplete: unresolvedResults.length > 0,
      };
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
      const detectKey = `${ctx}|${comparable}`;
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
        statusSolicitado: c.statusSolicitado,
        sentidoSolicitado: c.sentidoSolicitado,
        precioDirecto: c.precioDirecto,
        precioNormalizado: needsIva ? comparable : null,
      });
    }

    const detected = await firstValueFrom(this.tarifario.detectarRefresco(detectInputs));
    const resultados: ResultadoDetectarRefresco[] = detected.flatMap((item) => {
      const group = detectToCandidates.get(item.id) ?? [];
      const rowIndexes = group.flatMap((c) => c.rowIndexes);
      return [
        {
          id: item.id,
          codigo: item.codigo,
          peajeId: item.peajeId,
          estacionId: item.estacionId,
          categoria: item.categoria,
          status: item.status,
          sentidoSolicitado: item.sentidoSolicitado,
          sentidoAplicado: item.sentidoAplicado,
          importeActual: item.importeActual,
          tarifaId: item.tarifaId,
          tarifaImporteId: item.tarifaImporteId,
          requiereNormalizacionIva: item.requiereNormalizacionIva,
          rowIndexes,
          directionConfidence: group[0]?.directionConfidence,
          sourceLane: group[0]?.sourceLane,
          candidatePrice: group[0]?.candidatePrice,
        },
      ];
    });
    resultados.unshift(...unresolvedResults);

    const filasVigentes = resultados
      .filter((r) => r.codigo === 'CURRENT_TARIFF')
      .reduce((n, r) => n + r.rowIndexes.length, 0);
    const filasHistoricas = resultados
      .filter((r) => r.codigo === 'HISTORICAL_TARIFF_MATCH')
      .reduce((n, r) => n + r.rowIndexes.length, 0);
    const pendientes = resultados
      .filter((r) =>
        ['NEW_TARIFF', 'STATUS_REQUIRED', 'STATUS_AMBIGUOUS', 'CONTEXT_INCOMPLETE', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(
          r.codigo,
        ),
      )
      .reduce((n, r) => n + r.rowIndexes.length, 0);

    return {
      candidatos,
      resultados,
      filasVigentes,
      filasHistoricas,
      pendientes,
      contextIncomplete: resultados.some((r) => ['CONTEXT_INCOMPLETE', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(r.codigo)),
    };
  }

  async guardar(cambios: CambioRefrescoTarifa[]): Promise<TarifaRefrescoGuardada[]> {
    return firstValueFrom(this.tarifario.guardarRefresco(cambios));
  }
}

export { TARIFA_REFRESH_SERVICE };
export type { TarifaRefreshService };
