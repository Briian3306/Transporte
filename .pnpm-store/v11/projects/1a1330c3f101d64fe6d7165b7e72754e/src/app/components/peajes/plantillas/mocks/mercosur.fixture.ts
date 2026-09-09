import { ConfiguracionPlantilla } from '../../models/peajes.models';

/**
 * Autovía del Mercosur — `pasadas_2026-07-01_79157.csv` + factura A-00015-00079157.
 * El CSV mezcla estaciones 0001…0004; solo ESTACION=1 concilia con el TOTAL de factura.
 * Ver `docs/plan/ejemplo-mercosur-procesamiento-pasadas.md`.
 */
export const MERCOSUR_TOTAL_FACTURA = 4721445.29;
export const MERCOSUR_SUBTOTAL_FACTURA = 3902020.9;
export const MERCOSUR_FILAS_ESTACION_1 = 164;

/** Muestra mixta (estaciones 0001 y 0002) para unit tests del filtro. */
export const MERCOSUR_FILAS_MUESTRA: Record<string, unknown>[] = [
  {
    FECHA: '2026-06-16',
    HORA: '184516',
    ESTACION: '0001',
    VIA: '11',
    DISPOSITIVON: '90836134',
    DOMINIO: 'AD933WS',
    TARIFA: '42365.91',
    BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-06-17',
    HORA: '133344',
    ESTACION: '0001',
    VIA: '11',
    DISPOSITIVON: '99598699',
    DOMINIO: 'AF734UP',
    TARIFA: '42365.91',
    BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-06-18',
    HORA: '101010',
    ESTACION: '0002',
    VIA: '21',
    DISPOSITIVON: '99999999',
    DOMINIO: 'XX000XX',
    TARIFA: '99999.99',
    BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-06-19',
    HORA: '122746',
    ESTACION: '0001',
    VIA: '11',
    DISPOSITIVON: '94530188',
    DOMINIO: 'AD736OU',
    TARIFA: '28243.94',
    BONIFICACION: '0.00',
  },
];

export const MERCOSUR_COLUMNAS_REQUERIDAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'DISPOSITIVON',
  'DOMINIO',
  'TARIFA',
  'BONIFICACION',
] as const;

/**
 * Pipeline MERCOSUR: filtrar ESTACION=1, luego transformación Demo-like
 * (FECHA+HORA HHMMSS, DOMINIO, DISPOSITIVON, TARIFA punto decimal).
 */
export function buildMercosurPlantillaConfigs(): ConfiguracionPlantilla[] {
  const plantillaId = 'plt-mercosur';
  const config = (
    id: string,
    nombre_columna: string,
    columna_destino: string,
    orden: number,
    configuracion: Record<string, unknown>
  ): ConfiguracionPlantilla => ({
    id,
    plantilla_id: plantillaId,
    nombre_columna,
    columna_destino,
    orden,
    tipo: 'transformacion',
    algoritmo_combinado_id: null,
    configuracion,
    obligatoria: true,
  });

  return [
    {
      id: 'mercosur-5',
      plantilla_id: plantillaId,
      nombre_columna: 'ESTACION',
      columna_destino: null,
      orden: 5,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'FILTRAR_COLUMNA',
        columna: 'ESTACION',
        valor: '1',
      },
      obligatoria: false,
    },
    config('mercosur-10', 'FECHA', 'FECHA_HORA', 10, {
      algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
      columnas_entrada: ['FECHA', 'HORA'],
      formato_hora: 'HHMMSS',
    }),
    config('mercosur-20', 'DOMINIO', 'PATENTE_ID', 20, {
      algoritmo_codigo: 'BORRAR_ESPACIOS',
      columna: 'DOMINIO',
    }),
    config('mercosur-30', 'PATENTE_ID', 'PATENTE_ID', 30, {
      algoritmo_codigo: 'ELIMINAR_GUIONES',
      columna: 'PATENTE_ID',
    }),
    config('mercosur-40', 'PATENTE_ID', 'PATENTE_ID', 40, {
      algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
      columna: 'PATENTE_ID',
    }),
    config('mercosur-50', 'DISPOSITIVON', 'PASE_ID', 50, {
      algoritmo_codigo: 'COPIAR_COLUMNA',
      columna: 'DISPOSITIVON',
    }),
    config('mercosur-60', 'TARIFA', 'PRECIO', 60, {
      algoritmo_codigo: 'CONVERTIR_NUMERO',
      columna: 'TARIFA',
    }),
    config('mercosur-70', 'BONIFICACION', 'BONIFICACION', 70, {
      algoritmo_codigo: 'CONVERTIR_NUMERO',
      columna: 'BONIFICACION',
    }),
    config('mercosur-80', 'IMPORTE_NETO', 'IMPORTE_NETO', 80, {
      algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
      columnas_entrada: ['PRECIO', 'BONIFICACION'],
    }),
    config('mercosur-90', 'QUANTITY', 'QUANTITY', 90, {
      algoritmo_codigo: 'ASIGNAR_VALOR',
      valor: 1,
    }),
  ];
}
