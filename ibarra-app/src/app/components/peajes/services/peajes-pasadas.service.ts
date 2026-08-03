import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Pasada, PasadaGestion } from '../models/peajes.models';
import {
  PasadaCreateInput,
  PasadaUpdatePatch,
  PasadasListParams,
  PasadasListResult,
  PeajesPasadasService,
} from '../models/peajes-services.contracts';
import { SupabaseService } from '../../../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class PeajesPasadasSupabaseService implements PeajesPasadasService {
  private readonly supabase = inject(SupabaseService);

  listar(params: PasadasListParams): Observable<PasadasListResult> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_listar_pasadas', {
          p_filters: params.filters ?? {},
          p_sort: params.sort ?? 'fecha_hora',
          p_dir: params.dir ?? 'desc',
          p_limit: params.limit ?? 50,
          p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return {
          rows: (data?.rows ?? []) as PasadaGestion[],
          total: Number(data?.total ?? 0),
          limit: Number(data?.limit ?? params.limit ?? 50),
          offset: Number(data?.offset ?? params.offset ?? 0),
        } satisfies PasadasListResult;
      })
    );
  }

  crear(data: PasadaCreateInput): Observable<Pasada> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client.rpc('peajes_crear_pasada', {
          p_pasada: data,
        });
        if (error) throw error;
        return row as Pasada;
      })
    );
  }

  actualizar(id: string, patch: PasadaUpdatePatch): Observable<Pasada> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data: row, error } = await client.rpc('peajes_actualizar_pasada', {
          p_id: id,
          p_patch: patch,
        });
        if (error) throw error;
        return row as Pasada;
      })
    );
  }

  eliminar(id: string): Observable<{ id: string; deleted: boolean }> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_eliminar_pasada', {
          p_id: id,
        });
        if (error) throw error;
        return data as { id: string; deleted: boolean };
      })
    );
  }
}
