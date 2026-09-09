import { Injectable } from '@angular/core';
import {
  AnalisisRefrescoInput,
  CandidatoRefrescoTarifa,
  RefreshTarifaCodigo,
  ResultadoDetectarRefresco,
  ResumenRefrescoTarifas,
  TarifaRefreshService,
  extraerCandidatosRefresco,
} from '../../models/tarifa-refresh.contracts';
import { CambioRefrescoTarifa, TarifaRefrescoGuardada } from '../../models/tarifario.contracts';

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

  async analizar(input: AnalisisRefrescoInput): Promise<ResumenRefrescoTarifas> {
    const candidatos = extraerCandidatosRefresco(input.pasadas, {
      estacionesViasSentido: input.estacionesViasSentido,
    });
    const resultados: ResultadoDetectarRefresco[] = candidatos.map((c) => ({
      id: c.id,
      codigo: classify(c),
      peajeId: 'peaje-aubasa',
      estacionId: c.estacionId || ESTACION_DOCK_SUD,
      categoria: c.categoria,
      status: c.statusSolicitado,
      sentidoSolicitado: c.sentidoSolicitado,
      sentidoAplicado: c.sentidoSolicitado,
      importeActual:
        c.statusSolicitado === 'PICO'
          ? CURRENT_PICO
          : c.statusSolicitado === 'NO_PICO'
            ? CURRENT_NO_PICO
            : CURRENT_NO_PICO,
      tarifaId: 'tarifa-dock',
      tarifaImporteId: 'ti-current',
      requiereNormalizacionIva: false,
      rowIndexes: c.rowIndexes,
    }));
    return {
      candidatos,
      resultados,
      filasVigentes: resultados.filter((r) => r.codigo === 'CURRENT_TARIFF').reduce((n, r) => n + r.rowIndexes.length, 0),
      filasHistoricas: resultados
        .filter((r) => r.codigo === 'HISTORICAL_TARIFF_MATCH')
        .reduce((n, r) => n + r.rowIndexes.length, 0),
      pendientes: resultados
        .filter((r) =>
          ['NEW_TARIFF', 'STATUS_REQUIRED', 'STATUS_AMBIGUOUS', 'CONTEXT_INCOMPLETE', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(r.codigo),
        )
        .reduce((n, r) => n + r.rowIndexes.length, 0),
      contextIncomplete: resultados.some((r) => ['CONTEXT_INCOMPLETE', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(r.codigo)),
    };
  }

  async guardar(cambios: CambioRefrescoTarifa[]): Promise<TarifaRefrescoGuardada[]> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('No se pudieron guardar las tarifas.');
    }
    this.lastGuardado = cambios.map((c) => ({
      peaje_id: c.peajeId,
      estacion_id: c.estacionId,
      sentido: c.sentido,
      categoria: c.categoria,
      status: c.status,
      tarifa_id: `tarifa-${c.categoria}-${c.status}`,
      anterior: c.status === 'PICO' ? CURRENT_PICO : CURRENT_NO_PICO,
      nueva: c.importe,
      tarifa_importe_id: `ti-new-${c.categoria}-${c.status}`,
      accion: 'ACTUALIZADA' as const,
    }));
    return this.lastGuardado;
  }
}
