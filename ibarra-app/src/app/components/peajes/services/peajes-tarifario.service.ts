import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import {
  CambioRefrescoTarifa,
  DetectarRefrescoTarifaInput,
  DetectarRefrescoTarifaItem,
  PeajesTarifarioService,
  PrepararRefrescoTarifaInput,
  PrepararRefrescoTarifaItem,
  TarifaRefrescoGuardada,
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

function mapPreparar(raw: Record<string, unknown>): PrepararRefrescoTarifaItem {
  return {
    id: String(raw['id'] ?? ''),
    peajeId: raw['peaje_id'] == null ? null : String(raw['peaje_id']),
    estacionId: String(raw['estacion_id'] ?? ''),
    categoria: asNullableNumber(raw['categoria']),
    status: raw['status'] == null ? null : (String(raw['status']) as TarifaStatusPico),
    sentido: String(raw['sentido'] ?? 'AMBAS') as TarifaSentido,
    tarifaId: raw['tarifa_id'] == null ? null : String(raw['tarifa_id']),
    importe: asNullableNumber(raw['importe']),
    requiereNormalizacionIva: Boolean(raw['requiere_normalizacion_iva']),
  };
}

function mapDetectar(raw: Record<string, unknown>): DetectarRefrescoTarifaItem {
  return {
    id: String(raw['id'] ?? ''),
    codigo: String(raw['codigo'] ?? '') as DetectarRefrescoTarifaItem['codigo'],
    peajeId: raw['peaje_id'] == null ? null : String(raw['peaje_id']),
    estacionId: String(raw['estacion_id'] ?? ''),
    categoria: asNullableNumber(raw['categoria']),
    status: raw['status'] == null ? null : (String(raw['status']) as TarifaStatusPico),
    sentidoSolicitado: String(raw['sentido_solicitado'] ?? 'AMBAS') as TarifaSentido,
    sentidoAplicado:
      raw['sentido_aplicado'] == null ? null : (String(raw['sentido_aplicado']) as TarifaSentido),
    importeActual: asNullableNumber(raw['importe_actual']),
    tarifaId: raw['tarifa_id'] == null ? null : String(raw['tarifa_id']),
    tarifaImporteId: raw['tarifa_importe_id'] == null ? null : String(raw['tarifa_importe_id']),
    requiereNormalizacionIva:
      raw['requiere_normalizacion_iva'] == null
        ? null
        : Boolean(raw['requiere_normalizacion_iva']),
  };
}

function mapGuardado(raw: Record<string, unknown>): TarifaRefrescoGuardada {
  return {
    peaje_id: String(raw['peaje_id'] ?? ''),
    estacion_id: String(raw['estacion_id'] ?? ''),
    sentido: String(raw['sentido'] ?? 'AMBAS') as TarifaSentido,
    categoria: asNumber(raw['categoria']),
    status: String(raw['status']) as TarifaStatusPico,
    tarifa_id: String(raw['tarifa_id'] ?? ''),
    anterior: asNullableNumber(raw['anterior']),
    nueva: asNumber(raw['nueva']),
    tarifa_importe_id:
      raw['tarifa_importe_id'] == null ? null : String(raw['tarifa_importe_id']),
    accion: String(raw['accion'] ?? 'SIN_CAMBIO') as TarifaRefrescoGuardada['accion'],
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

  prepararRefresco(
    candidatos: PrepararRefrescoTarifaInput[],
  ): Observable<PrepararRefrescoTarifaItem[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_preparar_refresco_tarifas', {
          p_candidatos: candidatos.map((c) => ({
            id: c.id,
            estacion_id: c.estacionId,
            categoria: c.categoria,
            status_solicitado: c.statusSolicitado,
            sentido_solicitado: c.sentidoSolicitado,
          })),
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapPreparar);
      }),
    );
  }

  detectarRefresco(
    candidatos: DetectarRefrescoTarifaInput[],
  ): Observable<DetectarRefrescoTarifaItem[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_detectar_refresco_tarifas', {
          p_candidatos: candidatos.map((c) => ({
            id: c.id,
            estacion_id: c.estacionId,
            categoria: c.categoria,
            status_solicitado: c.statusSolicitado,
            sentido_solicitado: c.sentidoSolicitado,
            precio_directo: c.precioDirecto,
            precio_normalizado: c.precioNormalizado,
          })),
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapDetectar);
      }),
    );
  }

  guardarRefresco(cambios: CambioRefrescoTarifa[]): Observable<TarifaRefrescoGuardada[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_guardar_refresco_tarifas', {
          p_cambios: cambios.map((c) => ({
            peaje_id: c.peajeId,
            estacion_id: c.estacionId,
            sentido: c.sentido,
            categoria: c.categoria,
            status: c.status,
            importe: c.importe,
            requiere_normalizacion_iva: c.requiereNormalizacionIva,
          })),
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapGuardado);
      }),
    );
  }
}
