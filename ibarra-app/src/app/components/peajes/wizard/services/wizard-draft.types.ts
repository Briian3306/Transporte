/** Tipos compartidos del pipeline editable del wizard (Paso 3 / F02-10 / F02-11). */

export interface ConfiguracionPlantillaDraft {
  clientId: string;
  orden: number;
  tipo: 'transformacion' | 'mapeo' | 'validacion' | string;
  nombre_columna: string;
  columna_destino?: string | null;
  algoritmo_combinado_id?: string | null;
  configuracion: {
    algoritmo_codigo?: string;
    columnas_entrada?: string[];
    parametros?: Record<string, unknown>;
    habilitado?: boolean;
    [key: string]: unknown;
  } | null;
  obligatoria: boolean;
}
