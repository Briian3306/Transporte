import { Observable } from 'rxjs';
import {
  AlgoritmoCombinado,
  Empresa,
  AlgoritmoCombinadoPaso,
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
  Estacion,
  Factura,
  Pasada,
  PasadaEstandarizada,
  Pase,
  Patente,
  Peaje,
  PlantillaConfiguracion,
  RegistroCargaPeajes,
} from './peajes.models';
import { PasadaColumnKey } from './peajes.types';

/** Resultado de parseo de Excel (paso 1–2). */
export interface ExcelCargaPreview {
  nombreArchivo: string;
  tamanioBytes: number;
  totalFilas: number;
  columnas: string[];
  /** Máximo 10 filas para preview (RNF-03). */
  filasPreview: Record<string, unknown>[];
  /** Lote completo: la UI muestra 10 filas, el motor procesa todas. */
  filasOrigen: Record<string, unknown>[];
  tiposInferidos: Record<string, string>;
}

export interface MapeoColumna {
  columnaOrigen: string;
  columnaDestino: PasadaColumnKey | null;
  excluida: boolean;
}

export interface RelacionEstacionProveedor {
  valorProveedor: string;
  estacionId: string | null;
  peajeIdDerivado?: string | null;
}

export interface ResultadoValidacionCarga {
  validas: PasadaEstandarizada[];
  errores: ErrorValidacionPasada[];
  diferenciaFactura?: number | null;
  dentroTolerancia: boolean;
}

export interface ConfirmacionCargaInput {
  factura: Omit<Factura, 'id' | 'created_at'> & { id?: string };
  pasadas: PasadaEstandarizada[];
  plantillaId?: string | null;
  mapeos: MapeoColumna[];
  relacionesEstacion: RelacionEstacionProveedor[];
  parametrosEfectivos?: Record<string, unknown>;
}

export interface ConfirmacionCargaResultado {
  factura: Factura;
  pasadas: Pasada[];
  registro: RegistroCargaPeajes;
}

/** Catálogos — implementación real: agente 01; mocks: 02. */
export interface PeajesCatalogoService {
  listarEmpresas(): Observable<Empresa[]>;
  crearEmpresa(data: Omit<Empresa, 'id' | 'created_at'>): Observable<Empresa>;
  listarPeajes(empresaId?: string): Observable<Peaje[]>;
  obtenerPeaje(id: string): Observable<Peaje | null>;
  crearPeaje(data: Omit<Peaje, 'id' | 'created_at'>): Observable<Peaje>;
  actualizarPeaje(id: string, data: Partial<Peaje>): Observable<Peaje>;

  listarEstaciones(peajeId?: string): Observable<Estacion[]>;
  crearEstacion(data: Omit<Estacion, 'id' | 'created_at' | 'peaje'>): Observable<Estacion>;
  actualizarEstacion(id: string, data: Partial<Estacion>): Observable<Estacion>;
  sugerirEstacion(valorProveedor: string): Observable<Estacion[]>;

  listarPatentes(): Observable<Patente[]>;
  crearPatente(data: Omit<Patente, 'id' | 'created_at'>): Observable<Patente>;

  listarPases(patenteId?: string): Observable<Pase[]>;
  crearPase(data: Omit<Pase, 'id' | 'created_at' | 'patente'>): Observable<Pase>;
}

/** Persistencia de carga / factura — agente 01; mocks hasta F01-2/5/6. */
export interface PeajesCargaService {
  validarCarga(
    pasadas: PasadaEstandarizada[],
    factura: Pick<Factura, 'importe_sin_iva' | 'importe_total'>
  ): Observable<ResultadoValidacionCarga>;
  confirmarCarga(input: ConfirmacionCargaInput): Observable<ConfirmacionCargaResultado>;
  detectarDuplicados(pasadas: PasadaEstandarizada[]): Observable<ErrorValidacionPasada[]>;
}

/** Plantillas y algoritmos — implementación 01; UI/mocks 03. */
export interface PeajesPlantillasService {
  listarPlantillas(empresaId?: string): Observable<PlantillaConfiguracion[]>;
  obtenerPlantilla(id: string): Observable<PlantillaConfiguracion | null>;
  guardarPlantilla(
    plantilla: Omit<PlantillaConfiguracion, 'id' | 'created_at' | 'updated_at' | 'configuraciones'> & {
      id?: string;
    },
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[]
  ): Observable<PlantillaConfiguracion>;
  /** Reemplazo transaccional de configuraciones (RF-28 / F01-7). */
  sobrescribirConfiguraciones(
    plantillaId: string,
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[]
  ): Observable<ConfiguracionPlantilla[]>;

  listarAlgoritmos(empresaId?: string): Observable<AlgoritmoCombinado[]>;
  guardarAlgoritmo(
    algoritmo: Omit<AlgoritmoCombinado, 'id' | 'created_at' | 'updated_at' | 'pasos'> & { id?: string },
    pasos: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[]
  ): Observable<AlgoritmoCombinado>;
  expandirAlgoritmo(algoritmoId: string): Observable<AlgoritmoCombinadoPaso[]>;
}

/**
 * Motor de transformación (implementación en plantillas/**, agente 03).
 * El wizard (02) solo consume esta interfaz.
 */
export interface PeajesMotorTransformacion {
  aplicarPipeline(
    filas: Record<string, unknown>[],
    configuraciones: ConfiguracionPlantilla[],
    algoritmos?: AlgoritmoCombinado[]
  ): PasadaEstandarizada[];
  validarDefinicionPlantilla(
    configuraciones: ConfiguracionPlantilla[],
    columnasDisponibles: string[]
  ): ErrorValidacionPasada[];
}

/** Token de inyección sugerido para mocks vs real (02/03/01). */
export const PEAJES_CATALOGO_SERVICE = 'PEAJES_CATALOGO_SERVICE';
export const PEAJES_CARGA_SERVICE = 'PEAJES_CARGA_SERVICE';
export const PEAJES_PLANTILLAS_SERVICE = 'PEAJES_PLANTILLAS_SERVICE';
export const PEAJES_MOTOR_TRANSFORMACION = 'PEAJES_MOTOR_TRANSFORMACION';
