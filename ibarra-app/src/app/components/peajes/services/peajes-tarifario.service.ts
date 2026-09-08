import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import {
  PeajesTarifarioService,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioCurrentRow,
  TarifarioEditorPayload,
  TarifarioHistorialItem,
  TarifarioIdentidadExistente,
  TarifarioImporteCambio,
  TarifarioListParams,
  TarifarioListResult,
} from '../models/tarifario.contracts';

type RpcListPayload = {
  rows?: Record<string, unknown>[];
  total?: number;
  page?: number;
  page_size?: number;
};

function asNumber(value: unknown): number {
  return Number(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapListRow(raw: Record<string, unknown>): TarifarioCurrentRow {
  return {
    tarifa_id: String(raw['tarifa_id'] ?? ''),
    peaje_id: String(raw['peaje_id'] ?? ''),
    peaje_nombre: raw['peaje_nombre'] == null ? null : String(raw['peaje_nombre']),
    estacion_id: String(raw['estacion_id'] ?? ''),
    estacion_nombre: String(raw['estacion_nombre'] ?? ''),
    categoria: asNumber(raw['categoria']),
    status: String(raw['status']) as TarifaStatusPico,
    sentido: String(raw['sentido']) as TarifaSentido,
    importe: asNullableNumber(raw['importe']),
    fecha_actualizacion:
      raw['fecha_actualizacion'] == null ? null : String(raw['fecha_actualizacion']),
    current_tarifa_importe_id:
      raw['current_tarifa_importe_id'] == null
        ? null
        : String(raw['current_tarifa_importe_id']),
  };
}

function mapExistente(raw: Record<string, unknown>): TarifarioIdentidadExistente {
  return {
    tarifa_id: String(raw['tarifa_id'] ?? ''),
    categoria: asNumber(raw['categoria']),
    status: String(raw['status']) as TarifaStatusPico,
    current_tarifa_importe_id:
      raw['current_tarifa_importe_id'] == null
        ? null
        : String(raw['current_tarifa_importe_id']),
    importe: asNullableNumber(raw['importe']),
    fecha_actualizacion:
      raw['fecha_actualizacion'] == null ? null : String(raw['fecha_actualizacion']),
  };
}

function mapHistorial(raw: Record<string, unknown>): TarifarioHistorialItem {
  return {
    id: String(raw['id'] ?? ''),
    importe: asNumber(raw['importe']),
    fecha_aparicion: String(raw['fecha_aparicion'] ?? ''),
    es_actual: Boolean(raw['es_actual']),
  };
}

@Injectable({ providedIn: 'root' })
export class PeajesTarifarioSupabaseService implements PeajesTarifarioService {
  private readonly supabase = inject(SupabaseService);

  listar(params: TarifarioListParams = {}): Observable<TarifarioListResult> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        const { data, error } = await client.rpc('peajes_listar_tarifas_actuales', {
          p_filtros: params.filters ?? {},
          p_page: page,
          p_page_size: pageSize,
          p_sort: params.sort ?? 'estacion_nombre:asc',
        });
        if (error) throw error;
        const payload = (data ?? {}) as RpcListPayload;
        return {
          rows: (payload.rows ?? []).map(mapListRow),
          total: Number(payload.total ?? 0),
          page: Number(payload.page ?? page),
          pageSize: Number(payload.page_size ?? pageSize),
        } satisfies TarifarioListResult;
      }),
    );
  }

  obtenerEditor(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
  ): Observable<TarifarioEditorPayload> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_obtener_tarifario_editor', {
          p_peaje_id: peajeId,
          p_estacion_id: estacionId,
          p_sentido: sentido,
        });
        if (error) throw error;
        const payload = (data ?? {}) as {
          context?: TarifarioEditorPayload['context'];
          existentes?: Record<string, unknown>[] | null;
        };
        return {
          context: payload.context as TarifarioEditorPayload['context'],
          existentes: (payload.existentes ?? []).map(mapExistente),
        } satisfies TarifarioEditorPayload;
      }),
    );
  }

  guardar(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
    cambios: TarifarioImporteCambio[],
  ): Observable<{ actualizadas: number }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_guardar_tarifas_actuales', {
          p_peaje_id: peajeId,
          p_estacion_id: estacionId,
          p_sentido: sentido,
          p_cambios: cambios,
        });
        if (error) throw error;
        return {
          actualizadas: Number(
            (data as { actualizadas?: number } | null)?.actualizadas ?? 0,
          ),
        };
      }),
    );
  }

  listarHistorial(tarifaId: string): Observable<TarifarioHistorialItem[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_listar_tarifa_historial', {
          p_tarifa_id: tarifaId,
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapHistorial);
      }),
    );
  }
}
