import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Incidente, IncidenteFilters, EstadisticasIncidentes, EstadoSeguimiento } from '../models/incidente.model';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IncidenteService {
  constructor(private supabase: SupabaseService) {}

  // Crear nuevo incidente
  createIncidente(incidente: Omit<Incidente, 'id' | 'created_at' | 'updated_at'>): Observable<Incidente> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_seguridad')
          .insert([incidente])
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al crear incidente:', error);
        return throwError(() => new Error(`Error al guardar incidente: ${error.message}`));
      })
    );
  }

  // Obtener incidentes por rango de fechas
  getIncidentesByDateRange(startDate: string, endDate: string): Observable<Incidente[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        
        const startDateTime = new Date(startDate + 'T00:00:00.000Z').toISOString();
        const endDateTime = new Date(endDate + 'T23:59:59.999Z').toISOString();
        
        const response = await client
          .from('incidentes_seguridad')
          .select('*')
          .gte('fecha', startDate)
          .lte('fecha', endDate)
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false });
        
        if (response.error) {
          console.error('Error en consulta de incidentes:', response.error);
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener incidentes:', error);
        return throwError(() => new Error(`Error al cargar incidentes: ${error.message}`));
      })
    );
  }

  // Obtener incidente por ID
  getIncidenteById(id: string): Observable<Incidente | null> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_seguridad')
          .select('*')
          .eq('id', id)
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener incidente:', error);
        return throwError(() => new Error(`Error al cargar incidente: ${error.message}`));
      })
    );
  }

  // Agregar comentario de seguimiento
  addComentarioSeguimiento(id: string, comentario: string): Observable<Incidente> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        
        // Obtener el incidente actual
        const { data: incidenteActual, error: fetchError } = await client
          .from('incidentes_seguridad')
          .select('comentarios_seguimiento')
          .eq('id', id)
          .single();
        
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        // Agregar nuevo comentario
        const comentariosExistentes = incidenteActual.comentarios_seguimiento || [];
        const nuevoComentario = {
          texto: comentario,
          usuario: (await this.supabase.getCurrentUser())?.email || 'Usuario desconocido',
          timestamp: new Date().toISOString()
        };
        
        const comentariosActualizados = [...comentariosExistentes, nuevoComentario];
        
        const response = await client
          .from('incidentes_seguridad')
          .update({
            comentarios_seguimiento: comentariosActualizados,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al agregar comentario:', error);
        return throwError(() => new Error(`Error al agregar comentario: ${error.message}`));
      })
    );
  }

  // Actualizar estado de seguimiento
  updateEstadoSeguimiento(id: string, estado: EstadoSeguimiento): Observable<Incidente> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_seguridad')
          .update({
            estado_seguimiento: estado,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar estado:', error);
        return throwError(() => new Error(`Error al actualizar estado: ${error.message}`));
      })
    );
  }

  // Obtener incidentes con filtros
  getIncidentesByFilters(filters: IncidenteFilters): Observable<Incidente[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let query = client.from('incidentes_seguridad').select('*');
        
        // Aplicar filtros
        if (filters.fechaInicio) {
          query = query.gte('fecha', filters.fechaInicio);
        }
        if (filters.fechaFin) {
          query = query.lte('fecha', filters.fechaFin);
        }
        if (filters.tipo_incidente) {
          query = query.eq('tipo_incidente', filters.tipo_incidente);
        }
        if (filters.subtipo_incidente) {
          query = query.eq('subtipo_incidente', filters.subtipo_incidente);
        }
        if (filters.nivel_riesgo) {
          query = query.eq('nivel_riesgo', filters.nivel_riesgo);
        }
        if (filters.estado_seguimiento) {
          query = query.eq('estado_seguimiento', filters.estado_seguimiento);
        }
        if (filters.categoria_reportante) {
          query = query.eq('categoria_reportante', filters.categoria_reportante);
        }
        
        const response = await query
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener incidentes con filtros:', error);
        return throwError(() => new Error(`Error al cargar incidentes: ${error.message}`));
      })
    );
  }

  // Obtener estadísticas
  getEstadisticas(startDate?: string, endDate?: string): Observable<EstadisticasIncidentes> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let query = client.from('incidentes_seguridad').select('*');
        
        if (startDate) {
          query = query.gte('fecha', startDate);
        }
        if (endDate) {
          query = query.lte('fecha', endDate);
        }
        
        const response = await query;
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        const incidentes = response.data || [];
        
        // Calcular estadísticas
        const porNivelRiesgo: { [key: string]: number } = {};
        const porEstado: { [key: string]: number } = {};
        const porTipo: { [key: string]: number } = {};
        
        incidentes.forEach(incidente => {
          // Por nivel de riesgo
          porNivelRiesgo[incidente.nivel_riesgo] = (porNivelRiesgo[incidente.nivel_riesgo] || 0) + 1;
          
          // Por estado
          porEstado[incidente.estado_seguimiento] = (porEstado[incidente.estado_seguimiento] || 0) + 1;
          
          // Por tipo
          porTipo[incidente.tipo_incidente] = (porTipo[incidente.tipo_incidente] || 0) + 1;
        });
        
        return {
          total: incidentes.length,
          por_nivel_riesgo: porNivelRiesgo,
          por_estado: porEstado,
          por_tipo: porTipo
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        return throwError(() => new Error(`Error al cargar estadísticas: ${error.message}`));
      })
    );
  }

  // Obtener todos los incidentes (para histórico)
  getAllIncidentes(): Observable<Incidente[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_seguridad')
          .select('*')
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener todos los incidentes:', error);
        return throwError(() => new Error(`Error al cargar incidentes: ${error.message}`));
      })
    );
  }

  // Obtener incidentes por estado
  getIncidentesByStatus(estado: EstadoSeguimiento): Observable<Incidente[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_seguridad')
          .select('*')
          .eq('estado_seguimiento', estado)
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener incidentes por estado:', error);
        return throwError(() => new Error(`Error al cargar incidentes: ${error.message}`));
      })
    );
  }
}

