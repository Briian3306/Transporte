import { Injectable } from '@angular/core';
import {
  AnalisisRefrescoInput,
  CandidatoRefrescoTarifa,
  RefreshTarifaCodigo,
  ResultadoDetectarRefresco,
  ResumenRefrescoTarifas,
  TarifaRefreshService,
  extraerCandidatosRefresco,
  resumirFilasRefresco,
} from '../../models/tarifa-refresh.contracts';
import {
  CambioRefrescoTarifa,
  TarifaRefreshDecision,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';

export const ESTACION_DOCK_SUD = 'est-dock-sud';
export const SHARED_PRICE_NO_PICO = 25500;
export const SHARED_PRICE_PICO = 28740.39;
export const OUTLIER_PRICE_NO_PICO = 18000;

const CURRENT_NO_PICO = 11975.15;
const CURRENT_PICO = 14968.96;
const HISTORICAL_NO_PICO = 12000;

function withinPct(precio: number, importe: number): boolean {
  if (importe === 0) return false;
  return Math.abs(precio - importe) / importe <= 0.01;
}

function classify(c: CandidatoRefrescoTarifa): RefreshTarifaCodigo {
  if (c.sentidoSolicitado == null) {
    return c.unresolvedReason === 'CONFLICT' ? 'DIRECTION_CONFLICT' : 'DIRECTION_REQUIRED';
  }
  if (c.estacionId !== ESTACION_DOCK_SUD) {
    if (!c.estacionId) return 'CONTEXT_INCOMPLETE';
    return 'CURRENT_TARIFF';
  }
  if (c.categoria == null) return 'CONTEXT_INCOMPLETE';
  const status = c.statusSolicitado;
  if (status === 'NO_PICO' || status == null) {
    if (withinPct(c.precioDirecto, CURRENT_NO_PICO)) return 'CURRENT_TARIFF';
    if (withinPct(c.precioDirecto, HISTORICAL_NO_PICO)) return 'HISTORICAL_TARIFF_MATCH';
  }
  if (status === 'PICO' || status == null) {
    if (withinPct(c.precioDirecto, CURRENT_PICO)) return 'CURRENT_TARIFF';
  }
  if (status == null) {
    const hits = [
      withinPct(c.precioDirecto, CURRENT_NO_PICO) || withinPct(c.precioDirecto, HISTORICAL_NO_PICO),
      withinPct(c.precioDirecto, CURRENT_PICO),
    ].filter(Boolean).length;
    if (hits > 1) return 'STATUS_AMBIGUOUS';
    if (hits === 0) return 'STATUS_REQUIRED';
  }
  return 'NEW_TARIFF';
}

@Injectable()
export class TarifaRefreshMockService implements TarifaRefreshService {
  failNextSave = false;
  lastGuardado: TarifaRefrescoGuardada[] = [];
  private decisiones: TarifaRefreshDecision[] = [];

  async analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas> {
    const candidatos = extraerCandidatosRefresco(input.pasadas, {
      estacionesViasSentido: input.estacionesViasSentido,
      documentos: input.documentos,
      estacionesCatalogo: input.estacionesCatalogo,
    });
    const resultados: ResultadoDetectarRefresco[] = candidatos.map((c) => {
      const decision = this.decisionPara(c);
      const codigo = codigoTrasDecision(classify(c), decision);
      const saved = this.lastGuardado.find(
        (row) => row.candidate_id === c.id || row.estacion_id === c.estacionId,
      );
      return {
        id: c.id,
        codigo,
        peajeId: c.peajeId ?? 'peaje-aubasa',
        estacionId: c.estacionId || ESTACION_DOCK_SUD,
        categoria: c.categoria,
        categoriaProveedor: c.categoriaProveedor,
        categoriaCalculada: decision?.categoriaCalculada ?? c.categoriaCalculada,
        status: c.statusSolicitado,
        sentidoSolicitado: c.sentidoSolicitado,
        sentidoAplicado: c.sentidoSolicitado,
        importeActual:
          c.statusSolicitado === 'PICO'
            ? CURRENT_PICO
            : c.statusSolicitado === 'NO_PICO'
              ? CURRENT_NO_PICO
              : CURRENT_NO_PICO,
        tarifaId: saved?.tarifa_id ?? 'tarifa-dock',
        tarifaImporteId: saved?.tarifa_importe_id ?? 'ti-current',
        requiereNormalizacionIva: false,
        diagnostico: decision?.action === 'MARK_REVIEW' ? 'REVISAR' : decision ? 'CONFIRMADO' : null,
        fechaVigenciaInicio: decision?.fechaVigenciaInicio ?? null,
        fechaPasada: c.fechaPasada,
        possibleMatches: [],
        rowIndexes: c.rowIndexes,
      };
    });
    return {
      candidatos,
      resultados,
      ...resumirFilasRefresco(resultados),
    };
  }

  async guardar(
    cambios: Array<CambioRefrescoTarifa | TarifaRefreshDecision>,
  ): Promise<TarifaRefrescoGuardada[]> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('No se pudieron guardar las tarifas.');
    }
    this.decisiones = cambios.filter(isRefreshDecision);
    this.lastGuardado = cambios.map((c) => {
      const categoria = isRefreshDecision(c) ? (c.categoriaCalculada ?? c.categoriaProveedor) : c.categoria;
      const review = isRefreshDecision(c) && c.action === 'MARK_REVIEW';
      return {
        peaje_id: c.peajeId,
        estacion_id: c.estacionId,
        sentido: c.sentido,
        categoria,
        status: c.status,
        tarifa_id: `tarifa-${c.estacionId}-${c.sentido}-${categoria}-${c.status}`,
        anterior: c.status === 'PICO' ? CURRENT_PICO : CURRENT_NO_PICO,
        nueva: c.importe,
        tarifa_importe_id: `ti-new-${c.estacionId}-${c.sentido}-${categoria}-${c.status}`,
        accion: 'ACTUALIZADA' as const,
        candidate_id: isRefreshDecision(c) ? c.candidateId : null,
        fecha_vigencia_inicio: isRefreshDecision(c) ? c.fechaVigenciaInicio : null,
        fechaVigenciaInicio: isRefreshDecision(c) ? c.fechaVigenciaInicio : null,
        diagnostico: review ? 'REVISAR' : 'CONFIRMADO',
      };
    });
    return this.lastGuardado;
  }

  private decisionPara(c: CandidatoRefrescoTarifa): TarifaRefreshDecision | undefined {
    return this.decisiones.find(
      (item) =>
        item.candidateId === c.id ||
        (item.estacionId === c.estacionId &&
          item.importe === c.precioDirecto &&
          (c.statusSolicitado == null || item.status === c.statusSolicitado) &&
          (c.sentidoSolicitado == null || item.sentido === c.sentidoSolicitado)),
    );
  }
}

function codigoTrasDecision(
  base: RefreshTarifaCodigo,
  decision: TarifaRefreshDecision | undefined,
): RefreshTarifaCodigo {
  if (!decision) return base;
  return decision.action === 'MARK_REVIEW' ? 'REVIEW_RECORDED' : 'CURRENT_TARIFF';
}

function isRefreshDecision(
  c: CambioRefrescoTarifa | TarifaRefreshDecision,
): c is TarifaRefreshDecision {
  return 'action' in c && (c.action === 'CONFIRM_NEW' || c.action === 'MARK_REVIEW');
}
