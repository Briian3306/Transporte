import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DepositoUbicacion,
  ResultadoValidacionUbicacion,
  StockDeposito,
  TipoUbicacion,
  UbicacionReglas,
} from '../models/stock.model';
import { SupabaseService } from './supabase.service';
import {
  asignablePorDefecto,
  filtrarUbicacionesAsignables,
  validarAsignacionUbicacion,
} from './stock-ubicaciones.util';

export interface CrearUbicacionDTO {
  deposito_id: string;
  parent_id?: string | null;
  tipo: TipoUbicacion;
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  activo?: boolean;
  asignable?: boolean;
  reglas?: UbicacionReglas;
}

@Injectable({
  providedIn: 'root',
})
export class StockUbicacionesService {
  private supabaseService = inject(SupabaseService);

  getUbicaciones(depositoId: string): Observable<DepositoUbicacion[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('deposito_ubicaciones')
          .select('*')
          .eq('deposito_id', depositoId)
          .order('orden', { ascending: true })
          .order('codigo', { ascending: true });

        if (error) throw new Error(error.message);

        const { data: stockRows, error: stockError } = await client
          .from('stock_depositos')
          .select('ubicacion_id')
          .eq('deposito_id', depositoId);

        if (stockError) throw new Error(stockError.message);

        const counts = new Map<string, number>();
        (stockRows || []).forEach((row: { ubicacion_id?: string | null }) => {
          if (!row.ubicacion_id) return;
          counts.set(row.ubicacion_id, (counts.get(row.ubicacion_id) || 0) + 1);
        });

        const mapped = (data || []).map((row: any) => this.mapUbicacion(row, counts.get(row.id) || 0));
        return this.buildTree(mapped);
      }),
    ).pipe(
      catchError((error) => {
        console.error('Error al obtener ubicaciones:', error);
        throw error;
      }),
    );
  }

  flatten(ubicaciones: DepositoUbicacion[]): DepositoUbicacion[] {
    const resultado: DepositoUbicacion[] = [];
    const walk = (nodos: DepositoUbicacion[]) => {
      nodos.forEach((nodo) => {
        resultado.push(nodo);
        if (nodo.hijos?.length) walk(nodo.hijos);
      });
    };
    walk(ubicaciones);
    return resultado;
  }

  crear(dto: CrearUbicacionDTO): Observable<DepositoUbicacion> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('deposito_ubicaciones')
          .insert({
            deposito_id: dto.deposito_id,
            parent_id: dto.parent_id || null,
            tipo: dto.tipo,
            codigo: dto.codigo.trim(),
            nombre: dto.nombre.trim(),
            descripcion: dto.descripcion || null,
            orden: dto.orden ?? 0,
            activo: dto.activo !== false,
            asignable: dto.asignable ?? asignablePorDefecto(dto.tipo),
            reglas: dto.reglas || {},
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return this.mapUbicacion(data, 0);
      }),
    );
  }

  actualizar(
    id: string,
    cambios: Partial<Pick<DepositoUbicacion, 'codigo' | 'nombre' | 'descripcion' | 'orden' | 'activo' | 'asignable' | 'reglas'>>,
  ): Observable<DepositoUbicacion> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const payload: Record<string, unknown> = {};
        if (cambios.codigo !== undefined) payload['codigo'] = cambios.codigo.trim();
        if (cambios.nombre !== undefined) payload['nombre'] = cambios.nombre.trim();
        if (cambios.descripcion !== undefined) payload['descripcion'] = cambios.descripcion;
        if (cambios.orden !== undefined) payload['orden'] = cambios.orden;
        if (cambios.activo !== undefined) payload['activo'] = cambios.activo;
        if (cambios.asignable !== undefined) payload['asignable'] = cambios.asignable;
        if (cambios.reglas !== undefined) payload['reglas'] = cambios.reglas;

        const { data, error } = await client
          .from('deposito_ubicaciones')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return this.mapUbicacion(data, 0);
      }),
    );
  }

  desactivar(id: string): Observable<DepositoUbicacion> {
    return this.actualizar(id, { activo: false });
  }

  asignarUbicacion(stockId: string, ubicacionId: string | null): Observable<void> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { error } = await client
          .from('stock_depositos')
          .update({ ubicacion_id: ubicacionId })
          .eq('id', stockId);

        if (error) throw new Error(error.message);
      }),
    );
  }

  ubicacionesAsignables(
    ubicaciones: DepositoUbicacion[],
    ubicacionActualId?: string | null,
  ): DepositoUbicacion[] {
    return filtrarUbicacionesAsignables(ubicaciones, ubicacionActualId);
  }

  /**
   * Solo se puede asignar una ubicación activa y marcada como asignable.
   * Si el insumo ya está en esa ubicación, se conserva aunque se haya deshabilitado.
   */
  validarAsignacion(stock: StockDeposito, ubicacion: DepositoUbicacion | null): ResultadoValidacionUbicacion {
    return validarAsignacionUbicacion(stock, ubicacion);
  }

  tipoHijo(tipo: TipoUbicacion | null): TipoUbicacion | null {
    if (!tipo) return 'zona';
    if (tipo === 'zona') return 'pasillo';
    if (tipo === 'pasillo') return 'estante';
    if (tipo === 'estante') return 'posicion';
    return null;
  }

  etiquetaTipo(tipo: TipoUbicacion): string {
    const etiquetas: Record<TipoUbicacion, string> = {
      zona: 'Zona',
      pasillo: 'Pasillo',
      estante: 'Estante',
      posicion: 'Posición',
    };
    return etiquetas[tipo];
  }

  private mapUbicacion(row: any, insumosCount: number): DepositoUbicacion {
    return {
      id: row.id,
      deposito_id: row.deposito_id,
      parent_id: row.parent_id,
      tipo: row.tipo,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion || undefined,
      orden: row.orden ?? 0,
      activo: row.activo !== false,
      asignable: row.asignable === true,
      reglas: row.reglas || {},
      insumos_count: insumosCount,
      hijos: [],
    };
  }

  private buildTree(rows: DepositoUbicacion[]): DepositoUbicacion[] {
    const map = new Map<string, DepositoUbicacion>();
    rows.forEach((row) => map.set(row.id, { ...row, hijos: [] }));

    const roots: DepositoUbicacion[] = [];
    map.forEach((nodo) => {
      if (nodo.parent_id && map.has(nodo.parent_id)) {
        map.get(nodo.parent_id)!.hijos!.push(nodo);
      } else {
        roots.push(nodo);
      }
    });

    const asignarCodigo = (nodo: DepositoUbicacion, prefijo: string) => {
      nodo.codigo_completo = prefijo ? `${prefijo}-${nodo.codigo}` : nodo.codigo;
      (nodo.hijos || [])
        .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo))
        .forEach((hijo) => asignarCodigo(hijo, nodo.codigo_completo || nodo.codigo));
    };

    roots
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo))
      .forEach((root) => asignarCodigo(root, ''));

    return roots;
  }
}
