/**
 * Reconocimiento semántico de columnas de peaje (F02-11).
 * Independiente de la concesionaria: mismos aliases → mismas recetas de pipeline.
 */
import { ExcelCargaPreview, MapeoColumna, PasadaColumnKey } from '../../models';
import { ConfiguracionPlantillaDraft } from './wizard-draft.types';

export type ColumnRecommendationKind =
  | 'fecha_hora'
  | 'patente'
  | 'tarifa'
  | 'bonificacion'
  | 'eliminar_iva'
  | 'dispositivo';

export type ColumnRecommendationStatus = 'pending' | 'accepted' | 'dismissed';

export interface ColumnRecommendation {
  id: string;
  kind: ColumnRecommendationKind;
  title: string;
  detail: string;
  status: ColumnRecommendationStatus;
  columnasEntrada: string[];
  draftSteps: ConfiguracionPlantillaDraft[];
  /** Columnas a forzar como incluidas al aceptar. */
  incluirColumnas: string[];
  /** Sugerencias de mapeo (origen → destino estándar). */
  mapeoHints: MapeoColumna[];
}

export const COLUMN_ALIASES = {
  plate: ['PATENTE', 'DOMINIO', 'PATENTE_ID'],
  fare: ['TARIFA', 'PRECIO'],
  discount: ['BONIFICACION', 'BONIFICACION_IMPORTE'],
  date: ['FECHA'],
  time: ['HORA'],
  device: ['DISPOSITIVO', 'DISPOSITIVON'],
} as const;

function nuevoClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function draftBase(
  partial: Omit<ConfiguracionPlantillaDraft, 'clientId'> & { clientId?: string }
): ConfiguracionPlantillaDraft {
  return {
    clientId: partial.clientId ?? nuevoClientId(),
    orden: partial.orden,
    tipo: partial.tipo,
    nombre_columna: partial.nombre_columna,
    columna_destino: partial.columna_destino ?? null,
    algoritmo_combinado_id: partial.algoritmo_combinado_id ?? null,
    configuracion: partial.configuracion,
    obligatoria: partial.obligatoria,
  };
}

/** Mapa upper → nombre original del archivo. */
export function buildColumnLookup(columnas: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of columnas) {
    map.set(col.trim().toUpperCase(), col);
  }
  return map;
}

export function resolveAlias(
  lookup: Map<string, string>,
  aliases: readonly string[]
): string | undefined {
  for (const alias of aliases) {
    const found = lookup.get(alias);
    if (found) return found;
  }
  return undefined;
}

function sampleValues(
  preview: ExcelCargaPreview | null | undefined,
  columna: string,
  max = 8
): string[] {
  const filas = preview?.filasPreview ?? [];
  const out: string[] = [];
  for (const fila of filas) {
    const v = fila[columna];
    if (v == null || v === '') continue;
    out.push(String(v).trim());
    if (out.length >= max) break;
  }
  return out;
}

/** HHMMSS compacto (Demo) vs HH:MM:SS / ISO-ish (AUSOL / AU). */
export function detectaFormatoHora(samples: string[]): 'HHMMSS' | 'COMBINAR' {
  if (samples.length === 0) return 'HHMMSS';
  const compact = samples.filter((s) => /^\d{5,6}$/.test(s.replace(/\D/g, '')) && !s.includes(':'));
  const withColon = samples.filter((s) => /\d{1,2}:\d{2}/.test(s));
  if (withColon.length >= compact.length && withColon.length > 0) {
    return 'COMBINAR';
  }
  return 'HHMMSS';
}

/** Detecta número estilo AR (miles `.` + decimal `,`) en muestras. */
export function detectaNumeroAr(samples: string[]): boolean {
  return samples.some((s) => /^\d{1,3}(\.\d{3})+,\d+$/.test(s.replace(/\s/g, '')));
}

