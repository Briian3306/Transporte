import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  PeajesAuditoriaTarifasService,
  TarifaAsignacion,
  TarifaDiagnostico,
  TarifaGrupoSimilar,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
  TarifasNormalizadasFilters,
  TarifasNormalizadasListParams,
  TarifasNormalizadasListResult,
} from '../models/auditoria-tarifas.contracts';
import { SupabaseService } from '../../../services/supabase.service';

type RpcListRow = TarifaNormalizadaRow & {
  patron?: string;
  niveles_familia?: number;
  status_etiqueta?: string | null;
  status_color?: string | null;
  status_tipo_meta?: string | null;
};

function mapFilters(filters: TarifasNormalizadasFilters | undefined): Record<string, unknown> {
  if (!filters) return {};
  const out: Record<string, unknown> = {};
  if (filters.peaje_ids?.length) out['peaje_ids'] = filters.peaje_ids;
  if (filters.estacion_ids?.length) out['estacion_ids'] = filters.estacion_ids;
  if (filters.categorias?.length) out['categorias'] = filters.categorias;
  if (filters.diagnosticos?.length) out['diagnosticos'] = filters.diagnosticos;
  if (filters.status?.length) out['status'] = filters.status;
  if (filters.patron) out['patron'] = filters.patron;
  if (filters.solo_muestra_confiable != null) {
    out['solo_muestra_confiable'] = filters.solo_muestra_confiable;
  }
  if (filters.q_estacion) out['q_estacion'] = filters.q_estacion;
  // fecha_desde / fecha_hasta: no filtrables en tarifas_normalizadas (agregado);
  // se documentan como no-op hasta que exista snapshot temporal.
  return out;
}

function mapRow(raw: RpcListRow): TarifaNormalizadaRow {
  return {
    id: String(raw.id),
    peaje_id: String(raw.peaje_id),
    peaje_nombre: raw.peaje_nombre ?? null,
    estacion_id: String(raw.estacion_id),
    estacion_nombre: String(raw.estacion_nombre ?? ''),
    categoria: raw.categoria ?? null,
    importe: Number(raw.importe),
    cases: Number(raw.cases),
    importe_base: Number(raw.importe_base),
    multiplicador: Number(raw.multiplicador),
    hora_min: raw.hora_min == null ? null : Number(raw.hora_min),
    hora_max: raw.hora_max == null ? null : Number(raw.hora_max),
    hora_media: raw.hora_media == null ? null : Number(raw.hora_media),
    desvio: raw.desvio == null ? null : Number(raw.desvio),
    muestra_confiable: Boolean(raw.muestra_confiable),
    diagnostico: raw.diagnostico as TarifaDiagnostico,
    status: String(raw.status),
    confirmado_manual: Boolean(raw.confirmado_manual),
  };
}

@Injectable({ providedIn: 'root' })
export class PeajesAuditoriaTarifasSupabaseService implements PeajesAuditoriaTarifasService {
  private readonly supabase = inject(SupabaseService);

