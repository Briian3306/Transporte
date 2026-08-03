import { ConfiguracionPlantilla } from '../../models/peajes.models';

/**
 * Configuración de aplicación de Acceso Oeste para `387882.csv`.
 * La resolución de CODIGO_ESTACION a ESTACION_ID corresponde al catálogo del
 * backend: este pipeline conserva la clave externa `ESTACION - VIA`.
 */
export const ACCESO_OESTE_FILAS_MUESTRA: Record<string, unknown>[] = [
  {
    FECHA: '2026-07-16', HORA: '04:36:48', ESTACION: 'ITUZAINGO', VIA: '05',
    DISPOSITIVO: '94337220', PATENTE: 'OWG130', TARIFA: '3976.59', BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-07-16', HORA: '05:45:36', ESTACION: 'LUJAN', VIA: '01',
    DISPOSITIVO: '94401977', PATENTE: 'AC264UA', TARIFA: '3976.59', BONIFICACION: '0.00',
  },
];

export const ACCESO_OESTE_COLUMNAS_REQUERIDAS = [
  'FECHA', 'HORA', 'ESTACION', 'VIA', 'DISPOSITIVO', 'PATENTE', 'TARIFA', 'BONIFICACION',
] as const;

/** Pipeline atómico apto para persistirse como la plantilla ACCESO OESTE. */
export function buildAccesoOestePlantillaConfigs(): ConfiguracionPlantilla[] {
  const plantillaId = 'plt-acceso-oeste';
  const config = (
    id: string, nombre_columna: string, columna_destino: string, orden: number,
    configuracion: Record<string, unknown>
  ): ConfiguracionPlantilla => ({
    id, plantilla_id: plantillaId, nombre_columna, columna_destino, orden,
    tipo: 'transformacion', algoritmo_combinado_id: null, configuracion, obligatoria: true,
  });

  return [
    config('ao-10', 'FECHA', 'FECHA_HORA', 10, {
      algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
      columnas_entrada: ['FECHA', 'HORA'], formato_hora: 'YYYY-MM-DD HH:MM:SS',
    }),
    config('ao-20', 'ESTACION', 'CODIGO_ESTACION', 20, {
      algoritmo_codigo: 'COMBINAR_COLUMNAS',
      columnas_entrada: ['ESTACION', 'VIA'], separador: ' - ',
    }),
    config('ao-30', 'DISPOSITIVO', 'PASE_ID', 30, {
      algoritmo_codigo: 'CONVERTIR_TEXTO', columna: 'DISPOSITIVO',
    }),
    config('ao-40', 'PATENTE', 'PATENTE_ID', 40, {
      algoritmo_codigo: 'BORRAR_ESPACIOS', columna: 'PATENTE',
    }),
    config('ao-50', 'PATENTE_ID', 'PATENTE_ID', 50, {
      algoritmo_codigo: 'ELIMINAR_GUIONES', columna: 'PATENTE_ID',
    }),
    config('ao-60', 'PATENTE_ID', 'PATENTE_ID', 60, {
      algoritmo_codigo: 'CONVERTIR_MAYUSCULAS', columna: 'PATENTE_ID',
    }),
    config('ao-70', 'TARIFA', 'PRECIO', 70, {
      algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA',
    }),
    config('ao-80', 'BONIFICACION', 'BONIFICACION', 80, {
      algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'BONIFICACION',
    }),
    config('ao-90', 'IMPORTE_NETO', 'IMPORTE_NETO', 90, {
      algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
      columnas_entrada: ['PRECIO', 'BONIFICACION'],
    }),
    config('ao-100', 'QUANTITY', 'QUANTITY', 100, {
      algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1,
    }),
  ];
}
