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
  TarifaMatchOption,
  TarifaRefreshDecision,
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
    ...mapVigenciaDiagnostico(raw),
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
    ...mapVigenciaDiagnostico(raw),
  };
}

function pickRaw(raw: Record<string, unknown>, snake: string, camel: string): unknown {
  if (Object.prototype.hasOwnProperty.call(raw, snake) && raw[snake] !== undefined) return raw[snake];
  if (Object.prototype.hasOwnProperty.call(raw, camel) && raw[camel] !== undefined) return raw[camel];
  return raw[snake] ?? raw[camel];
}

function asDateString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function mapVigenciaDiagnostico(raw: Record<string, unknown>): {
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  diagnostico: string | null;
  categoriaCalculada: number | null;
} {
  const diagnosticoRaw = pickRaw(raw, 'diagnostico', 'diagnostico');
  return {
    fechaVigenciaInicio: asDateString(pickRaw(raw, 'fecha_vigencia_inicio', 'fechaVigenciaInicio')),
    fechaVigenciaFin: asDateString(pickRaw(raw, 'fecha_vigencia_fin', 'fechaVigenciaFin')),
    diagnostico: diagnosticoRaw == null ? null : String(diagnosticoRaw),
    categoriaCalculada: asNullableNumber(pickRaw(raw, 'categoria_calculada', 'categoriaCalculada')),
  };
}

function mapImporteCambio(c: TarifarioImporteCambio): Record<string, unknown> {
  return {
    categoria: c.categoria,
    status: c.status,
    importe: c.importe,
    fecha_vigencia_inicio: c.fechaVigenciaInicio ?? null,
  };
}

function mapMatchOption(raw: Record<string, unknown>): TarifaMatchOption {
  return {
    tarifaId: String(pickRaw(raw, 'tarifa_id', 'tarifaId') ?? ''),
    tarifaImporteId: String(pickRaw(raw, 'tarifa_importe_id', 'tarifaImporteId') ?? ''),
    categoria: asNumber(pickRaw(raw, 'categoria', 'categoria')),
    status: String(pickRaw(raw, 'status', 'status') ?? '') as TarifaStatusPico,
    sentido: String(pickRaw(raw, 'sentido', 'sentido') ?? '') as TarifaSentido,
    importe: asNumber(pickRaw(raw, 'importe', 'importe')),
    diagnostico: pickRaw(raw, 'diagnostico', 'diagnostico') == null ? null : String(pickRaw(raw, 'diagnostico', 'diagnostico')),
    fechaVigenciaInicio: asDateString(pickRaw(raw, 'fecha_vigencia_inicio', 'fechaVigenciaInicio')),
    fechaVigenciaFin: asDateString(pickRaw(raw, 'fecha_vigencia_fin', 'fechaVigenciaFin')),
    esActual: Boolean(pickRaw(raw, 'es_actual', 'esActual')),
    errorRelativo: asNumber(pickRaw(raw, 'error_relativo', 'errorRelativo')),
  };
}

function mapPossibleMatches(value: unknown): TarifaMatchOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(mapMatchOption);
}

function mapPreparar(raw: Record<string, unknown>): PrepararRefrescoTarifaItem {
  return {
    id: String(raw['id'] ?? ''),
    peajeId: raw['peaje_id'] == null ? null : String(raw['peaje_id']),
    estacionId: String(raw['estacion_id'] ?? ''),
    categoria: asNullableNumber(raw['categoria']),
    status: raw['status'] == null ? null : (String(raw['status']) as TarifaStatusPico),
    sentido: raw['sentido'] == null ? null : String(raw['sentido']) as TarifaSentido,
    tarifaId: raw['tarifa_id'] == null ? null : String(raw['tarifa_id']),
    importe: asNullableNumber(raw['importe']),
    requiereNormalizacionIva: Boolean(raw['requiere_normalizacion_iva']),
  };
}