export function recipeFechaHora(
  fechaCol: string,
  horaCol: string,
  formato: 'HHMMSS' | 'COMBINAR',
  ordenStart = 10
): ConfiguracionPlantillaDraft[] {
  if (formato === 'HHMMSS') {
    return [
      draftBase({
        orden: ordenStart,
        tipo: 'transformacion',
        nombre_columna: fechaCol,
        columna_destino: 'FECHA_HORA',
        configuracion: {
          algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
          columnas_entrada: [fechaCol, horaCol],
          parametros: { columnas: [fechaCol, horaCol], formato_hora: 'HHMMSS' },
          habilitado: true,
        },
        obligatoria: true,
      }),
    ];
  }
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: fechaCol,
      columna_destino: 'FECHA_HORA',
      configuracion: {
        algoritmo_codigo: 'COMBINAR_COLUMNAS',
        columnas_entrada: [fechaCol, horaCol],
        parametros: { columnas: [fechaCol, horaCol], separador: ' ' },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

export function recipePatente(sourceCol: string, ordenStart = 30): ConfiguracionPlantillaDraft[] {
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: sourceCol,
      columna_destino: 'PATENTE_ID',
      configuracion: {
        algoritmo_codigo: 'BORRAR_ESPACIOS',
        columnas_entrada: [sourceCol],
        parametros: { columna: sourceCol },
        habilitado: true,
      },
      obligatoria: true,
    }),
    draftBase({
      orden: ordenStart + 10,
      tipo: 'transformacion',
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      configuracion: {
        algoritmo_codigo: 'ELIMINAR_GUIONES',
        columnas_entrada: ['PATENTE_ID'],
        parametros: { columna: 'PATENTE_ID' },
        habilitado: true,
      },
      obligatoria: true,
    }),
    draftBase({
      orden: ordenStart + 20,
      tipo: 'transformacion',
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
        columnas_entrada: ['PATENTE_ID'],
        parametros: { columna: 'PATENTE_ID' },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

export function recipeDispositivo(deviceCol: string, ordenStart = 20): ConfiguracionPlantillaDraft[] {
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: deviceCol,
      columna_destino: 'PASE_ID',
      configuracion: {
        algoritmo_codigo: 'COPIAR_COLUMNA',
        columnas_entrada: [deviceCol],
        parametros: { columna: deviceCol },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

export function recipeTarifa(fareCol: string, arStyle: boolean, ordenStart = 80): ConfiguracionPlantillaDraft[] {
  const codigo = arStyle ? 'CONVERTIR_NUMERO_ARS' : 'CONVERTIR_NUMERO';
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: fareCol,
      columna_destino: 'PRECIO',
      configuracion: {
        algoritmo_codigo: codigo,
        columnas_entrada: [fareCol],
        parametros: { columna: fareCol },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

export function recipeBonificacion(
  discountCol: string,
  fareCol: string | undefined,
  arStyle: boolean,
  ordenStart = 90
): ConfiguracionPlantillaDraft[] {
  const steps: ConfiguracionPlantillaDraft[] = [];
  let orden = ordenStart;
  const codigo = arStyle ? 'CONVERTIR_NUMERO_ARS' : 'CONVERTIR_NUMERO';
  const destinoBonif = discountCol.toUpperCase().includes('BONIFICACION')
    ? 'BONIFICACION'
    : discountCol;

  steps.push(
    draftBase({
      orden,
      tipo: 'transformacion',
      nombre_columna: discountCol,
      columna_destino: destinoBonif,
      configuracion: {
        algoritmo_codigo: codigo,
        columnas_entrada: [discountCol],
        parametros: { columna: discountCol },
        habilitado: true,
      },
      obligatoria: true,
    })
  );
  orden += 10;

  if (fareCol) {
    const precioCol = arStyle ? 'PRECIO' : fareCol;
    const bonifCol = arStyle ? 'BONIFICACION' : discountCol;
    steps.push(
      draftBase({
        orden,
        tipo: 'transformacion',
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          columnas_entrada: [precioCol, bonifCol],
          parametros: {
            precio_columna: precioCol,
            bonificacion_columna: bonifCol,
          },
          habilitado: true,
        },
        obligatoria: true,
      })
    );
  }
  return steps;
}

export function recipeEliminarIva(orden = 100): ConfiguracionPlantillaDraft[] {
  return [
    draftBase({
      orden,
      tipo: 'transformacion',
      nombre_columna: 'IMPORTE_NETO',
      columna_destino: 'IMPORTE_NETO',
      configuracion: {
        algoritmo_codigo: 'ELIMINAR_IVA',
        columnas_entrada: ['IMPORTE_NETO'],
        parametros: { columna: 'IMPORTE_NETO' },
        habilitado: true,
      },
      obligatoria: false,
    }),
  ];
}

export function recipeQuantity(ordenStart = 60): ConfiguracionPlantillaDraft[] {
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: 'QUANTITY',
      columna_destino: 'QUANTITY',
      configuracion: {
        algoritmo_codigo: 'ASIGNAR_VALOR',
        parametros: { valor: 1 },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

/** Proveedores sin columna de descuento (Autopistas / Telepase): BONIFICACION = 0. */
export function recipeBonificacionCero(ordenStart = 70): ConfiguracionPlantillaDraft[] {
  return [
    draftBase({
      orden: ordenStart,
      tipo: 'transformacion',
      nombre_columna: 'BONIFICACION',
      columna_destino: 'BONIFICACION',
      configuracion: {
        algoritmo_codigo: 'ASIGNAR_VALOR',
        parametros: { valor: 0 },
        habilitado: true,
      },
      obligatoria: true,
    }),
  ];
}

function hint(origen: string, destino: PasadaColumnKey | null): MapeoColumna {
  return { columnaOrigen: origen, columnaDestino: destino, excluida: false };
}

/**
 * Detecta recomendaciones pendientes a partir del preview.
 * No muta estado; el caller decide aceptar/descartar.
 */
export function detectColumnRecommendations(
  preview: ExcelCargaPreview | null | undefined
): ColumnRecommendation[] {
  if (!preview?.columnas?.length) return [];

  const lookup = buildColumnLookup(preview.columnas);
  const recs: ColumnRecommendation[] = [];

  const fechaCol = resolveAlias(lookup, COLUMN_ALIASES.date);
  const horaCol = resolveAlias(lookup, COLUMN_ALIASES.time);
  const plateCol = resolveAlias(lookup, COLUMN_ALIASES.plate);
  const fareCol = resolveAlias(lookup, COLUMN_ALIASES.fare);
  const discountCol = resolveAlias(lookup, COLUMN_ALIASES.discount);
  const deviceCol = resolveAlias(lookup, COLUMN_ALIASES.device);

  if (fechaCol && horaCol) {
    const formato = detectaFormatoHora(sampleValues(preview, horaCol));
    const algoLabel =
      formato === 'HHMMSS' ? 'FORMATEAR_FECHA_HORA' : 'COMBINAR_COLUMNAS';
    recs.push({
      id: 'rec-fecha_hora',
      kind: 'fecha_hora',
      title: 'Recomendado: FECHA + HORA → FECHA_HORA',
      detail: `Aplicar ${algoLabel} sobre ${fechaCol} y ${horaCol}.`,
      status: 'pending',
      columnasEntrada: [fechaCol, horaCol],
      draftSteps: recipeFechaHora(fechaCol, horaCol, formato, 10),
      incluirColumnas: [fechaCol, horaCol],
      mapeoHints: [hint('FECHA_HORA', 'FECHA_HORA')],
    });
  }

  if (plateCol) {
    recs.push({
      id: 'rec-patente',
      kind: 'patente',
      title: `Recomendado: Normalizar patente en ${plateCol}`,
      detail: 'BORRAR_ESPACIOS → ELIMINAR_GUIONES → CONVERTIR_MAYUSCULAS → PATENTE_ID.',
      status: 'pending',
      columnasEntrada: [plateCol],
      draftSteps: recipePatente(plateCol, 30),
      incluirColumnas: [plateCol],
      mapeoHints: [hint(plateCol, 'PATENTE_ID')],
    });
  }

  if (deviceCol) {
    recs.push({
      id: 'rec-dispositivo',
      kind: 'dispositivo',
      title: `Recomendado: Copiar ${deviceCol} → PASE_ID`,
      detail: 'COPIAR_COLUMNA al identificador de pase estándar.',
      status: 'pending',
      columnasEntrada: [deviceCol],
      draftSteps: recipeDispositivo(deviceCol, 20),
      incluirColumnas: [deviceCol],
      mapeoHints: [hint(deviceCol, 'PASE_ID')],
    });
  }

  if (fareCol) {
    const ar = detectaNumeroAr(sampleValues(preview, fareCol));
    recs.push({
      id: 'rec-tarifa',
      kind: 'tarifa',
      title: `Recomendado: Convertir ${fareCol} a PRECIO`,
      detail: ar
        ? 'CONVERTIR_NUMERO_ARS → PRECIO (formato 19.985,09).'
        : 'CONVERTIR_NUMERO → PRECIO (decimal con punto).',
      status: 'pending',
      columnasEntrada: [fareCol],
      draftSteps: recipeTarifa(fareCol, ar, 80),
      incluirColumnas: [fareCol],
      mapeoHints: [hint(fareCol, 'PRECIO')],
    });
  }

  if (discountCol) {
    const ar = detectaNumeroAr(sampleValues(preview, discountCol));
    const withNeto = !!fareCol;
    recs.push({
      id: 'rec-bonificacion',
      kind: 'bonificacion',
      title: withNeto
        ? `Recomendado: Transformar ${discountCol} y calcular IMPORTE_NETO`
        : `Recomendado: Transformar ${discountCol}`,
      detail: withNeto
        ? ar
          ? 'CONVERTIR_NUMERO_ARS + CALCULAR_IMPORTE_NETO (PRECIO − BONIFICACION).'
          : 'CONVERTIR_NUMERO + CALCULAR_IMPORTE_NETO (tarifa − bonificación).'
        : ar
          ? 'CONVERTIR_NUMERO_ARS sobre la columna de bonificación.'
          : 'CONVERTIR_NUMERO sobre la columna de bonificación.',
      status: 'pending',
      columnasEntrada: withNeto ? [discountCol, fareCol!] : [discountCol],
      draftSteps: recipeBonificacion(discountCol, fareCol, ar, 90),
      incluirColumnas: withNeto ? [discountCol, fareCol!] : [discountCol],
      mapeoHints: [
        hint(discountCol, 'BONIFICACION'),
        ...(withNeto ? [hint('IMPORTE_NETO', 'IMPORTE_NETO')] : []),
      ],
    });
  }

  if (fareCol && discountCol) {
    recs.push({
      id: 'rec-eliminar-iva',
      kind: 'eliminar_iva',
      title: 'Opcional: Eliminar IVA de IMPORTE_NETO',
      detail: 'Divide IMPORTE_NETO por 1,21 y redondea cada pasada a dos decimales.',
      status: 'pending',
      columnasEntrada: ['IMPORTE_NETO'],
      draftSteps: recipeEliminarIva(100),
      incluirColumnas: [fareCol, discountCol],
      mapeoHints: [hint('IMPORTE_NETO', 'IMPORTE_NETO')],
    });
  }

  return recs;
}

/**
 * Pipeline Demo §21 completo a partir de headers resueltos (misma fuente que recomendaciones).
 * Usado por seedDemoPipelineIfEmpty.
 */
export function buildDemoPipelineSeeds(preview: ExcelCargaPreview): ConfiguracionPlantillaDraft[] {
  const lookup = buildColumnLookup(preview.columnas);
  const fechaCol = resolveAlias(lookup, COLUMN_ALIASES.date);
  const horaCol = resolveAlias(lookup, COLUMN_ALIASES.time);
  const plateCol = resolveAlias(lookup, COLUMN_ALIASES.plate);
  const fareCol = resolveAlias(lookup, COLUMN_ALIASES.fare);
  const discountCol = resolveAlias(lookup, COLUMN_ALIASES.discount);
  const deviceCol = resolveAlias(lookup, COLUMN_ALIASES.device);

  if (!fechaCol || !horaCol || !plateCol || !deviceCol || !fareCol || !discountCol) {
    return [];
  }

  const formato = detectaFormatoHora(sampleValues(preview, horaCol));
  return [
    ...recipeFechaHora(fechaCol, horaCol, formato, 10),
    ...recipeDispositivo(deviceCol, 20),
    ...recipePatente(plateCol, 30),
    ...recipeQuantity(60),
    ...recipeBonificacion(discountCol, fareCol, false, 70).filter(
      (s) => s.configuracion?.algoritmo_codigo === 'CALCULAR_IMPORTE_NETO'
    ),
  ];
}

/** Headers mínimos Demo para seed automático en Paso 3. */
export const MVP_SEED_ALIASES = {
  date: COLUMN_ALIASES.date,
  time: COLUMN_ALIASES.time,
  plate: COLUMN_ALIASES.plate,
  device: COLUMN_ALIASES.device,
  fare: COLUMN_ALIASES.fare,
  discount: COLUMN_ALIASES.discount,
} as const;

export function tieneHeadersParaSeedDemo(columnas: string[]): boolean {
  const lookup = buildColumnLookup(columnas);
  return (
    !!resolveAlias(lookup, COLUMN_ALIASES.date) &&
    !!resolveAlias(lookup, COLUMN_ALIASES.time) &&
    !!resolveAlias(lookup, COLUMN_ALIASES.plate) &&
    !!resolveAlias(lookup, COLUMN_ALIASES.device) &&
    !!resolveAlias(lookup, COLUMN_ALIASES.fare) &&
    !!resolveAlias(lookup, COLUMN_ALIASES.discount)
  );
}
