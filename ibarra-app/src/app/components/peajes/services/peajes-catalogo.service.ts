import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Estacion,
  EstacionAliasProveedor,
  Empresa,
  Pase,
  Patente,
  Peaje,
  ResultadoReconocimientoEstacion,
} from '../models/peajes.models';
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

  reconocerEstacion(valorProveedor: string, empresaId?: string): Observable<ResultadoReconocimientoEstacion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const valor = (valorProveedor ?? '').trim();
        const normalizado = this.normalizarEstacion(valor);
        const vacio: ResultadoReconocimientoEstacion = {
          valorProveedor: valor,
          tipo: 'sin_coincidencia',
          estacion: null,
          sugerencias: [],
        };
        if (!normalizado) return vacio;

        let aliases = client
          .from('estaciones_alias_proveedor')
          .select('estacion:estaciones(*, peaje:peajes(*))')
          .eq('valor_normalizado', normalizado);
        if (empresaId) aliases = aliases.eq('empresa_id', empresaId);
        const { data: aliasRows, error: aliasError } = await aliases;
        if (aliasError) throw aliasError;

        const exactas = this.estacionesUnicas(aliasRows ?? []);
        if (exactas.length === 1) {
          return {
            valorProveedor: valor,
            tipo: 'exacta' as const,
            estacion: exactas[0],
            sugerencias: [],
          };
        }
        if (exactas.length > 1) {
          return {
            valorProveedor: valor,
            tipo: 'sugerencias' as const,
            estacion: null,
            sugerencias: exactas,
          };
        }

        const { data: estaciones, error } = await client
          .from('estaciones')
          .select('*, peaje:peajes(*)')
          .order('nombre')
          .limit(500);
        if (error) throw error;

        const candidatas = (estaciones ?? [])
          .filter((row: Estacion) => !empresaId || row.peaje?.empresa_id === empresaId)
          .filter((row: Estacion) => {
            const nombre = this.normalizarEstacion(row.nombre);
            return nombre === normalizado || nombre.includes(normalizado) || normalizado.includes(nombre);
          })
          .sort((a: Estacion, b: Estacion) => {
            const aNombre = this.normalizarEstacion(a.nombre);
            const bNombre = this.normalizarEstacion(b.nombre);
            const rank = (nombre: string) => nombre === normalizado ? 0 : nombre.startsWith(normalizado) ? 1 : 2;
            return rank(aNombre) - rank(bNombre) || a.nombre.localeCompare(b.nombre);
          }) as Estacion[];

        if (candidatas.length === 1 && this.normalizarEstacion(candidatas[0].nombre) === normalizado) {
          return {
            valorProveedor: valor,
            tipo: 'exacta' as const,
            estacion: candidatas[0],
            sugerencias: [],
          };
        }
        return {
          valorProveedor: valor,
          tipo: (candidatas.length ? 'sugerencias' : 'sin_coincidencia') as ResultadoReconocimientoEstacion['tipo'],
          estacion: null,
          sugerencias: candidatas,
        };
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
