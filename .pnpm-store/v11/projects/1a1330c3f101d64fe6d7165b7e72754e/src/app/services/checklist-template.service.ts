import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ChecklistTemplate } from '../models/checklist-template.model';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChecklistTemplateService {
  constructor(private supabase: SupabaseService) {}

  // Obtener todas las plantillas activas
  getTemplates(): Observable<ChecklistTemplate[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklist_templates')
          .select('*')
          .eq('activo', true)
          .order('created_at', { ascending: false });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener plantillas:', error);
        return throwError(() => new Error(`Error al cargar plantillas: ${error.message}`));
      })
    );
  }

  // Obtener plantilla por ID
  getTemplateById(id: string): Observable<ChecklistTemplate | null> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklist_templates')
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
        console.error('Error al obtener plantilla:', error);
        return throwError(() => new Error(`Error al cargar plantilla: ${error.message}`));
      })
    );
  }

  // Crear nueva plantilla
  createTemplate(template: Omit<ChecklistTemplate, 'id' | 'created_at' | 'updated_at'>): Observable<ChecklistTemplate> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklist_templates')
          .insert([template])
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al crear plantilla:', error);
        return throwError(() => new Error(`Error al crear plantilla: ${error.message}`));
      })
    );
  }

  // Actualizar plantilla
  updateTemplate(id: string, updates: Partial<ChecklistTemplate>): Observable<ChecklistTemplate> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklist_templates')
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
        console.error('Error al actualizar plantilla:', error);
        return throwError(() => new Error(`Error al actualizar plantilla: ${error.message}`));
      })
    );
  }

  // Eliminar plantilla (soft delete)
  deleteTemplate(id: string): Observable<void> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('checklist_templates')
          .update({ activo: false })
          .eq('id', id);
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return void 0;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al eliminar plantilla:', error);
        return throwError(() => new Error(`Error al eliminar plantilla: ${error.message}`));
      })
    );
  }
}
