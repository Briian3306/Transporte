import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ConfiguracionIncidentes, NivelRiesgo, TipoIncidente, SubtipoIncidente } from '../models/incidente.model';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IncidenteConfigService {
  private nivelesRiesgoCache = new BehaviorSubject<NivelRiesgo[]>([]);
  private tiposIncidenteCache = new BehaviorSubject<TipoIncidente[]>([]);
  
  public nivelesRiesgo$ = this.nivelesRiesgoCache.asObservable();
  public tiposIncidente$ = this.tiposIncidenteCache.asObservable();

  constructor(private supabase: SupabaseService) {
    this.loadConfiguraciones();
  }

  // Cargar configuraciones al inicializar
  private loadConfiguraciones(): void {
    this.getNivelesRiesgo().subscribe();
    this.getTiposIncidente().subscribe();
  }

  // Obtener configuración por clave
  getConfiguracion(clave: string): Observable<ConfiguracionIncidentes> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_configuracion')
          .select('*')
          .eq('clave', clave)
          .eq('activo', true)
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener configuración:', error);
        return throwError(() => new Error(`Error al cargar configuración: ${error.message}`));
      })
    );
  }

  // Obtener niveles de riesgo
  getNivelesRiesgo(): Observable<NivelRiesgo[]> {
    return this.getConfiguracion('niveles_riesgo').pipe(
      map(config => {
        const niveles = config.configuracion.niveles || [];
        this.nivelesRiesgoCache.next(niveles);
        return niveles;
      }),
      catchError(error => {
        console.error('Error al obtener niveles de riesgo:', error);
        return throwError(() => new Error(`Error al cargar niveles de riesgo: ${error.message}`));
      })
    );
  }

  // Obtener tipos de incidente
  getTiposIncidente(): Observable<TipoIncidente[]> {
    return this.getConfiguracion('tipos_incidente').pipe(
      map(config => {
        const tipos = config.configuracion.tipos || [];
        this.tiposIncidenteCache.next(tipos);
        return tipos;
      }),
      catchError(error => {
        console.error('Error al obtener tipos de incidente:', error);
        return throwError(() => new Error(`Error al cargar tipos de incidente: ${error.message}`));
      })
    );
  }

  // Obtener subtipos por tipo
  getSubtiposByTipo(tipoCodigo: string): Observable<SubtipoIncidente[]> {
    return this.getTiposIncidente().pipe(
      map(tipos => {
        const tipo = tipos.find(t => t.codigo === tipoCodigo);
        return tipo?.subtipos || [];
      })
    );
  }

  // Actualizar niveles de riesgo
  updateNivelesRiesgo(niveles: NivelRiesgo[]): Observable<ConfiguracionIncidentes> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_configuracion')
          .update({
            configuracion: { niveles },
            updated_at: new Date().toISOString()
          })
          .eq('clave', 'niveles_riesgo')
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        this.nivelesRiesgoCache.next(niveles);
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar niveles de riesgo:', error);
        return throwError(() => new Error(`Error al actualizar niveles de riesgo: ${error.message}`));
      })
    );
  }

  // Actualizar tipos de incidente
  updateTiposIncidente(tipos: TipoIncidente[]): Observable<ConfiguracionIncidentes> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const response = await client
          .from('incidentes_configuracion')
          .update({
            configuracion: { tipos },
            updated_at: new Date().toISOString()
          })
          .eq('clave', 'tipos_incidente')
          .select()
          .single();
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        this.tiposIncidenteCache.next(tipos);
        return response.data;
      })
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar tipos de incidente:', error);
        return throwError(() => new Error(`Error al actualizar tipos de incidente: ${error.message}`));
      })
    );
  }

  // Calcular nivel de riesgo basado en puntaje
  calcularNivelRiesgo(puntaje: number, niveles: NivelRiesgo[]): NivelRiesgo | null {
    const nivelesOrdenados = [...niveles].sort((a, b) => b.puntaje_minimo - a.puntaje_minimo);
    
    for (const nivel of nivelesOrdenados) {
      if (puntaje >= nivel.puntaje_minimo) {
        return nivel;
      }
    }
    
    return null;
  }

  // Calcular puntaje total
  calcularPuntaje(tipoCodigo: string, subtipoCodigo: string, tipos: TipoIncidente[]): number {
    const tipo = tipos.find(t => t.codigo === tipoCodigo);
    if (!tipo) return 0;
    
    const subtipo = tipo.subtipos.find(s => s.codigo === subtipoCodigo);
    if (!subtipo) return tipo.peso_base;
    
    return tipo.peso_base + subtipo.peso;
  }

  // Obtener nivel de riesgo por puntaje (usando cache)
  getNivelRiesgoByPuntaje(puntaje: number): Observable<NivelRiesgo | null> {
    return this.nivelesRiesgo$.pipe(
      map(niveles => this.calcularNivelRiesgo(puntaje, niveles))
    );
  }

  // Obtener subtipos por tipo (usando cache)
  getSubtiposByTipoFromCache(tipoCodigo: string): Observable<SubtipoIncidente[]> {
    return this.tiposIncidente$.pipe(
      map(tipos => {
        const tipo = tipos.find(t => t.codigo === tipoCodigo);
        return tipo?.subtipos || [];
      })
    );
  }

  // Obtener tipo de incidente por código (usando cache)
  getTipoIncidenteByCodigo(codigo: string): Observable<TipoIncidente | null> {
    return this.tiposIncidente$.pipe(
      map(tipos => tipos.find(t => t.codigo === codigo) || null)
    );
  }

  // Obtener subtipo por códigos (usando cache)
  getSubtipoIncidenteByCodigos(tipoCodigo: string, subtipoCodigo: string): Observable<SubtipoIncidente | null> {
    return this.tiposIncidente$.pipe(
      map(tipos => {
        const tipo = tipos.find(t => t.codigo === tipoCodigo);
        if (!tipo) return null;
        
        return tipo.subtipos.find(s => s.codigo === subtipoCodigo) || null;
      })
    );
  }

  // Refrescar cache
  refreshCache(): void {
    this.loadConfiguraciones();
  }
}

