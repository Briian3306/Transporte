import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  AuditoriaEstacionRow,
  AuditoriaEstacionesFilters,
  AuditoriaEstacionesListParams,
  AuditoriaEstacionesListResult,
  CorreccionEstacionInput,
  EstadoCasoAuditoriaEstacion,
  FuenteCodigoEstacion,
  HallazgoAuditoriaEstacion,
  PeajesAuditoriaEstacionesService,
  PreviewCorreccionEstacion,
  SecuenciaEsperadaEstacion,
} from '../models/auditoria-estaciones.contracts';
import { SupabaseService } from '../../../services/supabase.service';

type RpcRow = Record<string, unknown>;

function mapFilters(filters: AuditoriaEstacionesFilters | undefined): Record<string, unknown> {
  if (!filters) return {};
  const out: Record<string, unknown> = {};
  if (filters.empresa_ids?.length) out['empresa_ids'] = filters.empresa_ids;
  if (filters.peaje_ids?.length) out['peaje_ids'] = filters.peaje_ids;
  if (filters.estacion_ids?.length) out['estacion_ids'] = filters.estacion_ids;
  if (filters.estados?.length) out['estados'] = filters.estados;
  if (filters.hallazgos?.length) out['hallazgos'] = filters.hallazgos;
  if (filters.q) out['q'] = filters.q;
  return out;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

export function mapAuditoriaEstacionRow(raw: RpcRow): AuditoriaEstacionRow {
  const seq = raw['secuencia_esperada'] as SecuenciaEsperadaEstacion | null;
  return {
    empresaId: String(raw['empresa_id'] ?? ''),
    peajeId: String(raw['peaje_id'] ?? ''),
    estacionId: String(raw['estacion_id'] ?? ''),
    empresaNombre: String(raw['empresa_nombre'] ?? ''),
    peajeNombre: String(raw['peaje_nombre'] ?? ''),
    estacionNombre: String(raw['estacion_nombre'] ?? ''),
    codigoProveedor: String(raw['codigo_proveedor'] ?? ''),
    codigoNormalizado: String(raw['codigo_normalizado'] ?? ''),
    fuentes: asStringArray(raw['fuentes']) as FuenteCodigoEstacion[],
    codigosEstacion: asStringArray(raw['codigos_estacion']),
    estacionesMismoCodigo: Number(raw['estaciones_mismo_codigo'] ?? 1),
    secuenciaEsperada: seq ?? null,
    hallazgos: asStringArray(raw['hallazgos']) as HallazgoAuditoriaEstacion[],
    casoId: raw['caso_id'] == null ? null : String(raw['caso_id']),
    estado: (raw['estado'] as EstadoCasoAuditoriaEstacion) ?? 'PENDIENTE',
    observacion: raw['observacion'] == null ? null : String(raw['observacion']),
    movimientosAfectados: raw['movimientos_afectados'] == null ? null : Number(raw['movimientos_afectados']),
    fingerprint: String(raw['fingerprint'] ?? ''),
  };
}

@Injectable({ providedIn: 'root' })
export class PeajesAuditoriaEstacionesSupabaseService implements PeajesAuditoriaEstacionesService {
  private readonly supabase = inject(SupabaseService);

  listar(params: AuditoriaEstacionesListParams = {}): Observable<AuditoriaEstacionesListResult> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        const { data, error } = await client.rpc('peajes_listar_auditoria_estaciones', {
          p_filtros: mapFilters(params.filters),
          p_page: page,
          p_page_size: pageSize,
          p_sort: params.sort ?? 'estacion_nombre:asc',
        });
        if (error) throw error;
        const payload = (data ?? {}) as { rows?: RpcRow[]; total?: number; page?: number; page_size?: number };
        return {
          rows: (payload.rows ?? []).map(mapAuditoriaEstacionRow),
          total: Number(payload.total ?? 0),
          page: Number(payload.page ?? page),
          pageSize: Number(payload.page_size ?? pageSize),
        };
      }),
    );
  }

  transicionar(
    _casoId: string | null,
    fingerprint: string,
    estado: EstadoCasoAuditoriaEstacion,
    observacion: string | null,
    row: Pick<AuditoriaEstacionRow, 'empresaId' | 'peajeId' | 'estacionId' | 'hallazgos' | 'codigosEstacion'>,
  ): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_transicionar_caso_estacion', {
          p_fingerprint: fingerprint,
          p_estado: estado,
          p_observacion: observacion,
          p_empresa_id: row.empresaId,
          p_peaje_id: row.peajeId,
          p_estacion_id: row.estacionId,
          p_tipo: row.hallazgos[0] ?? 'SECUENCIA_NUMERICA_CON_SALTO',
        });
        if (error) throw error;
        const payload = (data ?? {}) as { caso_id?: string; estado?: EstadoCasoAuditoriaEstacion };
        return { casoId: String(payload.caso_id), estado: payload.estado ?? estado };
      }),
    );
  }

  previsualizar(casoId: string, estacionDestinoId: string): Observable<PreviewCorreccionEstacion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_previsualizar_correccion_estacion', {
          p_caso_id: casoId,
          p_estacion_destino_id: estacionDestinoId,
        });
        if (error) throw error;
        const payload = (data ?? {}) as Record<string, unknown>;
        return {
          casoId: String(payload['caso_id'] ?? casoId),
          previewHash: String(payload['preview_hash'] ?? ''),
          estacionOrigenId: String(payload['estacion_origen_id'] ?? ''),
          estacionDestinoId: String(payload['estacion_destino_id'] ?? estacionDestinoId),
          aliasAjustes: [],
          catalogoAjustes: [],
          pasadas: Array.isArray(payload['pasadas'])
            ? (payload['pasadas'] as Array<Record<string, unknown>>).map((p) => ({
                id: String(p['id']),
                fechaHora: String(p['fecha_hora'] ?? ''),
              }))
            : [],
        };
      }),
    );
  }

  corregir(input: CorreccionEstacionInput): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_corregir_caso_estacion', {
          p_caso_id: input.casoId,
          p_estacion_destino_id: input.estacionDestinoId,
          p_modalidad: input.modalidad,
          p_preview_hash: input.previewHash,
          p_observacion: input.observacion ?? null,
        });
        if (error) throw error;
        const payload = (data ?? {}) as { caso_id?: string; estado?: EstadoCasoAuditoriaEstacion };
        return { casoId: String(payload.caso_id ?? input.casoId), estado: payload.estado ?? 'CORREGIDO' };
      }),
    );
  }
}
