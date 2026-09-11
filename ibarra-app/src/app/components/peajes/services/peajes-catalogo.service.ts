import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Estacion,
  EstacionAliasProveedor,
  EstacionViaSentido,
  Empresa,
  Pase,
  Patente,
  Peaje,
  ResultadoReconocimientoEstacion,
} from '../models/peajes.models';
import {
  reconocerEstacionEnCatalogo,
  estacionPerteneceAEmpresa,
  estacionesDesdeAliasFilas,
  variantesCodigoEstacion,
} from '../models/estacion-reconocimiento.helpers';
import { PeajesCatalogoService } from '../models/peajes-services.contracts';
import { SupabaseService } from '../../../services/supabase.service';

/**
 * Implementación Supabase de catálogos Peajes (agente 01).
 * Cumple PeajesCatalogoService de Fase 0.
 */
@Injectable({ providedIn: 'root' })
export class PeajesCatalogoSupabaseService implements PeajesCatalogoService {
  private readonly supabase = inject(SupabaseService);

  listarEmpresas(): Observable<Empresa[]> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient(); const { data, error } = await client.from('empresas').select('*').order('nombre');
      if (error) throw error; return (data ?? []) as Empresa[];
    }));
  }
  crearEmpresa(data: Omit<Empresa, 'id' | 'created_at'>): Observable<Empresa> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient(); const { data: row, error } = await client.from('empresas').insert(data).select('*').single();
      if (error) throw error; return row as Empresa;
    }));
  }
  actualizarEmpresa(id: string, data: Partial<Empresa>): Observable<Empresa> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      const { data: row, error } = await client
        .from('empresas')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return row as Empresa;
    }));
  }
  listarPeajes(empresaId?: string): Observable<Peaje[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let query = client.from('peajes').select('*').order('nombre');
        if (empresaId) query = query.eq('empresa_id', empresaId);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as Peaje[];
      })
    );
  }

  obtenerPeaje(id: string): Observable<Peaje | null> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.from('peajes').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return (data as Peaje) ?? null;
      })
    );
  }

  crearPeaje(data: Omit<Peaje, 'id' | 'created_at'>): Observable<Peaje> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client.from('peajes').insert(data).select('*').single();
        if (error) throw error;
        return row as Peaje;
      })
    );
  }

  actualizarPeaje(id: string, data: Partial<Peaje>): Observable<Peaje> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client
          .from('peajes')
          .update(data)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        return row as Peaje;
      })
    );
  }

  listarEstaciones(peajeId?: string): Observable<Estacion[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let q = client.from('estaciones').select('*, peaje:peajes(*)').order('nombre');
        if (peajeId) q = q.eq('peaje_id', peajeId);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as Estacion[];
      })
    );
  }

  crearEstacion(data: Omit<Estacion, 'id' | 'created_at' | 'peaje'>): Observable<Estacion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client
          .from('estaciones')
          .insert(data)
          .select('*, peaje:peajes(*)')
          .single();
        if (error) throw error;
        return row as Estacion;
      })
    );
  }

  actualizarEstacion(id: string, data: Partial<Estacion>): Observable<Estacion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { peaje: _peaje, ...patch } = data as Partial<Estacion> & { peaje?: unknown };
        const { data: row, error } = await client
          .from('estaciones')
          .update(patch)
          .eq('id', id)
          .select('*, peaje:peajes(*)')
          .single();
        if (error) throw error;
        return row as Estacion;
      })
    );
  }

  sugerirEstacion(valorProveedor: string): Observable<Estacion[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const valor = (valorProveedor ?? '').trim();
        if (!valor) return [];

        const { data, error } = await client
          .from('estaciones')
          .select('*, peaje:peajes(*)')
          .or(`nombre.ilike.%${valor}%,codigos_proveedor.cs.{${valor}}`)
          .limit(20);
        if (error) throw error;
        return (data ?? []) as Estacion[];
      })
    );
  }

  /**
   * Alias de empresa, luego código/nombre en el catálogo.
   * `0001`/`1` existen en Zarate (MERCOSUR) y DOCK SUD (AUBASA): pasar `empresaId`
   * del Paso 1. Sin empresa, un código compartido queda en sugerencias (nunca el primero).
   */
  reconocerEstacion(valorProveedor: string, empresaId?: string): Observable<ResultadoReconocimientoEstacion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const valor = (valorProveedor ?? '').trim();
        const variantes = variantesCodigoEstacion(valor);
        const vacio: ResultadoReconocimientoEstacion = {
          valorProveedor: valor,
          tipo: 'sin_coincidencia',
          estacion: null,
          sugerencias: [],
        };
        if (!variantes.length) return vacio;

        let aliases = client
          .from('estaciones_alias_proveedor')
          .select('valor_normalizado, estacion:estaciones(*, peaje:peajes(*))')
          .in('valor_normalizado', variantes);
        if (empresaId) aliases = aliases.eq('empresa_id', empresaId);
        const { data: aliasRows, error: aliasError } = await aliases;
        if (aliasError) throw aliasError;

        const exactas = this.estacionesUnicas(aliasRows ?? []).filter((row) =>
          estacionPerteneceAEmpresa(row, empresaId)
        );
        const ranked = estacionesDesdeAliasFilas(
          (aliasRows ?? []) as Array<{
            valor_normalizado?: string | null;
            estacion?: Estacion | Estacion[] | null;
          }>,
          valor,
          empresaId
        );
        if (ranked.length === 1) {
          return {
            valorProveedor: valor,
            tipo: 'exacta' as const,
            estacion: ranked[0],
            sugerencias: [],
          };
        }
        if (ranked.length > 1) {
          return {
            valorProveedor: valor,
            tipo: 'sugerencias' as const,
            estacion: null,
            sugerencias: ranked,
          };
        }

        const { data: estaciones, error } = await client
          .from('estaciones')
          .select('*, peaje:peajes(*)')
          .order('nombre')
          .limit(500);
        if (error) throw error;

        return reconocerEstacionEnCatalogo((estaciones ?? []) as Estacion[], valor, empresaId);
      })
    );
  }

  confirmarAliasEstacion(
    data: Omit<EstacionAliasProveedor, 'id' | 'created_at' | 'valor_normalizado'>
  ): Observable<EstacionAliasProveedor> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const payload = {
          ...data,
          valor_proveedor: data.valor_proveedor.trim(),
          valor_normalizado: this.normalizarEstacion(data.valor_proveedor),
          origen: data.origen ?? 'usuario',
        };
        const { data: row, error } = await client
          .from('estaciones_alias_proveedor')
          .upsert(payload, { onConflict: 'empresa_id,estacion_id,valor_normalizado' })
          .select('*')
          .single();
        if (error) throw error;
        return row as EstacionAliasProveedor;
      })
    );
  }

  listarEstacionesViasSentido(empresaId?: string, estacionId?: string): Observable<EstacionViaSentido[]> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      let query = client.from('estaciones_vias_sentido').select('*').order('codigo_estacion').order('via');
      if (empresaId) query = query.eq('empresa_id', empresaId);
      if (estacionId) query = query.eq('estacion_id', estacionId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as EstacionViaSentido[];
    }));
  }

  guardarEstacionViaSentido(
    data: Omit<EstacionViaSentido, 'id' | 'created_at' | 'updated_at'>,
  ): Observable<EstacionViaSentido> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      const payload = {
        ...data,
        codigo_estacion: data.codigo_estacion.trim(),
        via: data.via.trim(),
        sentido: data.sentido,
      };
      const { data: row, error } = await client
        .from('estaciones_vias_sentido')
        .upsert(payload, { onConflict: 'empresa_id,estacion_id,codigo_estacion,via' })
        .select('*')
        .single();
      if (error) throw error;
      return row as EstacionViaSentido;
    }));
  }

  eliminarEstacionViaSentido(id: string): Observable<{ id: string; deleted: boolean }> {
    return from(this.supabase.executeWithRetry(async () => {
      const client = await this.supabase.getClient();
      const { error } = await client.from('estaciones_vias_sentido').delete().eq('id', id);
      if (error) throw error;
      return { id, deleted: true };
    }));
  }

  private normalizarEstacion(valor: string): string {
    return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private estacionesUnicas(rows: unknown[]): Estacion[] {
    const resultado = new Map<string, Estacion>();
    for (const row of rows as Array<{ estacion?: Estacion | Estacion[] | null }>) {
      const estacion = Array.isArray(row.estacion) ? row.estacion[0] : row.estacion;
      if (estacion?.id) resultado.set(estacion.id, estacion);
    }
    return [...resultado.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  listarPatentes(): Observable<Patente[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.from('patentes').select('*').order('patente');
        if (error) throw error;
        return (data ?? []) as Patente[];
      })
    );
  }

  crearPatente(data: Omit<Patente, 'id' | 'created_at'>): Observable<Patente> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client.from('patentes').insert(data).select('*').single();
        if (error) throw error;
        return row as Patente;
      })
    );
  }

  actualizarPatente(id: string, data: Partial<Omit<Patente, 'id' | 'created_at'>>): Observable<Patente> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client.from('patentes').update(data).eq('id', id).select('*').single();
        if (error) throw error;
        return row as Patente;
      })
    );
  }

  listarPases(patenteId?: string): Observable<Pase[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let q = client.from('pases').select('*, patente:patentes(*)').order('pase');
        if (patenteId) q = q.eq('patente_id', patenteId);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as Pase[];
      })
    );
  }

  crearPase(data: Omit<Pase, 'id' | 'created_at' | 'patente'>): Observable<Pase> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client
          .from('pases')
          .insert(data)
          .select('*, patente:patentes(*)')
          .single();
        if (error) throw error;
        return row as Pase;
      })
    );
  }
}
