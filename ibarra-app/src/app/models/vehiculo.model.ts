export type VehiculoStatus = 'Activo' | 'En reparación' | 'Inactivo' | 'Fuera de servicio' | 'Vendido';

export interface Vehiculo extends VehiculoBasic {
    color: string
    anio: number
    disponible: boolean
    fecha_create: string
    isactive: boolean
  }

export interface VehiculoBasic {
    id:          number;
    descriptivo: string;
    patente:     string;
    marca:       string;
    modelo:      string;
    chasis:      string;
    motor?:      string;
    config_ejes: string;
    status:      VehiculoStatus;
}
export interface VehiculoShort {
    id: number
    patente: string
}

export interface Camion extends VehiculoBasic {
  elementos?:   any[];
}
export interface Semirremolque extends VehiculoBasic {
  elementos?:   any[];
}

export interface VehiculoEspecificaciones {
  id: number
  vehiculo: number;
  ancho: number;
  alto: number;
  longitud: number;
  volumen_interior: number;
  volumen_carga: number;
  distancia_al_suelo: number;
  peso: number;
  capacidad_combustible: number;
}