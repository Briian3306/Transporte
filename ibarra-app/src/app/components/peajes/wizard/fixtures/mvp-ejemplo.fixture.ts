import { ExcelCargaPreview, MapeoColumna, PasadaColumnKey } from '../../models';
import { WizardFacturaForm } from '../services/peajes-wizard-state.service';

/**
 * Fixture del ejemplo MVP (docs/plan/ejemplo-mvp-procesamiento-pasadas.md).
 * Permite recorrer el wizard sin depender de Supabase ni del xlsx externo.
 */
export const MVP_EJEMPLO_NOMBRE_ARCHIVO = 'pasadas_junio_2026.xlsx';

export const MVP_COLUMNAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'VIA',
  'DISPOSITIVOT',
  'DISPOSITIVON',
  'DOMINIO',
  'CATEGORIA',
  'TARIFA',
  'BONIFICACION',
] as const;

/** Columnas que alimentan la estructura estándar en el ejemplo. */
export const MVP_COLUMNAS_INCLUIDAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'DISPOSITIVON',
  'DOMINIO',
  'TARIFA',
  'BONIFICACION',
] as const;

export const MVP_COLUMNAS_EXCLUIDAS = ['VIA', 'DISPOSITIVOT', 'CATEGORIA'] as const;

/** 10 registros del ejemplo (incluye columnas ignoradas). */
export const MVP_FILAS_ORIGEN: Record<string, unknown>[] = [
  {
    FECHA: '25/06/2026',
    HORA: '205005',
    ESTACION: '3',
    VIA: '10',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '98702170',
    DOMINIO: 'AD625QB',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '25/06/2026',
    HORA: '085557',
    ESTACION: '3',
    VIA: '10',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '99837024',
    DOMINIO: 'AB456CU',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '21/06/2026',
    HORA: '202641',
    ESTACION: '3',
    VIA: '10',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '94911721',
    DOMINIO: 'AE831SI',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '10/07/2026',
    HORA: '135742',
    ESTACION: '3',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '97010413',
    DOMINIO: 'AE469PH',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '01/07/2026',
    HORA: '131115',
    ESTACION: '3',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '94931038',
    DOMINIO: 'AE952TH',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '01/07/2026',
    HORA: '121934',
    ESTACION: '3',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '92093802',
    DOMINIO: 'AD985XP',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '01/07/2026',
    HORA: '120901',
    ESTACION: '3',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '97010413',
    DOMINIO: 'AE469PH',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '5220',
  },
  {
    FECHA: '22/06/2026',
    HORA: '120252',
    ESTACION: '2',
    VIA: '5',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '96073469',
    DOMINIO: 'AB151SM',
    CATEGORIA: '5',
    TARIFA: '6600',
    BONIFICACION: '1980',
  },
  {
    FECHA: '29/06/2026',
    HORA: '104329',
    ESTACION: '1',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '99793212',
    DOMINIO: 'AG507DK',
    CATEGORIA: '5',
    TARIFA: '6600',
    BONIFICACION: '1980',
  },
  {
    FECHA: '29/06/2026',
    HORA: '105159',
    ESTACION: '5',
    VIA: '1',
    DISPOSITIVOT: 'SI90',
    DISPOSITIVON: '94402656',
    DOMINIO: 'AC295IE',
    CATEGORIA: '5',
    TARIFA: '17400',
    BONIFICACION: '9840',
  },
];

export const MVP_FACTURA: WizardFacturaForm = {
  factura: 'F-A-0001-00004567',
  cuenta: 'CTA-001',
  empresa_id: 'EMP-DEMO-001',
  fecha_factura: '2026-07-15',
  importe_sin_iva: 102060,
  importe_total: 123492.6,
};

/** Sugerencia de mapeo origen → destino del ejemplo. */
export const MVP_MAPEO_SUGERIDO: Record<string, PasadaColumnKey | null> = {
  FECHA: 'FECHA_HORA',
  HORA: null,
  ESTACION: 'ESTACION_ID',
  DISPOSITIVON: 'PASE_ID',
  DOMINIO: 'PATENTE_ID',
  TARIFA: 'PRECIO',
  BONIFICACION: 'BONIFICACION',
};

