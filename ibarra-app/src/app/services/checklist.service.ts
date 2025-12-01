import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Checklist, ChecklistInformation, ChecklistResponses } from '../models/checklist.model';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChecklistService {
  constructor(private supabase: SupabaseService) {}

  // Crear nuevo checklist
  createChecklist(checklistData: Omit<Checklist, 'id' | 'fecha_creacion' | 'updated_at'>): Observable<Checklist> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .insert([checklistData])
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al crear checklist:', error);
        return throwError(() => new Error(`Error al guardar checklist: ${error.message}`));
      })
    );
  }

  // Obtener checklists por rango de fechas
  getChecklistsByDateRange(startDate: string, endDate: string): Observable<Checklist[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        
        // Asegurar que las fechas estén en el formato correcto
        const startDateTime = new Date(startDate + 'T00:00:00.000Z').toISOString();
        const endDateTime = new Date(endDate + 'T23:59:59.999Z').toISOString();
        
        
        const response = await client
          .from('checklists')
          .select(`
            *,
            checklist_templates(nombre, tipo)
          `)
          .gte('fecha_realizacion', startDateTime)
          .lte('fecha_realizacion', endDateTime)
          .order('fecha_realizacion', { ascending: false });
        
        if (response.error) {
          console.error('Error en consulta de checklists:', response.error);
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener checklists:', error);
        return throwError(() => new Error(`Error al cargar checklists: ${error.message}`));
      })
    );
  }

  // Obtener checklist por ID
  getChecklistById(id: string): Observable<Checklist | null> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .select(`
            *,
            checklist_templates(*)
          `)
          .eq('id', id)
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener checklist:', error);
        return throwError(() => new Error(`Error al cargar checklist: ${error.message}`));
      })
    );
  }

  // Actualizar checklist
  updateChecklist(id: string, updates: Partial<Checklist>): Observable<Checklist> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .update(updates)
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
        console.error('Error al actualizar checklist:', error);
        return throwError(() => new Error(`Error al actualizar checklist: ${error.message}`));
      })
    );
  }

  // Obtener estadísticas por vehículo
  getVehicleStatistics(vehicleId: string, days: number = 30): Observable<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .select('*')
          .gte('fecha_realizacion', startDate.toISOString());
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        const checklists = response.data || [];
        return {
          total: checklists.length,
          completados: checklists.filter(c => c.estado === 'completado').length,
          con_errores: checklists.filter(c => c.estado === 'con_errores').length,
          parciales: checklists.filter(c => c.estado === 'parcial').length,
          promedio_completado: checklists.reduce((acc, c) => acc + c.porcentaje_completado, 0) / checklists.length || 0
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        return throwError(() => new Error(`Error al cargar estadísticas: ${error.message}`));
      })
    );
  }

  // Obtener todos los checklists (para histórico)
  getAllChecklists(): Observable<Checklist[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .select(`
            *,
            checklist_templates(nombre, tipo),
            vehiculos(patente_tractor, patente_semi),
            choferes(nombre, apellido)
          `)
          .order('fecha_realizacion', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener checklists:', error);
        return throwError(() => new Error(`Error al cargar checklists: ${error.message}`));
      })
    );
  }

  // Obtener checklists por estado
  getChecklistsByStatus(estado: string): Observable<Checklist[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklists')
          .select(`
            *,
            checklist_templates(nombre, tipo),
            vehiculos(patente_tractor, patente_semi),
            choferes(nombre, apellido)
          `)
          .eq('estado', estado)
          .order('fecha_realizacion', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener checklists por estado:', error);
        return throwError(() => new Error(`Error al cargar checklists: ${error.message}`));
      })
    );
  }

  // Obtener estadísticas generales
  getGeneralStatistics(startDate?: string, endDate?: string): Observable<any> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        let query = client.from('checklists').select('*');
        
        if (startDate) {
          query = query.gte('fecha_realizacion', startDate);
        }
        if (endDate) {
          query = query.lte('fecha_realizacion', endDate);
        }
        
        const response = await query;
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        const checklists = response.data || [];
        return {
          total: checklists.length,
          completados: checklists.filter(c => c.estado === 'completado').length,
          con_errores: checklists.filter(c => c.estado === 'con_errores').length,
          parciales: checklists.filter(c => c.estado === 'parcial').length,
          promedio_completado: checklists.length > 0 
            ? checklists.reduce((acc, c) => acc + c.porcentaje_completado, 0) / checklists.length 
            : 0,
          total_items: checklists.reduce((acc, c) => acc + c.total_items, 0),
          items_completados: checklists.reduce((acc, c) => acc + c.items_completados, 0),
          items_con_error: checklists.reduce((acc, c) => acc + c.items_con_error, 0)
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener estadísticas generales:', error);
        return throwError(() => new Error(`Error al cargar estadísticas: ${error.message}`));
      })
    );
  }
}
