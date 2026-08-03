import { ExcelCargaPreview, MapeoColumna, PasadaColumnKey } from '../../models';
import { WizardFacturaForm } from '../services/peajes-wizard-state.service';

/**
 * Fixture Autopistas Urbanas (docs/plan/ejemplo-autopistas-urbanas-pasadas.md).
 * Primeras 10 filas alineadas al CSV `docs/plan/csv/autopistas_urbanas.csv`.
 */
export const AU_EJEMPLO_NOMBRE_ARCHIVO = 'autopistas_urbanas.csv';

export const AU_COLUMNAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'VIA',
  'DISPOSITIVO',
  'PATENTE',
  'CATEGORIA',
  'TARIFA',
  'TIPO_DE_DOCUMENTO',
  'DOCUMENTO_LEGAL',
  'DOCUMENTO_SA',
  'CLIENTE__WEB',
  'CLIENTE_RED',
  'SUB_CUENTA',
] as const;

export const AU_COLUMNAS_INCLUIDAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'VIA',
  'DISPOSITIVO',
  'PATENTE',
  'TARIFA',
] as const;

export const AU_COLUMNAS_EXCLUIDAS = [
  'CATEGORIA',
  'TIPO_DE_DOCUMENTO',
  'DOCUMENTO_LEGAL',
  'DOCUMENTO_SA',
  'CLIENTE__WEB',
  'CLIENTE_RED',
  'SUB_CUENTA',
] as const;

