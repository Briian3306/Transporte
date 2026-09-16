import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AuditoriaStock,
  AuditoriaStockItem,
  AuditoriaVencida,
  CriterioSeleccionAuditoria,
  DepositoAuditoriaConfig,
  EstadoItemAuditoria,
  FiltrosAuditoria,
  PeriodicidadAuditoria,
  ResumenDesviosAuditoria,
  TipoAuditoria,
} from '../models/stock.model';
import { SupabaseService } from './supabase.service';
import { ApiIbarraService } from './api-ibarra.service';

@Injectable({
  providedIn: 'root',
})
export class StockAuditoriasService {
  private supabaseService = inject(SupabaseService);
  private apiService = inject(ApiIbarraService);

  getConfig(depositoId: string): Observable<DepositoAuditoriaConfig | null> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('depositos_auditoria_config')
          .select('*')
          .eq('deposito_id', depositoId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return data ? this.mapConfig(data) : null;
      }),
    );
  }

  guardarConfig(
    depositoId: string,
    config: Omit<DepositoAuditoriaConfig, 'id' | 'deposito_id'>,
  ): Observable<DepositoAuditoriaConfig> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const intervalo = this.intervaloPorPeriodicidad(config.periodicidad, config.intervalo_dias);
        const payload = {
          deposito_id: depositoId,
          periodicidad: config.periodicidad,
          intervalo_dias: intervalo,
          dias_aviso_previo: config.dias_aviso_previo,
          tolerancia_desvio_pct: config.tolerancia_desvio_pct,
          incluir_sin_stock: config.incluir_sin_stock,
          responsable: config.responsable || null,
          activo: config.activo,
          proxima_fecha: config.proxima_fecha || null,
        };

        const { data, error } = await client
          .from('depositos_auditoria_config')
          .upsert(payload, { onConflict: 'deposito_id' })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return this.mapConfig(data);
      }),
    );
  }

  getAuditorias(filtros: FiltrosAuditoria = {}): Observable<AuditoriaStock[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        let query = client
          .from('auditorias_stock')
          .select('*, depositos(nombre)')
          .order('fecha_inicio', { ascending: false });

        if (filtros.deposito_id) query = query.eq('deposito_id', filtros.deposito_id);
        if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
        if (filtros.estado) query = query.eq('estado', filtros.estado);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data || []).map((row: any) => this.mapAuditoria(row));
      }),
    );
  }

  getAuditoriaDetalle(id: string): Observable<AuditoriaStock> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('auditorias_stock')
          .select('*, depositos(nombre)')
          .eq('id', id)
          .single();

        if (error) throw new Error(error.message);

        const { data: items, error: itemsError } = await client
          .from('auditorias_stock_items')
          .select('*, deposito_ubicaciones(codigo, nombre)')
          .eq('auditoria_id', id)
          .order('insumo_id', { ascending: true });

        if (itemsError) throw new Error(itemsError.message);

        const auditoria = this.mapAuditoria(data);
        auditoria.items = await this.enriquecerItems(items || []);
        return auditoria;
      }),
    );
  }

  iniciarAuditoriaTotal(depositoId: string): Observable<string> {
    return this.iniciarAuditoria(depositoId, 'total');
  }

  iniciarAuditoriaParcial(
    depositoId: string,
    stockIds: string[],
    criterio?: CriterioSeleccionAuditoria,
  ): Observable<string> {
    return this.iniciarAuditoria(depositoId, 'parcial', stockIds, criterio);
  }

  agregarItems(auditoriaId: string, stockIds: string[]): Observable<number> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client.rpc('stock_agregar_items_auditoria', {
          p_auditoria_id: auditoriaId,
          p_stock_deposito_ids: stockIds,
        });
        if (error) throw new Error(error.message);
        return Number(data || 0);
      }),
    );
  }

  controlarItem(
    itemId: string,
    datos: {
      estado_item: EstadoItemAuditoria;
      cantidad_contada?: number | null;
      motivo?: string;
      observaciones?: string;
    },
  ): Observable<string> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const usuario = await this.usuarioActual();
        const client = await this.supabaseService.getClient();
        const { data, error } = await client.rpc('stock_controlar_item_auditoria', {
          p_item_id: itemId,
          p_estado_item: datos.estado_item,
          p_cantidad_contada: datos.cantidad_contada ?? null,
          p_motivo: datos.motivo || null,
          p_observaciones: datos.observaciones || null,
          p_usuario_id: usuario.id,
          p_usuario_nombre: usuario.nombre,
        });
        if (error) throw new Error(error.message);
        return data as string;
      }),
    );
  }

  controlarItemsMasivo(
    items: Array<{
      id: string;
      estado_item: EstadoItemAuditoria;
      cantidad_contada?: number | null;
      motivo?: string;
      observaciones?: string;
    }>,
  ): Observable<void> {
    return from(
      (async () => {
        for (const item of items) {
          await this.controlarItem(item.id, item).toPromise();
        }
      })(),
    );
  }

  cerrarAuditoria(id: string, aplicarAjustes: boolean): Observable<string> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const usuario = await this.usuarioActual();
        const client = await this.supabaseService.getClient();
        const { data, error } = await client.rpc('stock_cerrar_auditoria', {
          p_auditoria_id: id,
          p_aplicar_ajustes: aplicarAjustes,
          p_usuario_id: usuario.id,
          p_usuario_nombre: usuario.nombre,
        });
        if (error) throw new Error(error.message);
        return data as string;
      }),
    );
  }

  cancelarAuditoria(id: string, observaciones?: string): Observable<string> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const usuario = await this.usuarioActual();
        const client = await this.supabaseService.getClient();
        const { data, error } = await client.rpc('stock_cancelar_auditoria', {
          p_auditoria_id: id,
          p_usuario_id: usuario.id,
          p_usuario_nombre: usuario.nombre,
          p_observaciones: observaciones || null,
        });
        if (error) throw new Error(error.message);
        return data as string;
      }),
    );
  }

  getAuditoriasVencidas(): Observable<AuditoriaVencida[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const hoy = new Date().toISOString().split('T')[0];

        const { data: configs, error } = await client
          .from('depositos_auditoria_config')
          .select('deposito_id, proxima_fecha, depositos(nombre)')
          .eq('activo', true)
          .not('proxima_fecha', 'is', null)
          .lte('proxima_fecha', hoy);

        if (error) throw new Error(error.message);

        const { data: enCurso, error: enCursoError } = await client
          .from('auditorias_stock')
          .select('deposito_id, tipo')
          .eq('estado', 'en_curso');

        if (enCursoError) throw new Error(enCursoError.message);

        const enCursoTotal = new Set(
          (enCurso || [])
            .filter((a: { tipo: string }) => a.tipo === 'total')
            .map((a: { deposito_id: string }) => a.deposito_id),
        );
        const enCursoCualquiera = new Set((enCurso || []).map((a: { deposito_id: string }) => a.deposito_id));

        return (configs || [])
          .filter((c: any) => !enCursoTotal.has(c.deposito_id))
          .map((c: any) => {
            const proxima = new Date(c.proxima_fecha);
            const dias = Math.floor((Date.now() - proxima.getTime()) / 86400000);
            return {
              deposito_id: c.deposito_id,
              deposito_nombre: c.depositos?.nombre || '',
              proxima_fecha: c.proxima_fecha,
              dias_vencida: Math.max(dias, 0),
              en_curso: enCursoCualquiera.has(c.deposito_id),
            } as AuditoriaVencida;
          });
      }),
    );
  }

  getResumenDesvios(auditoriaId: string): Observable<ResumenDesviosAuditoria> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const auditoria = await this.getAuditoriaDetalle(auditoriaId).toPromise();
        if (!auditoria) throw new Error('No se pudo cargar la auditoría');

        const client = await this.supabaseService.getClient();
        const { count, error } = await client
          .from('stock_depositos')
          .select('id', { count: 'exact', head: true })
          .eq('deposito_id', auditoria.deposito_id);

        if (error) throw new Error(error.message);

        const items = auditoria.items || [];
        const itemsDeposito = count || 0;
        const desvioNeto = items.reduce((sum, item) => sum + (item.desvio || 0), 0);
        const sistemaTotal = items.reduce((sum, item) => sum + item.cantidad_sistema, 0);

        return {
          total_items: auditoria.total_items,
          items_controlados: auditoria.items_controlados,
          items_pendientes: items.filter((i) => !i.controlado).length,
          items_ok: items.filter((i) => i.estado_item === 'ok').length,
          items_con_desvio: auditoria.items_con_desvio,
          items_no_encontrados: auditoria.items_no_encontrados,
          items_deteriorados: items.filter((i) => i.estado_item === 'deteriorado').length,
          cobertura_deposito: itemsDeposito,
          items_deposito: itemsDeposito,
          desvio_neto: desvioNeto,
          porcentaje_desvio: sistemaTotal === 0 ? 0 : (Math.abs(desvioNeto) / sistemaTotal) * 100,
          items,
        };
      }),
    );
  }

  intervaloPorPeriodicidad(periodicidad: PeriodicidadAuditoria, personalizado?: number): number {
    const mapa: Record<PeriodicidadAuditoria, number> = {
      semanal: 7,
      quincenal: 15,
      mensual: 30,
      bimestral: 60,
      trimestral: 90,
      semestral: 180,
      anual: 365,
      personalizada: personalizado && personalizado > 0 ? personalizado : 30,
    };
    return mapa[periodicidad] || 30;
  }

  private iniciarAuditoria(
    depositoId: string,
    tipo: TipoAuditoria,
    stockIds?: string[],
    criterio?: CriterioSeleccionAuditoria,
  ): Observable<string> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const usuario = await this.usuarioActual();
        const client = await this.supabaseService.getClient();
        const { data, error } = await client.rpc('stock_iniciar_auditoria', {
          p_deposito_id: depositoId,
          p_tipo: tipo,
          p_stock_deposito_ids: tipo === 'parcial' ? stockIds : null,
          p_criterio: tipo === 'parcial' ? criterio || null : null,
          p_usuario_id: usuario.id,
          p_usuario_nombre: usuario.nombre,
        });
        if (error) throw new Error(error.message);
        return data as string;
      }),
    );
  }

  private async usuarioActual(): Promise<{ id: string; nombre: string }> {
    const user = await this.supabaseService.getCurrentUser();
    return {
      id: user?.id || 'unknown',
      nombre:
        (user?.user_metadata?.['full_name'] as string) ||
        user?.email ||
        'Usuario',
    };
  }

  private mapConfig(row: any): DepositoAuditoriaConfig {
    return {
      id: row.id,
      deposito_id: row.deposito_id,
      periodicidad: row.periodicidad,
      intervalo_dias: row.intervalo_dias,
      dias_aviso_previo: row.dias_aviso_previo,
      tolerancia_desvio_pct: Number(row.tolerancia_desvio_pct || 0),
      incluir_sin_stock: row.incluir_sin_stock !== false,
      responsable: row.responsable || undefined,
      activo: row.activo !== false,
      proxima_fecha: row.proxima_fecha,
      ultima_auditoria_total_id: row.ultima_auditoria_total_id,
    };
  }

  private mapAuditoria(row: any): AuditoriaStock {
    return {
      id: row.id,
      deposito_id: row.deposito_id,
      deposito_nombre: row.depositos?.nombre,
      tipo: row.tipo,
      estado: row.estado,
      fecha_programada: row.fecha_programada,
      fecha_inicio: new Date(row.fecha_inicio),
      fecha_cierre: row.fecha_cierre ? new Date(row.fecha_cierre) : null,
      usuario_inicio_id: row.usuario_inicio_id,
      usuario_inicio_nombre: row.usuario_inicio_nombre,
      usuario_cierre_id: row.usuario_cierre_id,
      usuario_cierre_nombre: row.usuario_cierre_nombre,
      observaciones: row.observaciones,
      criterio_seleccion: row.criterio_seleccion,
      total_items: row.total_items || 0,
      items_controlados: row.items_controlados || 0,
      items_con_desvio: row.items_con_desvio || 0,
      items_no_encontrados: row.items_no_encontrados || 0,
      ajustes_aplicados: !!row.ajustes_aplicados,
      periodicidad_snapshot: row.periodicidad_snapshot,
    };
  }

  private async enriquecerItems(rows: any[]): Promise<AuditoriaStockItem[]> {
    if (rows.length === 0) return [];
    const insumos = await this.apiService.getInsumos().toPromise();
    return rows.map((row: any) => {
      const insumo = insumos?.find((i) => i.id === row.insumo_id);
      return {
        id: row.id,
        auditoria_id: row.auditoria_id,
        stock_deposito_id: row.stock_deposito_id,
        insumo_id: row.insumo_id,
        insumo_nombre: insumo?.nombre,
        insumo_codigo: insumo?.codigo,
        categoria_nombre: insumo?.categoria?.nombre,
        unidad_medida: insumo?.unidad_medida,
        ubicacion_id: row.ubicacion_id,
        ubicacion_codigo: row.deposito_ubicaciones
          ? [row.deposito_ubicaciones.codigo, row.deposito_ubicaciones.nombre].filter(Boolean).join(' · ')
          : undefined,
        cantidad_sistema: parseFloat(row.cantidad_sistema),
        controlado: !!row.controlado,
        estado_item: row.estado_item,
        cantidad_contada: row.cantidad_contada !== null && row.cantidad_contada !== undefined
          ? parseFloat(row.cantidad_contada)
          : null,
        desvio: row.desvio !== null && row.desvio !== undefined ? parseFloat(row.desvio) : null,
        motivo_desvio: row.motivo_desvio,
        observaciones: row.observaciones,
        controlado_por_id: row.controlado_por_id,
        controlado_por_nombre: row.controlado_por_nombre,
        controlado_at: row.controlado_at ? new Date(row.controlado_at) : null,
        ajuste_movimiento_id: row.ajuste_movimiento_id,
      };
    });
  }
}
