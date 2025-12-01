export interface Checklist {
  id: string;
  template_id: string;
  fecha_realizacion: string;
  fecha_creacion: string;
  informacion: ChecklistInformation;
  respuestas: ChecklistResponses;
  observaciones: ChecklistObservations;
  validaciones: ChecklistValidations;
  total_items: number;
  items_completados: number;
  items_con_error: number;
  items_con_advertencia: number;
  items_correctos: number;
  porcentaje_completado: number;
  estado: ChecklistStatus;
  requiere_revision: boolean;
  created_by?: string;
  updated_at: string;
}

export interface ChecklistInformation {
  // Información de recursos
  informacionRecurso?: VehicleInformation | DriverInformation | UnitInformation | MachineInformation | SectorInformation;
  tipoRecurso?: string;
}

// Interfaces específicas para cada tipo de recurso

export interface VehicleInformation {
  vehiculo_id: number;
  placa: string;
  marca: string;
  modelo: string;
  kilometraje: number;
  ubicacion: string;
}

export interface DriverInformation {
  chofer_id: number;
  nombre: string;
  dni: string;
}

export interface UnitInformation {
  logistica_id: number;
  chofer_id: number;
  chofer_nombre: string;
  chofer_dni: string;
  vehiculo_id: number;
  camion_patente: string;
  semi1_patente: string;
  tipo_unidad: string;
  estado: string;
}

export interface MachineInformation {
  maquina_id: string;
  nombre: string;
  modelo: string;
  numero_serie: string;
  estado: string;
}

export interface SectorInformation {
  sector_id: string;
  nombre: string;
  tipo_area: string;
}

export interface ChecklistResponses {
  [itemId: string]: {
    valor: string;
    observacion: string;
    timestamp: string;
    // Configuración completa del item al momento de la respuesta
    itemConfig: {
      id: string;
      descripcion: string;
      descripcionDetallada?: string;
      tipoValidacion: string;
      comportamiento: string;
      esObligatorio: boolean;
      configuracion: any;
      orden?: number;
      seccionId?: string;
      seccionTitulo?: string;
    };
    // Estado de validación al momento de la respuesta
    validacion: {
      tipo: 'error' | 'advertencia' | 'correcto';
      mensaje: string;
      timestamp: string;
    };
    // Metadatos adicionales
    metadata: {
      usuario?: string;
      dispositivo?: string;
      versionTemplate?: string;
      esEdicion?: boolean;
      timestampEdicion?: string;
    };
  };
}

export interface ChecklistObservations {
  [itemId: string]: string;
}

export interface ChecklistValidations {
  errores: ValidationError[];
  advertencias: ValidationError[];
  correctos: ValidationError[];
}

export interface ValidationError {
  item: string;
  mensaje: string;
  item_id?: string;
  seccion?: string;
}

export type ChecklistStatus = 'completado' | 'parcial' | 'con_errores' | 'en_progreso';
