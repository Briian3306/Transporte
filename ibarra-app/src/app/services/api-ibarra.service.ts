import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { environment } from '../../environments/environment';
import { ConjuntoVeh, Logistica } from '../models/logistica.model';
import { Chofer } from '../models/chofer.model';
import { Vehiculo } from '../models/vehiculo.model';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ApiIbarraService {

  baseUrlEnganche = `${environment.apiUrl}/api/enganches/`; 
  baseUrlLogistica = `${environment.apiUrl}/api/logistica/`;
  baseUrlChoferes = `${environment.apiUrl}/api/choferes/`;
  baseUrlVehiculos = `${environment.apiUrl}/api/vehiculos/`;

  enganches = signal<ConjuntoVeh[]>([])
  logisticas = signal<Logistica[]>([])
  choferes = signal<Chofer[]>([])
  vehiculos = signal<Vehiculo[]>([])

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


}
