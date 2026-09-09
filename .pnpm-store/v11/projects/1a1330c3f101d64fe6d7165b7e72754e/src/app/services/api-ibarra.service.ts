import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { environment } from '../../environments/environment';
import { ConjuntoVeh, Logistica } from '../models/logistica.model';
import { Chofer, Insumo } from '../models/chofer.model';
import { Vehiculo } from '../models/vehiculo.model';
import { Observable, of } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ApiIbarraService {

  baseUrlEnganche = `${environment.apiUrl}/api/enganches/`; 
  baseUrlLogistica = `${environment.apiUrl}/api/logistica/`;
  baseUrlChoferes = `${environment.apiUrl}/api/choferes/`;
  baseUrlVehiculos = `${environment.apiUrl}/api/vehiculos/`;
  baseUrlInsumos = `${environment.apiUrl}/api/mantenimientos/insumos/`;

  enganches = signal<ConjuntoVeh[]>([])
  logisticas = signal<Logistica[]>([])
  choferes = signal<Chofer[]>([])
  vehiculos = signal<Vehiculo[]>([])
  insumos = signal<Insumo[]>([])
  private insumosCargados = false; // Flag para controlar si ya se cargaron los insumos
  private cargaInsumosObservable: Observable<Insumo[]> | null = null; // Observable compartido para evitar múltiples peticiones simultáneas

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': environment.authToken,
      'Content-Type': 'application/json'
    });
  }
  httpClient = inject(HttpClient)

  constructor(
    ) { }
    
  // METODOS PARA ENGANCHES // Camion + Semi

  /**
   * Devuelve todos los enganches disponibles
   */
  getEnganchesDisponibles(): Observable<ConjuntoVeh[]>{
    return this.httpClient.get<ConjuntoVeh[]>(this.baseUrlEnganche, { headers: this.getAuthHeaders() })
  }

  actualizarEnganchesDisponibles(){
    this.httpClient.get<ConjuntoVeh[]>(this.baseUrlEnganche, { headers: this.getAuthHeaders() }).subscribe(
      data => { this.enganches.set(data);},
      error => console.log(error)
    );
  }

  // METODOS PARA LOGISTICA DISPONIBLE
  
  /**
   * Devuelve todas las unidades de logística disponibles
   */ 
  getLogisticasDisponibles(): Observable<Logistica[]>{
    return this.httpClient.get<Logistica[]>(this.baseUrlLogistica, { headers: this.getAuthHeaders() })
  }

  actualizarLogisticaDisponible(){
    this.getLogisticasDisponibles().subscribe(
      data => { this.logisticas.set(data);},
      error => console.log(error)
    );
  }

  // METODOS PARA CHOFERES

  /**
   * Devuelve todos los choferes
   */
  getChoferes(): Observable<Chofer[]>{
    return this.httpClient.get<Chofer[]>(this.baseUrlChoferes, { headers: this.getAuthHeaders() })
  }

  actualizarChoferes(){
    this.httpClient.get<Chofer[]>(this.baseUrlChoferes, { headers: this.getAuthHeaders() }).subscribe(
      data => { this.choferes.set(data);},
      error => console.log(error)
    );
  }

  // METODOS PARA VEHICULOS

  /**
   * Devuelve todos los vehículos
   */
  getVehiculos(): Observable<Vehiculo[]>{
    return this.httpClient.get<Vehiculo[]>(this.baseUrlVehiculos, { headers: this.getAuthHeaders() })
  }

  actualizarVehiculos(){
    this.httpClient.get<Vehiculo[]>(this.baseUrlVehiculos, { headers: this.getAuthHeaders() }).subscribe(
      data => { this.vehiculos.set(data);},
      error => console.log(error)
    );
  }

  // METODOS PARA INSUMOS

  /**
   * Devuelve todos los insumos desde memoria.
   * Si no hay insumos cargados, los carga una sola vez y los guarda en memoria.
   * Las siguientes llamadas retornarán los datos desde memoria sin hacer peticiones HTTP.
   */
  getInsumos(): Observable<Insumo[]>{
    // Si ya hay insumos en memoria, retornarlos directamente (sin petición HTTP)
    if (this.insumos().length > 0 && this.insumosCargados) {
      return of(this.insumos());
    }
    
    // Si hay una carga en proceso, compartir el mismo Observable
    if (this.cargaInsumosObservable) {
      return this.cargaInsumosObservable;
    }
    
    // Si no hay insumos cargados, cargarlos una sola vez desde el servidor
    if (!this.insumosCargados) {
      this.cargaInsumosObservable = new Observable<Insumo[]>(observer => {
        this.httpClient.get<Insumo[]>(this.baseUrlInsumos, { headers: this.getAuthHeaders() }).subscribe({
          next: (data) => {
            this.insumos.set(data);
            this.insumosCargados = true;
            this.cargaInsumosObservable = null; // Limpiar el Observable compartido
            observer.next(data);
            observer.complete();
          },
          error: (err) => {
            console.error('Error al cargar insumos:', err);
            this.cargaInsumosObservable = null; // Limpiar para permitir reintento
            this.insumosCargados = false; // Permitir reintento en caso de error
            observer.error(err);
          }
        });
      });
      return this.cargaInsumosObservable;
    }
    
    // Si ya se intentó cargar pero no hay datos, retornar array vacío
    return of(this.insumos());
  }

  /**
   * Actualiza los insumos desde el servidor y los guarda en memoria.
   * Útil para refrescar los datos cuando sea necesario (ej: después de crear/editar un insumo).
   */
  actualizarInsumos(){
    this.cargaInsumosObservable = null; // Limpiar cualquier Observable compartido
    this.httpClient.get<Insumo[]>(this.baseUrlInsumos, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.insumos.set(data);
        this.insumosCargados = true;
      },
      error: (err) => {
        console.error('Error al actualizar insumos:', err);
        this.insumosCargados = false; // Permitir reintento en caso de error
      }
    });
  }

}
