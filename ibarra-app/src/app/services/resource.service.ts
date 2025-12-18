import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TemplateResourceType } from '../models/checklist-template.model';
import { ApiIbarraService } from './api-ibarra.service';
import { SupabaseService } from './supabase.service';

// Interfaces para recursos
export interface RecursoSeleccion {
  id: string;
  nombre: string;
  tipo: TemplateResourceType;
  informacion: any;
}

export interface Unidad {
  id: string;
  numero: string;
  tipo: string;
  estado: string;
  }

export interface Maquina {
  id: string;
  nombre: string;
  modelo: string;
  numero_serie: string;
  estado: string;
}

export interface Sector {
  id: string;
  nombre: string;
  tipo: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceService {

  constructor(
    private apiService: ApiIbarraService,
    private supabaseService: SupabaseService
  ) {}

  /**
   * Carga recursos según el tipo de template
   */
  cargarRecursosPorTipo(tipo: TemplateResourceType): Observable<RecursoSeleccion[]> {
    switch(tipo) {
      case 'vehiculo':
        return this.getRecursosVehiculos();
      case 'chofer':
        return this.getRecursosChoferes();
      case 'unidad':
        return this.getRecursosUnidades();
      case 'maquina':
        return this.getRecursosMaquinas();
      case 'sector':
        return this.getRecursosSectores();
      default:
        return of([]);
    }
  }

  /**
   * Convierte vehículos a recursos seleccionables
   */
  private getRecursosVehiculos(): Observable<RecursoSeleccion[]> {
    return this.apiService.getVehiculos().pipe(
      map(vehiculos => vehiculos.map(v => ({
        id: v.id.toString(),
        nombre: `${v.marca} ${v.modelo} - ${v.patente}`,
        tipo: 'vehiculo' as TemplateResourceType,
        informacion: {
          vehiculo_id: v.id,
          placa: v.patente,
          marca: v.marca,
          modelo: v.modelo,
          kilometraje: 0, // No disponible en el modelo
          ubicacion: 'No especificada'
        }
      })))
    );
  }

  /**
   * Convierte choferes a recursos seleccionables
   */
  private getRecursosChoferes(): Observable<RecursoSeleccion[]> {
    return this.apiService.getChoferes().pipe(
      map(choferes => choferes.map(c => ({
        id: c.id.toString(),
        nombre: `${c.apellido}, ${c.nombre}`,
        tipo: 'chofer' as TemplateResourceType,
        informacion: {
          chofer_id: c.id,
          nombre: `${c.nombre} ${c.apellido}`,
          dni: c.dni,
        }
      })))
    );
  }

  /**
   * Obtiene unidades (datos de prueba)
   */
  private getRecursosUnidades(): Observable<RecursoSeleccion[]> {
    return this.apiService.getLogisticasDisponibles().pipe(
      map(logisticas => logisticas.map(l => ({
        id: l.id.toString(),
        nombre: `${l.conjunto_veh.camiones.patente} - ${l.chofer.nombre} ${l.chofer.apellido}`,
        tipo: 'unidad' as TemplateResourceType,
        informacion: {
          logistica_id: l.id,
          chofer_id: l.chofer.id,
          chofer_nombre: `${l.chofer.apellido}, ${l.chofer.nombre}`,
          chofer_dni: l.chofer.dni,
          vehiculo_id: l.conjunto_veh.camiones.id,
          camion_id: l.conjunto_veh.camiones.id,
          semi_id: l.conjunto_veh.semi1?.id,
          camion_patente: l.conjunto_veh.camiones.patente,
          semi1_patente: l.conjunto_veh.semi1.patente || '',
          numero_unidad: l.conjunto_veh.camiones.patente,
          tipo_unidad: l.conjunto_veh.categoria.nombre,
          capacidad: l.conjunto_veh.categoria.cap_max,
          estado: l.disponible ? 'activa' : 'mantenimiento',
        }
      })))
    ).pipe(
      catchError(error => {
        console.error('Error al obtener unidades:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene máquinas desde Supabase
   */
  private getRecursosMaquinas(): Observable<RecursoSeleccion[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const response = await client
          .from('maquinas')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      map(maquinas => maquinas.map((m: any) => ({
        id: m.id,
        nombre: `${m.nombre} - ${m.modelo}`,
        tipo: 'maquina' as TemplateResourceType,
        informacion: {
          maquina_id: m.id,
          nombre: m.nombre,
          modelo: m.modelo,
          numero_serie: m.numero_serie,
          estado: m.estado,
          descripcion: m.descripcion,
          ubicacion: m.ubicacion,
        }
      }))),
      catchError(error => {
        console.error('Error al obtener máquinas:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene sectores desde Supabase
   */
  private getRecursosSectores(): Observable<RecursoSeleccion[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const response = await client
          .from('sectores')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data || [];
      })
    ).pipe(
      map(sectores => sectores.map((s: any) => ({
        id: s.id,
        nombre: s.nombre,
        tipo: 'sector' as TemplateResourceType,
        informacion: {
          sector_id: s.id,
          nombre: s.nombre,
          tipo_area: s.tipo,
          descripcion: s.descripcion,
          ubicacion: s.ubicacion,
          responsable: s.responsable,
        }
      }))),
      catchError(error => {
        console.error('Error al obtener sectores:', error);
        return of([]);
      })
    );
  }
}
