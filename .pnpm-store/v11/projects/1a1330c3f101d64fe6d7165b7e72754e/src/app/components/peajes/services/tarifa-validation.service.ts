import { Injectable, inject } from '@angular/core';
import { ConfiguracionPlantilla } from '../models/peajes.models';
import { SupabaseService } from '../../../services/supabase.service';
import { TarifaComparisonAdapterService } from './tarifa-comparison-adapter.service';

export type CodigoResultadoTarifa =
  | 'AL_DIA'
  | 'HISTORICA'
  | 'DESFASADO'
  | 'SIN_TARIFA'
  | 'CATEGORIA_PENDIENTE'
  | 'ESTADO_AMBIGUO';

export type SentidoTarifa = 'IDA' | 'VUELTA' | 'AMBAS';

export interface PasadaValidacionTarifaInput {
  idx: number;
  estacion_id: string;
  categoria: number | string | null;
  status?: string | null;
  sentido?: SentidoTarifa | string | null;
  fecha_hora?: string | null;
  precio_directo: number;
  pasada_id?: string | null;
  fila: Record<string, unknown>;
}

export interface ResultadoFilaValidacionTarifa {
  idx: number;
  codigo: CodigoResultadoTarifa;
  tarifa_id: string | null;
  current_tarifa_id: string | null;
  tarifa_importe_id: string | null;
  importe: number | null;
  precio_comparado: number | null;
  error_relativo: number | null;
  peaje_id: string | null;
  sentido_solicitado: SentidoTarifa;
  sentido_aplicado: SentidoTarifa | string | null;
  requiere_normalizacion_iva: boolean;
  categoria: number | string | null;
  status: string | null;
  estacion_id: string;
}

export interface ResultadoValidacionTarifa {
  filas: ResultadoFilaValidacionTarifa[];
}

export interface AsociacionTarifaImporte {
  pasada_id: string;
  tarifa_importe_id: string;
  codigo: CodigoResultadoTarifa;
}

interface ResolverRow {
  idx: number;
  codigo?: CodigoResultadoTarifa | string | null;
  tarifa_id?: string | null;
  current_tarifa_id?: string | null;
  importe?: number | null;
  peaje_id?: string | null;
  sentido_aplicado?: string | null;
  requiere_normalizacion_iva?: boolean | null;
}

interface ValidatorRow {
  idx: number;
  codigo?: CodigoResultadoTarifa | string | null;
  tarifa_importe_id?: string | null;
  importe?: number | null;
  precio_comparado?: number | null;
  error_relativo?: number | null;
}

const CODIGOS_TEMPRANOS: ReadonlySet<string> = new Set([
  'SIN_TARIFA',
  'CATEGORIA_PENDIENTE',
  'ESTADO_AMBIGUO',
]);

const CODIGOS_ASOCIABLES: ReadonlySet<string> = new Set(['AL_DIA', 'HISTORICA']);

