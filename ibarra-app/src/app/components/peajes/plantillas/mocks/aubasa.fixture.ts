import { ConfiguracionPlantilla } from '../../models/peajes.models';

/**
 * AUBASA / Telepase CSV (`pasadas_2026-07-15_5364164.csv`).
 * FECHA = yyyy-MM-dd, HORA = HHMMSS digits (Excel HORA_TRANSFORMADA oracle = HH:mm:ss).
 * ESTACION_ID se resuelve en el catálogo (p. ej. 0001 → DOCK SUD).
 */
export const AUBASA_FILAS_MUESTRA: Record<string, unknown>[] = [
  {
    FECHA: '2026-07-03',
    HORA: '114254',
    /** Oracle Excel HORA_TRANSFORMADA (solo referencia en tests). */
    HORA_TRANSFORMADA: '11:42:54',
    ESTACION: '0001',
    VIA: '51M',
    DISPOSITIVO: '99739957',
    PATENTE: 'AG309CO',
    TARIFA: '13466.55',
    BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-07-02',
    HORA: '1337',
    HORA_TRANSFORMADA: '00:13:37',
    ESTACION: '0001',
    VIA: '54M',
    DISPOSITIVO: '99739957',
    PATENTE: 'AG309CO',
    TARIFA: '13466.55',
    BONIFICACION: '0.00',
  },
];

export const AUBASA_COLUMNAS_REQUERIDAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'DISPOSITIVO',
  'PATENTE',
  'TARIFA',
  'BONIFICACION',
] as const;

/** TARIFA con IVA → neto tras ELIMINAR_IVA (÷ 1.21, 2 decimales). */
export const AUBASA_IMPORTE_SIN_IVA = Math.round((13466.55 / 1.21) * 100) / 100;

/**
 * Pipeline producción AUBASA-7-2026 (espejo CORRE-VIALES-V1 + HHMMSS + ELIMINAR_IVA).
 * No usa columna HORA_TRANSFORMADA del Excel de prueba.
 */
export function buildAubasaPlantillaConfigs(): ConfiguracionPlantilla[] {
  const plantillaId = 'plt-aubasa';
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
    config('aubasa-10', 'FECHA', 'FECHA_HORA', 10, {
      algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
      columnas_entrada: ['FECHA', 'HORA'],
      // Telepase AUBASA: FECHA=yyyy-MM-dd, HORA=HHMMSS (114254 → 11:42:54).
      formato_hora: 'HHMMSS',
    }),
    config('aubasa-20', 'PATENTE', 'PATENTE_ID', 20, {
      algoritmo_codigo: 'BORRAR_ESPACIOS',
      columna: 'PATENTE',
    }),
    config('aubasa-30', 'PATENTE_ID', 'PATENTE_ID', 30, {
      algoritmo_codigo: 'ELIMINAR_GUIONES',
      columna: 'PATENTE_ID',
    }),
    config('aubasa-40', 'PATENTE_ID', 'PATENTE_ID', 40, {
      algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
      columna: 'PATENTE_ID',
    }),
    config('aubasa-50', 'DISPOSITIVO', 'PASE_ID', 50, {
      algoritmo_codigo: 'COPIAR_COLUMNA',
      columna: 'DISPOSITIVO',
    }),
    config('aubasa-60', 'TARIFA', 'PRECIO', 60, {
      algoritmo_codigo: 'CONVERTIR_NUMERO',
      columna: 'TARIFA',
    }),
    config('aubasa-70', 'BONIFICACION', 'BONIFICACION', 70, {
      algoritmo_codigo: 'CONVERTIR_NUMERO',
      columna: 'BONIFICACION',
    }),
    config('aubasa-80', 'IMPORTE_NETO', 'IMPORTE_NETO', 80, {
      algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
      columnas_entrada: ['PRECIO', 'BONIFICACION'],
    }),
    config('aubasa-90', 'IMPORTE_NETO', 'IMPORTE_NETO', 90, {
      algoritmo_codigo: 'ELIMINAR_IVA',
      columna: 'IMPORTE_NETO',
    }),
    config('aubasa-100', 'QUANTITY', 'QUANTITY', 100, {
      algoritmo_codigo: 'ASIGNAR_VALOR',
      valor: 1,
    }),
  ];
}
