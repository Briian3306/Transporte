// Configuración
export interface NivelRiesgo {
  codigo: string;
  nombre: string;
  puntaje_minimo: number;
  color: string;
  icono?: string;
  responsable: string;
  tiempo_respuesta: string;
  orden: number;
}

export interface SubtipoIncidente {
  codigo: string;
  nombre: string;
  peso: number;
  indicaciones: string[];
  acciones: string[];
  orden: number;
}

export interface TipoIncidente {
  codigo: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  peso_base: number;
  requiere_patente: boolean;
  requiere_ubicacion_detallada: boolean;
  orden: number;
  subtipos: SubtipoIncidente[];
}

export interface ConfiguracionIncidentes {
  id: string;
  clave: string;
  configuracion: any;
  descripcion?: string;
  version: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Incidente
export interface Incidente {
  id: string;
  fecha: string;
  hora: string;
  nombre_reportante: string;
  telefono_reportante: string;
  categoria_reportante: CategoriaReportante;
  motivo: string;
  ubicacion: string;
  patente?: string;
  tipo_incidente: string;
  subtipo_incidente: string;
  puntaje_total: number;
  nivel_riesgo: string;
  indicaciones_aplicadas: string[];
  acciones_aplicadas: string[];
  configuracion_snapshot: any;
  estado_seguimiento: EstadoSeguimiento;
  comentarios_seguimiento: ComentarioSeguimiento[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type CategoriaReportante = 'chofer' | 'cliente' | 'policia' | 'bomberos' | 'tercero' | 'otro';
export type EstadoSeguimiento = 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';

export interface ComentarioSeguimiento {
  texto: string;
  usuario: string;
  timestamp: string;
}

export interface IncidenteFilters {
  fechaInicio?: string;
  fechaFin?: string;
  tipo_incidente?: string;
  subtipo_incidente?: string;
  nivel_riesgo?: string;
  estado_seguimiento?: string;
  categoria_reportante?: string;
}

export interface EstadisticasIncidentes {
  total: number;
  por_nivel_riesgo: { [key: string]: number };
  por_estado: { [key: string]: number };
  por_tipo: { [key: string]: number };
}

