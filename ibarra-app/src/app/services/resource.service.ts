import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TemplateResourceType } from '../models/checklist-template.model';
import { ApiIbarraService } from './api-ibarra.service';

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

  constructor(private apiService: ApiIbarraService) {}

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
          camion_patente: l.conjunto_veh.camiones.patente,
          semi1_patente: l.conjunto_veh.semi1.patente || '',
          tipo_unidad: l.conjunto_veh.categoria.nombre,
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
   * Obtiene máquinas (datos de prueba)
   */
  private getRecursosMaquinas(): Observable<RecursoSeleccion[]> {
    // Datos de prueba para máquinas
    const maquinasPrueba: Maquina[] = [
      {
        id: '1',
        nombre: 'Grúa Hidráulica',
        modelo: 'GH-500',
        numero_serie: 'SN123456',
        estado: 'activa'
      },
      {
        id: '2',
        nombre: 'Montacargas',
        modelo: 'MT-200',
        numero_serie: 'SN789012',
        estado: 'activa'
      },
      {
        id: '3',
        nombre: 'Compresor de Aire',
        modelo: 'CA-100',
        numero_serie: 'SN345678',
        estado: 'mantenimiento'
      }
    ];

    return of(maquinasPrueba.map(m => ({
      id: m.id,
      nombre: `${m.nombre} - ${m.modelo}`,
      tipo: 'maquina' as TemplateResourceType,
      informacion: {
        maquina_id: m.id,
        nombre: m.nombre,
        modelo: m.modelo,
        numero_serie: m.numero_serie,
        estado: m.estado,
      }
    })));
  }

  /**
   * Obtiene sectores (datos de prueba)
   */
  private getRecursosSectores(): Observable<RecursoSeleccion[]> {
    // Datos de prueba para sectores
    const sectoresPrueba: Sector[] = [
      {
        id: '1',
        nombre: 'Almacén Principal',
        tipo: 'almacen',
      },
      {
        id: '2',
        nombre: 'Oficina Administrativa',
        tipo: 'oficina',
      },
      {
        id: '3',
        nombre: 'Taller de Mantenimiento',
        tipo: 'taller',
      },
      {
        id: '4',
        nombre: 'Patio de Vehículos',
        tipo: 'patio',
      }
    ];

    return of(sectoresPrueba.map(s => ({
      id: s.id,
      nombre: `${s.nombre}`,
      tipo: 'sector' as TemplateResourceType,
      informacion: {
        sector_id: s.id,
        nombre: s.nombre,
        tipo_area: s.tipo,
      }
    })));
  }
}