function mapDetectar(raw: Record<string, unknown>): DetectarRefrescoTarifaItem {
  const categoriaProveedor = asNullableNumber(pickRaw(raw, 'categoria_proveedor', 'categoriaProveedor') ?? raw['categoria']);
  return {
    id: String(pickRaw(raw, 'id', 'id') ?? ''),
    codigo: String(pickRaw(raw, 'codigo', 'codigo') ?? '') as DetectarRefrescoTarifaItem['codigo'],
    peajeId: pickRaw(raw, 'peaje_id', 'peajeId') == null ? null : String(pickRaw(raw, 'peaje_id', 'peajeId')),
    estacionId: String(pickRaw(raw, 'estacion_id', 'estacionId') ?? ''),
    categoria: categoriaProveedor,
    categoriaProveedor,
    categoriaCalculada: asNullableNumber(pickRaw(raw, 'categoria_calculada', 'categoriaCalculada')),
    status: pickRaw(raw, 'status', 'status') == null ? null : (String(pickRaw(raw, 'status', 'status')) as TarifaStatusPico),
    sentidoSolicitado:
      pickRaw(raw, 'sentido_solicitado', 'sentidoSolicitado') == null
        ? null
        : (String(pickRaw(raw, 'sentido_solicitado', 'sentidoSolicitado')) as TarifaSentido),
    sentidoAplicado:
      pickRaw(raw, 'sentido_aplicado', 'sentidoAplicado') == null
        ? null
        : (String(pickRaw(raw, 'sentido_aplicado', 'sentidoAplicado')) as TarifaSentido),
    importeActual: asNullableNumber(pickRaw(raw, 'importe_actual', 'importeActual')),
    tarifaId: pickRaw(raw, 'tarifa_id', 'tarifaId') == null ? null : String(pickRaw(raw, 'tarifa_id', 'tarifaId')),
    tarifaImporteId:
      pickRaw(raw, 'tarifa_importe_id', 'tarifaImporteId') == null
        ? null
        : String(pickRaw(raw, 'tarifa_importe_id', 'tarifaImporteId')),
    requiereNormalizacionIva:
      pickRaw(raw, 'requiere_normalizacion_iva', 'requiereNormalizacionIva') == null
        ? null
        : Boolean(pickRaw(raw, 'requiere_normalizacion_iva', 'requiereNormalizacionIva')),
    diagnostico: pickRaw(raw, 'diagnostico', 'diagnostico') == null ? null : String(pickRaw(raw, 'diagnostico', 'diagnostico')),
    fechaVigenciaInicio: asDateString(pickRaw(raw, 'fecha_vigencia_inicio', 'fechaVigenciaInicio')),
    fechaVigenciaFin: asDateString(pickRaw(raw, 'fecha_vigencia_fin', 'fechaVigenciaFin')),
    possibleMatches: mapPossibleMatches(pickRaw(raw, 'possible_matches', 'possibleMatches')),
  };
}

function mapGuardado(raw: Record<string, unknown>): TarifaRefrescoGuardada {
  const fechaInicio = asDateString(pickRaw(raw, 'fecha_vigencia_inicio', 'fechaVigenciaInicio'));
  const fechaFin = asDateString(pickRaw(raw, 'fecha_vigencia_fin', 'fechaVigenciaFin'));
  const categoriaCalculada = asNullableNumber(pickRaw(raw, 'categoria_calculada', 'categoriaCalculada'));
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
    candidate_id: pickRaw(raw, 'candidate_id', 'candidateId') == null ? null : String(pickRaw(raw, 'candidate_id', 'candidateId')),
    anterior_fin: asDateString(pickRaw(raw, 'anterior_fin', 'anteriorFin')),
    fecha_vigencia_inicio: fechaInicio,
    fecha_vigencia_fin: fechaFin,
    diagnostico: pickRaw(raw, 'diagnostico', 'diagnostico') == null ? null : String(pickRaw(raw, 'diagnostico', 'diagnostico')),
    categoria_calculada: categoriaCalculada,
    fechaVigenciaInicio: fechaInicio,
    fechaVigenciaFin: fechaFin,
    categoriaCalculada,
  };
}

function mapHistorial(raw: Record<string, unknown>): TarifarioHistorialItem {
  return {
    id: String(raw['id'] ?? ''),
    importe: asNumber(raw['importe']),
    fecha_aparicion: String(raw['fecha_aparicion'] ?? ''),
    es_actual: Boolean(raw['es_actual']),
    ...mapVigenciaDiagnostico(raw),
  };
}

function isRefreshDecision(c: CambioRefrescoTarifa | TarifaRefreshDecision): c is TarifaRefreshDecision {
  return 'action' in c && (c.action === 'CONFIRM_NEW' || c.action === 'MARK_REVIEW');
}

function mapCambioRpc(c: CambioRefrescoTarifa | TarifaRefreshDecision): Record<string, unknown> {
  if (isRefreshDecision(c)) {
    return {
      candidate_id: c.candidateId,
      action: c.action,
      peaje_id: c.peajeId,
      estacion_id: c.estacionId,
      categoria: c.categoriaCalculada ?? c.categoriaProveedor,
      categoria_proveedor: c.categoriaProveedor,
      categoria_calculada: c.categoriaCalculada,
      status: c.status,
      sentido: c.sentido,
      importe: c.importe,
      fecha_vigencia_inicio: c.fechaVigenciaInicio,
      cases: c.cases,
      requiere_normalizacion_iva: c.requiereNormalizacionIva,
    };
  }
  return {
    peaje_id: c.peajeId,
    estacion_id: c.estacionId,
    sentido: c.sentido,
    categoria: c.categoria,
    status: c.status,
    importe: c.importe,
    cases: c.cases,
    requiere_normalizacion_iva: c.requiereNormalizacionIva,
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
          p_cambios: cambios.map(mapImporteCambio),
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
            categoria_proveedor: c.categoriaProveedor ?? c.categoria,
            status_solicitado: c.statusSolicitado,
            sentido_solicitado: c.sentidoSolicitado,
            fecha_pasada: c.fechaPasada ?? null,
            precio_directo: c.precioDirecto,
            precio_normalizado: c.precioNormalizado,
          })),
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapDetectar);
      }),
    );
  }

  guardarRefresco(
    cambios: Array<CambioRefrescoTarifa | TarifaRefreshDecision>,
  ): Observable<TarifaRefrescoGuardada[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_guardar_refresco_tarifas', {
          p_cambios: cambios.map((c) => mapCambioRpc(c)),
        });
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).map(mapGuardado);
      }),
    );
  }
}
