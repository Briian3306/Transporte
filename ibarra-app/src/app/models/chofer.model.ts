export type ChoferStatus = 'Activo' | 'Inactivo' | 'Fuera de Servicio' | 'Vacaciones' | 'Licencia';

export interface Chofer {
    id: number
    legajo: number
    nombre: string
    apellido: string
    dni: number
    cuit: string
    tramite: string
    nacimiento: string
    domicilio: string
    localidad: string
    provincia: string
    telefono: string
    fecha_alta: string
    photo: string
    image?: File
    disponible: boolean
    is_active: boolean
    fecha_baja: any
    status: ChoferStatus;
  }
  
export interface ChoferDetail extends Chofer {
}

export interface ChoferBasic {
    id:           number;
    nombre:       string; 
    apellido:     string;
    apellido_nom: string;
    photo:        string;
}

export interface ChoferMedium extends ChoferBasic {
  dni:          number;
  tramite:      string;
  domicilio:    string;
  telefono:     string;
}