/** Primeras 10 filas del ejemplo (no inventar filas fuera del doc/CSV). */
export const AU_FILAS_ORIGEN: Record<string, unknown>[] = [
  {
    FECHA: '2026-07-27',
    HORA: '12:14:33',
    ESTACION: 'VAR',
    VIA: '02C',
    DISPOSITIVO: '99793212',
    PATENTE: 'AG507DK',
    CATEGORIA: '9',
    TARIFA: '19.985,09',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-25',
    HORA: '10:09:33',
    ESTACION: 'VAR',
    VIA: '02P',
    DISPOSITIVO: '97076009',
    PATENTE: 'AH185KI',
    CATEGORIA: '9',
    TARIFA: '19.985,09',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-24',
    HORA: '06:55:58',
    ESTACION: 'KDT',
    VIA: '02P',
    DISPOSITIVO: '99837024',
    PATENTE: 'AB456CU',
    CATEGORIA: '7',
    TARIFA: '7.918,73',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-27',
    HORA: '05:25:32',
    ESTACION: 'KDT',
    VIA: '02C',
    DISPOSITIVO: '98702170',
    PATENTE: 'AD625QB',
    CATEGORIA: '7',
    TARIFA: '7.918,73',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-23',
    HORA: '04:22:17',
    ESTACION: 'KDT',
    VIA: '02C',
    DISPOSITIVO: '97135819',
    PATENTE: 'AH351RT',
    CATEGORIA: '9',
    TARIFA: '7.918,73',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-28',
    HORA: '09:50:36',
    ESTACION: 'KDT',
    VIA: '02C',
    DISPOSITIVO: '94579785',
    PATENTE: 'AD482MT',
    CATEGORIA: '7',
    TARIFA: '22.247,33',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-28',
    HORA: '09:57:33',
    ESTACION: 'PB2',
    VIA: '03S',
    DISPOSITIVO: '94579785',
    PATENTE: 'AD482MT',
    CATEGORIA: '7',
    TARIFA: '13.015,92',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-25',
    HORA: '02:27:15',
    ESTACION: 'PB2',
    VIA: '02S',
    DISPOSITIVO: '93415947',
    PATENTE: 'AG893YR',
    CATEGORIA: '9',
    TARIFA: '13.015,92',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-25',
    HORA: '11:28:48',
    ESTACION: 'KDT',
    VIA: '02C',
    DISPOSITIVO: '94959936',
    PATENTE: 'AF103ZL',
    CATEGORIA: '7',
    TARIFA: '7.918,73',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
  {
    FECHA: '2026-07-22',
    HORA: '10:57:09',
    ESTACION: 'PB2',
    VIA: '02S',
    DISPOSITIVO: '97164396',
    PATENTE: 'AH543IQ',
    CATEGORIA: '7',
    TARIFA: '13.015,92',
    TIPO_DE_DOCUMENTO: 'DR',
    DOCUMENTO_LEGAL: '5009A02060191',
    DOCUMENTO_SA: '0413033579',
    CLIENTE__WEB: '0000438233',
    CLIENTE_RED: '908030708488891',
    SUB_CUENTA: '1',
  },
];

/** Suma IMPORTE_NETO (10 filas) del ejemplo = factura mock. */
export const AU_IMPORTE_SIN_IVA = 132940.19;

export const AU_FACTURA: WizardFacturaForm = {
  factura: 'F-AU-0001-00001001',
  cuenta: 'CTA-AU-001',
  empresa_id: 'EMP-AU-DEMO',
  fecha_factura: '2026-07-31',
  importe_sin_iva: AU_IMPORTE_SIN_IVA,
  importe_total: AU_IMPORTE_SIN_IVA,
};

export const AU_MAPEO_SUGERIDO: Record<string, PasadaColumnKey | null> = {
  FECHA: 'FECHA_HORA',
  HORA: null,
  ESTACION: 'ESTACION_ID',
  VIA: null,
  DISPOSITIVO: 'PASE_ID',
  PATENTE: 'PATENTE_ID',
  TARIFA: 'PRECIO',
};

export function buildAuPreview(): ExcelCargaPreview {
  const columnas = [...AU_COLUMNAS];
  const tiposInferidos: Record<string, string> = {
    FECHA: 'fecha',
    HORA: 'texto',
    ESTACION: 'texto',
    VIA: 'texto',
    DISPOSITIVO: 'texto',
    PATENTE: 'texto',
    CATEGORIA: 'número',
    TARIFA: 'texto',
    TIPO_DE_DOCUMENTO: 'texto',
    DOCUMENTO_LEGAL: 'texto',
    DOCUMENTO_SA: 'texto',
    CLIENTE__WEB: 'texto',
    CLIENTE_RED: 'texto',
    SUB_CUENTA: 'texto',
  };

  return {
    nombreArchivo: AU_EJEMPLO_NOMBRE_ARCHIVO,
    tamanioBytes: 18432,
    totalFilas: 167,
    columnas,
    filasPreview: AU_FILAS_ORIGEN.map((f) => ({ ...f })),
    filasOrigen: AU_FILAS_ORIGEN.map((f) => ({ ...f })),
    tiposInferidos,
  };
}

export function buildAuMapeos(): MapeoColumna[] {
  return AU_COLUMNAS.map((columnaOrigen) => {
    const excluida = (AU_COLUMNAS_EXCLUIDAS as readonly string[]).includes(columnaOrigen);
    const destino = AU_MAPEO_SUGERIDO[columnaOrigen] ?? null;
    return {
      columnaOrigen,
      columnaDestino: excluida ? null : destino,
      excluida,
    };
  });
}

/**
 * Parsea TARIFA formato AR (`19.985,09` → 19985.09).
 * Usado en tests de pipeline hasta que CONVERTIR_NUMERO soporte locale AR nativo.
 */
export function parseTarifaArAu(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const s = String(valor).trim();
  if (!s) return null;
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/\s/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Filas AU con TARIFA numérica lista para `aplicarPipeline` / CONVERTIR_NUMERO actual. */
export function auFilasParaMotor(): Record<string, unknown>[] {
  return AU_FILAS_ORIGEN.map((f) => ({
    ...f,
    TARIFA: parseTarifaArAu(f['TARIFA']),
  }));
}

/**
 * Configs atómicas estilo plantilla Autopistas Urbanas
 * (ejemplo-autopistas-urbanas-pasadas.md §6–7).
 */
export function buildAuPlantillaConfigs(): Array<{
  id: string;
  plantilla_id: string;
  nombre_columna: string;
  columna_destino: string | null;
  orden: number;
  tipo: string;
  algoritmo_combinado_id: string | null;
  configuracion: Record<string, unknown>;
  obligatoria: boolean;
}> {
  const pid = 'plt-au-test';
  return [
    {
      id: 'au-10',
      plantilla_id: pid,
      nombre_columna: 'FECHA',
      columna_destino: 'FECHA_HORA',
      orden: 10,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'COMBINAR_COLUMNAS',
        columnas_entrada: ['FECHA', 'HORA'],
        columnas: ['FECHA', 'HORA'],
        separador: ' ',
      },
      obligatoria: true,
    },
    {
      id: 'au-20',
      plantilla_id: pid,
      nombre_columna: 'DISPOSITIVO',
      columna_destino: 'PASE_ID',
      orden: 20,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_TEXTO',
        columnas_entrada: ['DISPOSITIVO'],
        columna: 'DISPOSITIVO',
      },
      obligatoria: true,
    },
    {
      id: 'au-30',
      plantilla_id: pid,
      nombre_columna: 'PATENTE',
      columna_destino: 'PATENTE_ID',
      orden: 30,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'BORRAR_ESPACIOS',
        columnas_entrada: ['PATENTE'],
        columna: 'PATENTE',
      },
      obligatoria: true,
    },
    {
      id: 'au-40',
      plantilla_id: pid,
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      orden: 40,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'ELIMINAR_GUIONES',
        columnas_entrada: ['PATENTE_ID'],
        columna: 'PATENTE_ID',
      },
      obligatoria: true,
    },
    {
      id: 'au-50',
      plantilla_id: pid,
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      orden: 50,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
        columnas_entrada: ['PATENTE_ID'],
        columna: 'PATENTE_ID',
      },
      obligatoria: true,
    },
    {
      id: 'au-60',
      plantilla_id: pid,
      nombre_columna: 'ESTACION',
      columna_destino: 'CODIGO_ESTACION',
      orden: 60,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'COMBINAR_COLUMNAS',
        columnas_entrada: ['ESTACION', 'VIA'],
        columnas: ['ESTACION', 'VIA'],
        separador: '-',
      },
      obligatoria: true,
    },
    {
      id: 'au-70',
      plantilla_id: pid,
      nombre_columna: 'TARIFA',
      columna_destino: 'PRECIO',
      orden: 70,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_NUMERO',
        columnas_entrada: ['TARIFA'],
        columna: 'TARIFA',
      },
      obligatoria: true,
    },
    {
      id: 'au-80',
      plantilla_id: pid,
      nombre_columna: 'PRECIO',
      columna_destino: 'IMPORTE_NETO',
      orden: 80,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'COPIAR_COLUMNA',
        columnas_entrada: ['PRECIO'],
        columna: 'PRECIO',
      },
      obligatoria: true,
    },
    {
      id: 'au-90',
      plantilla_id: pid,
      nombre_columna: 'QUANTITY',
      columna_destino: 'QUANTITY',
      orden: 90,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'ASIGNAR_VALOR',
        valor: 1,
      },
      obligatoria: true,
    },
  ];
}
