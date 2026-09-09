export interface ChecklistTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  secciones: ChecklistSection[];
  tipo?: TemplateResourceType;
  version?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface ChecklistSection {
  id: string;
  titulo: string;
  items: ChecklistItem[];
  orden?: number;
}

export interface ChecklistItem {
  id: string;
  descripcion: string;
  descripcionDetallada?: string;
  tipoValidacion: ValidationType;
  comportamiento: ValidationBehavior;
  esObligatorio: boolean;
  configuracion: ValidationConfig;
  orden?: number;
}

export type ValidationType = 
  | 'sin_validacion'
  | 'si_no'
  | 'si_no_na'
  | 'valor_min_max'
  | 'cantidad'
  | 'bueno_regular_malo'
  | 'personalizado';

export type ValidationBehavior = 
  | 'genera_error'
  | 'solo_advertencia'
  | 'sin_validacion';

export interface ValidationConfig {
  valoresError?: string[];
  valorMinimo?: number;
  valorMaximo?: number;
  generarErrorFueraRango?: boolean;
  opcionesPersonalizadas?: string[];
}

export interface ChecklistFormData {
  informacionRecurso?: any;
  tipoRecurso?: TemplateResourceType;
}

export interface ChecklistResponse {
  [itemId: string]: {
    valor: string;
    observacion: string;
    timestamp: string;
    // Configuración completa del item al momento de la respuesta
    itemConfig: {
      id: string;
      descripcion: string;
      descripcionDetallada?: string;
      tipoValidacion: ValidationType;
      comportamiento: ValidationBehavior;
      esObligatorio: boolean;
      configuracion: ValidationConfig;
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

export interface ChecklistObservation {
  [itemId: string]: string;
}

export interface ValidationResult {
  tipo: 'error' | 'advertencia' | 'correcto';
  mensaje: string;
}

export interface ChecklistProgress {
  totalItems: number;
  itemsCompletados: number;
  porcentajeCompletado: number;
  itemsFaltantes: string[];
}

export interface ChecklistValidationSummary {
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

export type TemplateResourceType = 
  | 'vehiculo'
  | 'chofer'
  | 'unidad'
  | 'maquina'
  | 'sector';