function sentidoSolicitado(valor: unknown): SentidoTarifa {
  const raw = String(valor ?? '').trim().toUpperCase();
  if (raw === 'IDA' || raw === 'VUELTA') return raw;
  return 'AMBAS';
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function estaResuelta(row: ResolverRow | undefined): boolean {
  if (!row) return false;
  if (row.codigo && CODIGOS_TEMPRANOS.has(String(row.codigo))) return false;
  return row.tarifa_id != null && String(row.tarifa_id).trim() !== '';
}

function rpcError(rpc: string, error: { message?: string } | null): Error {
  const message = error?.message || `Error en ${rpc}`;
  return Object.assign(new Error(message), { ...(error ?? {}), rpc });
}

@Injectable({ providedIn: 'root' })
export class TarifaValidationService {
  private readonly supabase = inject(SupabaseService);
  private readonly adapter = inject(TarifaComparisonAdapterService);

  async validarLote(
    pasadas: PasadaValidacionTarifaInput[],
    configuraciones: ConfiguracionPlantilla[]
  ): Promise<ResultadoValidacionTarifa> {
    return this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      const resolverPayload = pasadas.map((p) => ({
        idx: p.idx,
        estacion_id: p.estacion_id,
        categoria: p.categoria,
        status: p.status ?? null,
        sentido: sentidoSolicitado(p.sentido),
      }));

      const { data: resolverData, error: resolverError } = await client.rpc(
        'peajes_resolver_tarifas_actuales',
        { p_pasadas: resolverPayload }
      );
      if (resolverError) {
        throw rpcError('peajes_resolver_tarifas_actuales', resolverError);
      }

      const resolverRows = asRows<ResolverRow>(resolverData);
      const resolverPorIdx = new Map(resolverRows.map((row) => [row.idx, row]));

      const validatorPayload = pasadas
        .filter((p) => estaResuelta(resolverPorIdx.get(p.idx)))
        .map((p) => {
          const resolved = resolverPorIdx.get(p.idx)!;
          const requiereIva = !!resolved.requiere_normalizacion_iva;
          const precio_normalizado = requiereIva
            ? this.adapter.obtenerPrecioComparable({
                precioDirecto: p.precio_directo,
                requiereNormalizacionIva: true,
                fila: p.fila,
                configuraciones,
              })
            : null;
          return {
            idx: p.idx,
            tarifa_id: resolved.tarifa_id,
            current_tarifa_id: resolved.current_tarifa_id,
            importe: resolved.importe,
            requiere_normalizacion_iva: requiereIva,
            precio_directo: p.precio_directo,
            precio_normalizado,
          };
        });

      let validatorRows: ValidatorRow[] = [];
      if (validatorPayload.length) {
        const { data: validatorData, error: validatorError } = await client.rpc(
          'peajes_validar_tarifas_actuales',
          { p_pasadas: validatorPayload }
        );
        if (validatorError) {
          throw rpcError('peajes_validar_tarifas_actuales', validatorError);
        }
        validatorRows = asRows<ValidatorRow>(validatorData);
      }

      const validatorPorIdx = new Map(validatorRows.map((row) => [row.idx, row]));

      const filas = pasadas.map((p) => {
        const resolved = resolverPorIdx.get(p.idx);
        const validated = validatorPorIdx.get(p.idx);
        const solicitado = sentidoSolicitado(p.sentido);
        const codigo = (validated?.codigo ?? resolved?.codigo ?? 'SIN_TARIFA') as CodigoResultadoTarifa;
        return {
          idx: p.idx,
          codigo,
          tarifa_id: resolved?.tarifa_id ?? null,
          current_tarifa_id: resolved?.current_tarifa_id ?? null,
          tarifa_importe_id: validated?.tarifa_importe_id ?? null,
          importe: validated?.importe ?? resolved?.importe ?? null,
          precio_comparado: validated?.precio_comparado ?? null,
          error_relativo: validated?.error_relativo ?? null,
          peaje_id: resolved?.peaje_id ?? null,
          sentido_solicitado: solicitado,
          sentido_aplicado: resolved?.sentido_aplicado ?? solicitado,
          requiere_normalizacion_iva: !!resolved?.requiere_normalizacion_iva,
          categoria: p.categoria,
          status: p.status ?? null,
          estacion_id: p.estacion_id,
        } satisfies ResultadoFilaValidacionTarifa;
      });

      return { filas };
    });
  }

  async asociarTrasConfirmacion(asociaciones: AsociacionTarifaImporte[]): Promise<void> {
    const p_asociaciones = asociaciones
      .filter((a) => CODIGOS_ASOCIABLES.has(a.codigo))
      .map((a) => ({
        pasada_id: a.pasada_id,
        tarifa_importe_id: a.tarifa_importe_id,
        codigo: a.codigo,
      }));

    return this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      const { error } = await client.rpc('peajes_asociar_pasadas_tarifa_importe', {
        p_asociaciones,
      });
      if (error) {
        throw rpcError('peajes_asociar_pasadas_tarifa_importe', error);
      }
    });
  }
}