export const MVP_TRANSFORM_SPECS: Array<{
  key: string;
  target: string;
  tag: string;
  description: string;
  steps: string[];
  inputs: string[];
  after: string;
}> = [
  {
    key: 'FECHA_HORA',
    target: 'FECHA_HORA',
    tag: 'Automática',
    description: 'Normaliza fecha y hora del proveedor en un único campo datetime.',
    steps: [
      'Completar HORA con seis caracteres',
      'Tomar FECHA y HORA',
      'Interpretar HORA como HHMMSS',
      'Combinar a YYYY-MM-DD HH:mm:ss',
    ],
    inputs: ['FECHA', 'HORA'],
    after: '2026-06-25 20:50:05',
  },
  {
    key: 'PATENTE_ID',
    target: 'PATENTE_ID',
    tag: 'Automática',
    description: 'Limpia el dominio para usarlo como identificador de patente.',
    steps: [
      'Tomar DOMINIO',
      'Eliminar espacios y guiones',
      'Convertir a mayúsculas',
      'Validar valor no vacío',
    ],
    inputs: ['DOMINIO'],
    after: 'AD625QB',
  },
  {
    key: 'PASE_ID',
    target: 'PASE_ID',
    tag: 'Automática',
    description: 'Conserva el dispositivo como pase reutilizable entre pasadas.',
    steps: [
      'Tomar DISPOSITIVON',
      'Convertir a texto',
      'Eliminar espacios',
      'Conservar identificador',
    ],
    inputs: ['DISPOSITIVON'],
    after: '98702170',
  },
  {
    key: 'IMPORTE_NETO',
    target: 'IMPORTE_NETO',
    tag: 'Automática',
    description: 'Calcula el valor neto de cada pasada.',
    steps: [
      'Tomar TARIFA',
      'Tomar BONIFICACION',
      'Restar BONIFICACION a TARIFA',
      'Validar resultado ≥ 0',
    ],
    inputs: ['TARIFA', 'BONIFICACION'],
    after: '12180',
  },
  {
    key: 'QUANTITY',
    target: 'QUANTITY',
    tag: 'Valor generado',
    description: 'Cada fila representa una pasada individual.',
    steps: ['Generar valor constante', 'Asignar 1', 'Aplicar a cada fila'],
    inputs: ['—'],
    after: '1',
  },
];

export function buildMvpPreview(): ExcelCargaPreview {
  const columnas = [...MVP_COLUMNAS];
  const tiposInferidos: Record<string, string> = {
    FECHA: 'fecha',
    HORA: 'texto',
    ESTACION: 'texto',
    VIA: 'número',
    DISPOSITIVOT: 'texto',
    DISPOSITIVON: 'texto',
    DOMINIO: 'texto',
    CATEGORIA: 'número',
    TARIFA: 'número',
    BONIFICACION: 'número',
  };

  return {
    nombreArchivo: MVP_EJEMPLO_NOMBRE_ARCHIVO,
    tamanioBytes: 24576,
    totalFilas: MVP_FILAS_ORIGEN.length,
    columnas,
    filasPreview: MVP_FILAS_ORIGEN.map((f) => ({ ...f })),
    filasOrigen: MVP_FILAS_ORIGEN.map((f) => ({ ...f })),
    tiposInferidos,
  };
}

export function buildMvpMapeos(): MapeoColumna[] {
  return MVP_COLUMNAS.map((columnaOrigen) => {
    const excluida = (MVP_COLUMNAS_EXCLUIDAS as readonly string[]).includes(columnaOrigen);
    const destino = MVP_MAPEO_SUGERIDO[columnaOrigen] ?? null;
    return {
      columnaOrigen,
      columnaDestino: excluida ? null : destino,
      excluida,
    };
  });
}

/** Combina FECHA + HORA (HHMMSS) → YYYY-MM-DD HH:mm:ss. */
export function combinarFechaHoraMvp(fecha: unknown, hora: unknown): string | null {
  if (fecha === null || fecha === undefined || fecha === '') {
    return null;
  }
  const fechaStr = String(fecha).trim();
  const match = fechaStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) {
    return fechaStr;
  }
  const d = match[1].padStart(2, '0');
  const m = match[2].padStart(2, '0');
  let y = match[3];
  if (y.length === 2) {
    y = `20${y}`;
  }
  const horaNorm = String(hora ?? '0').replace(/\D/g, '').padStart(6, '0').slice(-6);
  const hh = horaNorm.slice(0, 2);
  const mm = horaNorm.slice(2, 4);
  const ss = horaNorm.slice(4, 6);
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function normalizarPatenteMvp(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const out = String(valor).trim().replace(/-/g, '').replace(/\s+/g, '').toUpperCase();
  return out || null;
}

export function normalizarPaseMvp(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const out = String(valor).trim().replace(/\s+/g, '');
  return out || null;
}

export function aplicarTransformPreview(
  key: string,
  fila: Record<string, unknown>
): string {
  switch (key) {
    case 'FECHA_HORA':
      return combinarFechaHoraMvp(fila['FECHA'], fila['HORA']) ?? '—';
    case 'PATENTE_ID':
      return normalizarPatenteMvp(fila['DOMINIO']) ?? '—';
    case 'PASE_ID':
      return normalizarPaseMvp(fila['DISPOSITIVON']) ?? '—';
    case 'IMPORTE_NETO': {
      const precio = Number(fila['TARIFA']);
      const bonif = Number(fila['BONIFICACION']);
      if (!Number.isFinite(precio) || !Number.isFinite(bonif)) {
        return '—';
      }
      return String(precio - bonif);
    }
    case 'QUANTITY':
      return '1';
    default:
      return '—';
  }
}
