import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Estacion,
  Empresa,
  Pase,
  Patente,
  Peaje,
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
