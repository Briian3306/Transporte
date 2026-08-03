import { ConfiguracionPlantilla } from '../../models/peajes.models';

/** Muestra real de `557074.csv`; ESTACION_ID se resuelve luego en el catálogo. */
export const AUSOL_FILAS_MUESTRA: Record<string, unknown>[] = [
  {
    FECHA: '2026-07-16', HORA: '01:34:14', ESTACION: 'CAMPANA', VIA: '0003',
    DISPOSITIVO: '94891934', PATENTE: 'AE751PA', TARIFA: '3976.59', BONIFICACION: '0.00',
  },
  {
    FECHA: '2026-07-16', HORA: '05:17:58', ESTACION: 'CAMPANA', VIA: '0001',
    DISPOSITIVO: '93423682', PATENTE: 'AH033DL', TARIFA: '3976.59', BONIFICACION: '0.00',
  },
];

export const AUSOL_COLUMNAS_REQUERIDAS = [
  'FECHA', 'HORA', 'ESTACION', 'DISPOSITIVO', 'PATENTE', 'TARIFA', 'BONIFICACION',
] as const;

/** Pipeline reutilizable de AUSOL. `ESTACION_ID` conserva la clave para el reconocedor. */
export function buildAusolPlantillaConfigs(): ConfiguracionPlantilla[] {
  const plantillaId = 'plt-ausol';
  const config = (
    id: string, nombre_columna: string, columna_destino: string, orden: number,
    configuracion: Record<string, unknown>
  ): ConfiguracionPlantilla => ({
    id, plantilla_id: plantillaId, nombre_columna, columna_destino, orden,
    tipo: 'transformacion', algoritmo_combinado_id: null, configuracion, obligatoria: true,
  });
  return [
    config('ausol-10', 'FECHA', 'FECHA_HORA', 10, { algoritmo_codigo: 'FORMATEAR_FECHA_HORA', columnas_entrada: ['FECHA', 'HORA'], formato_hora: 'YYYY-MM-DD HH:MM:SS' }),
    config('ausol-20', 'ESTACION', 'ESTACION_ID', 20, { algoritmo_codigo: 'REEMPLAZAR_TEXTO', columna: 'ESTACION', reglas: [{ buscar: 'BD', reemplazar: 'BLACK DECK' }] }),
    config('ausol-30', 'DISPOSITIVO', 'PASE_ID', 30, { algoritmo_codigo: 'CONVERTIR_TEXTO', columna: 'DISPOSITIVO' }),
    config('ausol-40', 'PATENTE', 'PATENTE_ID', 40, { algoritmo_codigo: 'BORRAR_ESPACIOS', columna: 'PATENTE' }),
    config('ausol-50', 'PATENTE_ID', 'PATENTE_ID', 50, { algoritmo_codigo: 'ELIMINAR_GUIONES', columna: 'PATENTE_ID' }),
    config('ausol-60', 'PATENTE_ID', 'PATENTE_ID', 60, { algoritmo_codigo: 'CONVERTIR_MAYUSCULAS', columna: 'PATENTE_ID' }),
    config('ausol-70', 'TARIFA', 'PRECIO', 70, { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' }),
    config('ausol-80', 'BONIFICACION', 'BONIFICACION', 80, { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'BONIFICACION' }),
    config('ausol-90', 'IMPORTE_NETO', 'IMPORTE_NETO', 90, { algoritmo_codigo: 'CALCULAR_IMPORTE_NETO', columnas_entrada: ['PRECIO', 'BONIFICACION'] }),
    config('ausol-100', 'QUANTITY', 'QUANTITY', 100, { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 }),
  ];
}
