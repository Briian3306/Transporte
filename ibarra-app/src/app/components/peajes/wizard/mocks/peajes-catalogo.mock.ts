import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  Estacion,
  Empresa,
  Pase,
  Patente,
  Peaje,
  PeajesCatalogoService,
  EstacionAliasProveedor,
  ResultadoReconocimientoEstacion,
  reconocerEstacionEnCatalogo,
} from '../../models';

/**
 * Mock tipado de PeajesCatalogoService (contratos Fase 0).
 * Sustituir por implementación real de agente 01 cuando F01-1 esté passing.
 */
@Injectable()
export class PeajesCatalogoMockService implements PeajesCatalogoService {
  private empresas: Empresa[] = [
    { id: 'EMP-001', nombre: 'Empresa Demo', descripcion: 'Proveedor demo' },
    { id: '37ab9246-a07a-40b5-b62d-7a8b8e7782db', nombre: 'AUTOVIA DEL MERCOSUR', descripcion: 'MERCOSUR' },
    { id: '75d868b4-aef5-409a-8d12-973506656811', nombre: 'AUBASA', descripcion: 'AUBASA' },
  ];
  private peajes: Peaje[] = [
    {
      id: 'PEA-001',
      nombre: 'Corredores Viales Demo SA',
      ubicacion: 'AMBA',
      descripcion: 'Peaje demo MVP',
      empresa_id: 'EMP-001',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'PEA-AUBASA',
      nombre: 'AUBASA',
      ubicacion: 'AMBA',
      descripcion: 'Peaje AUBASA',
      empresa_id: '75d868b4-aef5-409a-8d12-973506656811',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'PEA-MERCOSUR',
      nombre: 'Autovía del Mercosur',
      ubicacion: 'Zárate',
      descripcion: 'Peaje MERCOSUR',
      empresa_id: '37ab9246-a07a-40b5-b62d-7a8b8e7782db',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  private estaciones: Estacion[] = [
    {
      id: 'EST-096',
      peaje_id: 'PEA-001',
      nombre: 'Monte Grande',
      ubicacion: 'Monte Grande',
      codigos_proveedor: ['3'],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'EST-092',
      peaje_id: 'PEA-001',
      nombre: 'Tristán Suárez',
      ubicacion: 'Autopista Ezeiza-Cañuelas',
      codigos_proveedor: ['2'],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'EST-091',
      peaje_id: 'PEA-001',
      nombre: 'Ricchieri',
      ubicacion: 'Acceso Ricchieri',
      codigos_proveedor: ['1'],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'EST-095',
      peaje_id: 'PEA-001',
      nombre: 'Mercado Central',
      ubicacion: 'Acceso Mercado Central',
      codigos_proveedor: ['5'],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'EST-DOCK',
      peaje_id: 'PEA-AUBASA',
      nombre: 'DOCK SUD',
      ubicacion: 'Dock Sud',
      codigos_proveedor: ['0001', '1'],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'EST-MER-0001',
      peaje_id: 'PEA-MERCOSUR',
      nombre: 'Estación 0001',
      ubicacion: 'Zárate',
      codigos_proveedor: ['0001', '1'],
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  private patentes: Patente[] = [
    { id: 'PAT-001', patente: 'AD625QB', categoria: 'FLOTA CAMIONES', activa: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'PAT-002', patente: 'AB456CU', categoria: 'FLOTA CAMIONES', activa: true, created_at: '2026-01-01T00:00:00Z' },
  ];

  private pases: Pase[] = [
    { id: 'PAS-001', pase: '98702170', patente_id: 'PAT-001', created_at: '2026-01-01T00:00:00Z' },
  ];

  listarEmpresas(): Observable<Empresa[]> { return of([...this.empresas]); }
  crearEmpresa(data: Omit<Empresa, 'id' | 'created_at'>): Observable<Empresa> {
    const empresa = { ...data, id: `EMP-${String(this.empresas.length + 1).padStart(3, '0')}` };
    this.empresas = [...this.empresas, empresa]; return of(empresa);
  }
  actualizarEmpresa(id: string, data: Partial<Empresa>): Observable<Empresa> {
    const idx = this.empresas.findIndex((e) => e.id === id);
    if (idx < 0) {
      return throwError(() => new Error(`Empresa no encontrada: ${id}`));
    }
    const updated = { ...this.empresas[idx], ...data, id };
    this.empresas = this.empresas.map((e, i) => (i === idx ? updated : e));
    return of(updated);
  }
  listarPeajes(empresaId?: string): Observable<Peaje[]> {
    return of(this.peajes.filter((p) => !empresaId || p.empresa_id === empresaId));
  }

  obtenerPeaje(id: string): Observable<Peaje | null> {
    return of(this.peajes.find((p) => p.id === id) ?? null);
  }

  crearPeaje(data: Omit<Peaje, 'id' | 'created_at'>): Observable<Peaje> {
    const peaje: Peaje = {
      ...data,
      id: `PEA-${String(this.peajes.length + 1).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
    };
    this.peajes = [...this.peajes, peaje];
    return of(peaje);
  }

  actualizarPeaje(id: string, data: Partial<Peaje>): Observable<Peaje> {
    const idx = this.peajes.findIndex((p) => p.id === id);
    if (idx < 0) {
      return throwError(() => new Error(`Peaje no encontrado: ${id}`));
    }
    const updated = { ...this.peajes[idx], ...data, id };
    this.peajes = this.peajes.map((p, i) => (i === idx ? updated : p));
    return of(updated);
  }

  listarEstaciones(peajeId?: string): Observable<Estacion[]> {
    const list = peajeId
      ? this.estaciones.filter((e) => e.peaje_id === peajeId)
      : this.estaciones;
    return of(list.map((e) => ({ ...e, peaje: this.peajes.find((p) => p.id === e.peaje_id) })));
  }

  crearEstacion(data: Omit<Estacion, 'id' | 'created_at' | 'peaje'>): Observable<Estacion> {
    const estacion: Estacion = {
      ...data,
      id: `EST-${String(100 + this.estaciones.length).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
      peaje: this.peajes.find((p) => p.id === data.peaje_id),
    };
    this.estaciones = [...this.estaciones, estacion];
    return of(estacion);
  }

  actualizarEstacion(id: string, data: Partial<Estacion>): Observable<Estacion> {
    const idx = this.estaciones.findIndex((e) => e.id === id);
    if (idx < 0) {
      return throwError(() => new Error(`Estación no encontrada: ${id}`));
    }
    const updated: Estacion = {
      ...this.estaciones[idx],
      ...data,
      id,
      peaje: this.peajes.find((p) => p.id === (data.peaje_id ?? this.estaciones[idx].peaje_id)),
    };
    this.estaciones = this.estaciones.map((e, i) => (i === idx ? updated : e));
    return of(updated);
  }

  sugerirEstacion(valorProveedor: string): Observable<Estacion[]> {
    const q = valorProveedor.trim().toLowerCase();
    if (!q) {
      return of([]);
    }
    const matches = this.estaciones.filter((e) => {
      const codigos = (e.codigos_proveedor ?? []).map((c) => String(c).toLowerCase());
      return (
        codigos.includes(q) ||
        e.nombre.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    });
    return of(
      matches.map((e) => ({ ...e, peaje: this.peajes.find((p) => p.id === e.peaje_id) }))
    );
  }

  reconocerEstacion(valorProveedor: string, empresaId?: string): Observable<ResultadoReconocimientoEstacion> {
    const conPeaje = this.estaciones.map((e) => ({
      ...e,
      peaje: this.peajes.find((p) => p.id === e.peaje_id),
    }));
    return of(reconocerEstacionEnCatalogo(conPeaje, valorProveedor, empresaId, this.peajes));
  }

  confirmarAliasEstacion(data: Omit<EstacionAliasProveedor, 'id' | 'created_at' | 'valor_normalizado'>): Observable<EstacionAliasProveedor> {
    const estacion = this.estaciones.find((e) => e.id === data.estacion_id);
    if (estacion && !estacion.codigos_proveedor?.includes(data.valor_proveedor)) {
      estacion.codigos_proveedor = [...(estacion.codigos_proveedor ?? []), data.valor_proveedor];
    }
    return of({ ...data, id: `ALIAS-${Date.now()}`, valor_normalizado: data.valor_proveedor.trim().toUpperCase(), created_at: new Date().toISOString() });
  }

  listarPatentes(): Observable<Patente[]> {
    return of([...this.patentes]);
  }

  crearPatente(data: Omit<Patente, 'id' | 'created_at'>): Observable<Patente> {
    const patente: Patente = {
      ...data,
      id: `PAT-${String(this.patentes.length + 1).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
    };
    this.patentes = [...this.patentes, patente];
    return of(patente);
  }

  actualizarPatente(id: string, data: Partial<Omit<Patente, 'id' | 'created_at'>>): Observable<Patente> {
    const idx = this.patentes.findIndex((p) => p.id === id);
    if (idx < 0) return throwError(() => new Error(`Patente no encontrada: ${id}`));
    const updated = { ...this.patentes[idx], ...data, id };
    this.patentes = this.patentes.map((p, i) => (i === idx ? updated : p));
    return of(updated);
  }

  listarPases(patenteId?: string): Observable<Pase[]> {
    const list = patenteId
      ? this.pases.filter((p) => p.patente_id === patenteId)
      : this.pases;
    return of(
      list.map((p) => ({
        ...p,
        patente: this.patentes.find((pat) => pat.id === p.patente_id),
      }))
    );
  }

  crearPase(data: Omit<Pase, 'id' | 'created_at' | 'patente'>): Observable<Pase> {
    const pase: Pase = {
      ...data,
      id: `PAS-${String(this.pases.length + 1).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
      patente: this.patentes.find((p) => p.id === data.patente_id),
    };
    this.pases = [...this.pases, pase];
    return of(pase);
  }
}
