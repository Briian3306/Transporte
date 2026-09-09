import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  AlgoritmoCombinado,
  AlgoritmoCombinadoPaso,
  ConfiguracionPlantilla,
  PlantillaConfiguracion,
  PlantillaEstacionReconocida,
  PlantillaMapeoColumna,
} from '../models/peajes.models';
import { PeajesPlantillasService } from '../models/peajes-services.contracts';
import { SupabaseService } from '../../../services/supabase.service';

/**
 * Marcador de recurso global (RN-23).
 * Contrato con Agente 03: `empresa_id === '__global__'` (mismo valor que GLOBAL_EMPRESA_ID del mock).
 */
export const PEAJES_GLOBAL_EMPRESA_ID = '__global__';

@Injectable({ providedIn: 'root' })
export class PeajesPlantillasSupabaseService implements PeajesPlantillasService {
  private readonly supabase = inject(SupabaseService);

  listarPlantillas(empresaId?: string): Observable<PlantillaConfiguracion[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let q = client
          .from('plantillas_configuracion')
          .select('*, configuraciones:configuraciones_plantilla(*), estaciones_reconocidas:plantilla_estaciones_reconocidas(*)')
          .order('nombre');
        if (empresaId) {
          // Empresa activa + recursos globales (RN-23)
          q = q.or(`empresa_id.eq.${empresaId},empresa_id.eq.${PEAJES_GLOBAL_EMPRESA_ID}`);
        }
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as PlantillaConfiguracion[];
      })
    );
  }

  obtenerPlantilla(id: string): Observable<PlantillaConfiguracion | null> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client
          .from('plantillas_configuracion')
          .select('*, configuraciones:configuraciones_plantilla(*), estaciones_reconocidas:plantilla_estaciones_reconocidas(*)')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return (data as PlantillaConfiguracion) ?? null;
      })
    );
  }

  guardarPlantilla(
    plantilla: Omit<PlantillaConfiguracion, 'id' | 'created_at' | 'updated_at' | 'configuraciones'> & {
      id?: string;
    },
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[],
    mapeos?: PlantillaMapeoColumna[],
    estacionesReconocidas?: Omit<PlantillaEstacionReconocida, 'id' | 'plantilla_id' | 'created_at'>[]
  ): Observable<PlantillaConfiguracion> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const empresaId = plantilla.empresa_id?.trim() || PEAJES_GLOBAL_EMPRESA_ID;
        const { data: plantillaId, error: saveError } = await client.rpc(
          'peajes_guardar_plantilla_importacion',
          {
            p_plantilla: { ...plantilla, empresa_id: empresaId },
            p_configuraciones: configuraciones,
            p_mapeos: mapeos ?? null,
            p_estaciones_reconocidas: estacionesReconocidas ?? null,
          }
        );
        if (saveError) throw saveError;
        const { data: full, error: getErr } = await client
          .from('plantillas_configuracion')
          .select('*, configuraciones:configuraciones_plantilla(*), estaciones_reconocidas:plantilla_estaciones_reconocidas(*)')
          .eq('id', plantillaId)
          .single();
        if (getErr) throw getErr;
        return full as PlantillaConfiguracion;
      })
    );
  }

  sobrescribirConfiguraciones(
    plantillaId: string,
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[]
  ): Observable<ConfiguracionPlantilla[]> {
    return from(this.sobrescribirConfiguracionesRpc(plantillaId, configuraciones));
  }

  listarAlgoritmos(empresaId?: string): Observable<AlgoritmoCombinado[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let q = client
          .from('algoritmos_combinados')
          .select('*, pasos:algoritmo_combinado_pasos(*)')
          .order('nombre');
        if (empresaId) {
          q = q.or(`empresa_id.eq.${empresaId},empresa_id.eq.${PEAJES_GLOBAL_EMPRESA_ID}`);
        }
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as AlgoritmoCombinado[];
      })
    );
  }

  guardarAlgoritmo(
    algoritmo: Omit<AlgoritmoCombinado, 'id' | 'created_at' | 'updated_at' | 'pasos'> & { id?: string },
    pasos: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[]
  ): Observable<AlgoritmoCombinado> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const payload = {
          ...algoritmo,
          empresa_id: algoritmo.empresa_id?.trim() || PEAJES_GLOBAL_EMPRESA_ID,
        };
        const { data, error } = await client.rpc('peajes_guardar_algoritmo_combinado', {
          p_algoritmo: payload,
          p_pasos: pasos,
        });
        if (error) throw error;

        const algoritmoId = data.algoritmo_id as string;
        const { data: full, error: getErr } = await client
          .from('algoritmos_combinados')
          .select('*, pasos:algoritmo_combinado_pasos(*)')
          .eq('id', algoritmoId)
          .single();
        if (getErr) throw getErr;
        return full as AlgoritmoCombinado;
      })
    );
  }

  expandirAlgoritmo(algoritmoId: string): Observable<AlgoritmoCombinadoPaso[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_expandir_algoritmo', {
          p_algoritmo_id: algoritmoId,
        });
        if (error) throw error;
        return (data?.pasos ?? []) as AlgoritmoCombinadoPaso[];
      })
    );
  }

  private async sobrescribirConfiguracionesRpc(
    plantillaId: string,
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[]
  ): Promise<ConfiguracionPlantilla[]> {
    const client = await this.supabase.getClient();
    const { data, error } = await client.rpc('peajes_sobrescribir_configuraciones_plantilla', {
      p_plantilla_id: plantillaId,
      p_configuraciones: configuraciones,
    });
    if (error) throw error;
    return (data ?? []) as ConfiguracionPlantilla[];
  }
}