  listar(params: TarifasNormalizadasListParams = {}): Observable<TarifasNormalizadasListResult> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        const { data, error } = await client.rpc('peajes_listar_tarifas_normalizadas', {
          p_filtros: mapFilters(params.filters),
          p_page: page,
          p_page_size: pageSize,
          p_sort: params.sort ?? 'cases:desc',
        });
        if (error) throw error;
        const rows = ((data?.rows ?? []) as RpcListRow[]).map(mapRow);
        return {
          rows,
          total: Number(data?.total ?? 0),
          page: Number(data?.page ?? page),
          pageSize: Number(data?.page_size ?? pageSize),
        } satisfies TarifasNormalizadasListResult;
      })
    );
  }

  listarStatusCatalogo(peajeId: string): Observable<TarifaStatusCatalogo[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client
          .from('tarifas_status_catalogo')
          .select('peaje_id, codigo, etiqueta, color, tipo_meta, orden')
          .eq('peaje_id', peajeId)
          .order('orden', { ascending: true });
        if (error) throw error;
        return (data ?? []) as TarifaStatusCatalogo[];
      })
    );
  }

  listarCategorias(peajeIds?: string[]): Observable<string[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let query = client
          .from('tarifas_normalizadas')
          .select('categoria')
          .not('categoria', 'is', null);
        if (peajeIds?.length) {
          query = query.in('peaje_id', peajeIds);
        }
        const { data, error } = await query;
        if (error) throw error;
        const cats = [
          ...new Set(
            (data ?? [])
              .map((r: { categoria: string | null }) => r.categoria)
              .filter((c): c is string => c != null && c !== '')
          ),
        ].sort();
        return cats;
      })
    );
  }

  confirmarStatus(asignaciones: TarifaAsignacion[]): Observable<{ actualizadas: number }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_confirmar_status_tarifa', {
          p_asignaciones: asignaciones,
        });
        if (error) throw error;
        return {
          actualizadas: Number(
            data?.niveles_confirmados ?? data?.pasadas_actualizadas ?? asignaciones.length
          ),
        };
      })
    );
  }

  marcarDiagnostico(
    tarifaNormalizadaId: string,
    diagnostico: TarifaDiagnostico
  ): Observable<TarifaNormalizadaRow> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { error } = await client.rpc('peajes_marcar_diagnostico_tarifa', {
          p_tarifa_normalizada_id: tarifaNormalizadaId,
          p_diagnostico: diagnostico,
        });
        if (error) throw error;

        const { data: row, error: selError } = await client
          .from('tarifas_normalizadas')
          .select(
            'id, peaje_id, estacion_id, categoria, importe, cases, importe_base, multiplicador, hora_min, hora_max, hora_media, desvio, muestra_confiable, diagnostico, status, confirmado_manual'
          )
          .eq('id', tarifaNormalizadaId)
          .maybeSingle();
        if (selError) throw selError;
        if (!row) throw new Error(`Nivel de tarifa ${tarifaNormalizadaId} no encontrado`);

        const [{ data: peaje }, { data: estacion }] = await Promise.all([
          client.from('peajes').select('nombre').eq('id', row.peaje_id).maybeSingle(),
          client.from('estaciones').select('nombre').eq('id', row.estacion_id).maybeSingle(),
        ]);

        return mapRow({
          ...(row as RpcListRow),
          peaje_nombre: peaje?.nombre ?? null,
          estacion_nombre: estacion?.nombre ?? '',
        });
      })
    );
  }

  gruposSimilares(
    tarifaNormalizadaId: string,
    tolerancia: number
  ): Observable<TarifaGrupoSimilar[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_grupos_similares_tarifa', {
          p_tarifa_normalizada_id: tarifaNormalizadaId,
          p_tolerancia: tolerancia,
        });
        if (error) throw error;
        const rows = (data ?? []) as Array<{
          estacion_id: string;
          estacion_nombre: string;
          categoria: string | null;
          ratio: number;
          niveles: number;
          cases_total: number;
          importe_min: number;
          importe_max: number;
          pendientes: number;
          tarifa_ids: string[] | null;
        }>;
        return rows.map(
          (r) =>
            ({
              estacion_id: String(r.estacion_id),
              estacion_nombre: String(r.estacion_nombre ?? ''),
              categoria: r.categoria ?? null,
              niveles: Number(r.niveles),
              cases: Number(r.cases_total),
              importe_min: Number(r.importe_min),
              importe_max: Number(r.importe_max),
              ratio: Number(r.ratio),
              pendientes: Number(r.pendientes),
              tarifa_ids: (r.tarifa_ids ?? []).map(String),
            }) satisfies TarifaGrupoSimilar
        );
      })
    );
  }

  recalcular(peajeId: string): Observable<{ familias: number }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { error } = await client.rpc('peajes_recalcular_tarifas', {
          p_peaje_id: peajeId,
        });
        if (error) throw error;

        const { count, error: countError } = await client
          .from('tarifas_normalizadas')
          .select('estacion_id', { count: 'exact', head: true })
          .eq('peaje_id', peajeId);
        if (countError) throw countError;

        // Distinct estaciones: consulta liviana post-recálculo.
        const { data: estaciones, error: estError } = await client
          .from('tarifas_normalizadas')
          .select('estacion_id')
          .eq('peaje_id', peajeId);
        if (estError) throw estError;
        const familias = new Set((estaciones ?? []).map((r: { estacion_id: string }) => r.estacion_id))
          .size;
        return { familias: familias || Number(count ?? 0) };
      })
    );
  }
}
