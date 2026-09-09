export interface VehiculoInfo {
  fecha: string;
  hora: string;
  tipoVehiculo: 'CAMION' | 'SEMIRREMOLQUE';
  patenteCamion: string;
  patenteSemi?: string;
  odometro: number;
}

export interface NeumaticoInstalar {
  ejeCamion: number;
  ladoEje: 'izquierdo' | 'derecho';
  estadoBanda: 'NUEVO' | 'RECAPADO' | 'USADO';
  tipoNeumatico: 'IDENTIFICADO' | 'NO_IDENTIFICADO';
  
  // Si es IDENTIFICADO
  idNeumatico?: string;
  
  // Si es NO_IDENTIFICADO
  numeroSerie?: string;
  dot?: string;
  marca?: string;
  modelo?: string;
}

export interface NeumaticoRetirado {
  tipoNeumatico: 'IDENTIFICADO' | 'NO_IDENTIFICADO';
  destino: 'RECAPAR' | 'DESECHAR' | 'OTRO';
  motivo: 'DESGASTE' | 'PINCHADURA' | 'CORTE' | 'SEPARACION' | 'OTRO';
  observaciones?: string;

  // Si es IDENTIFICADO
  id?: string;

  // Si es NO_IDENTIFICADO
  serie?: string;
  dot?: string;
  marca?: string;
  modelo?: string;
}

export interface RegistroCambioNeumaticos extends VehiculoInfo {
  neumaticos: NeumaticoInstalar[];
  neumaticosRetirados: NeumaticoRetirado[];
  type: 'cambio-neumatico';
}

