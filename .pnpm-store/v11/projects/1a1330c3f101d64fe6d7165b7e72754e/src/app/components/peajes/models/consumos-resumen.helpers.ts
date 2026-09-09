import { Empresa, Peaje } from './peajes.models';

/** Columnas metadata de documento / empresa (no Structure Goal). */
export const COLUMNAS_METADATA_MASIVA = ['FACTURA', 'CONCESION'] as const;

/**
 * Aliases de encabezado ConsumosResumen / Telepase Plus (normalizados).
 * Ver `scripts/telepeaje plus/.../ConsumosResumen.xlsx`.
 */
export const CONSUMOS_RESUMEN_ALIASES = {
  pase: ['TAG NO', 'TAG N', 'TAG Nº', 'TAG N°', 'TAG', 'DISPOSITIVO', 'DISPOSITIVON', 'PASE_ID'],
  patente: ['DOMINIO', 'PATENTE', 'PATENTE_ID'],
  estacion: ['ESTACION', 'ESTACIÓN', 'ESTACION_ID'],
  concesion: ['CONCESION', 'CONCESIÓN'],
  factura: ['FACTURA'],
  precio: ['IMPORTE ORIGINAL', 'TARIFA', 'PRECIO'],
  bonificacion: ['DESCUENTO IMPORTE', 'BONIFICACION', 'BONIFICACION_IMPORTE'],
  fecha: ['FECHA', 'FECHA_HORA'],
  importeFinal: ['IMPORTE FINAL'],
} as const;

/** Normaliza encabezado Excel para comparar aliases (acentos, º, espacios). */
export function normalizarEncabezadoColumna(valor: string): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[º°]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Normaliza nombre de empresa / concesión / peaje para matching. */
export function normalizarTextoCatalogo(valor: string): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/gi, '')
    .toUpperCase();
}

export function buscarColumnaPorAliases(
  columnas: string[],
  aliases: readonly string[]
): string | undefined {
  const lookup = new Map(columnas.map((c) => [normalizarEncabezadoColumna(c), c]));
  for (const alias of aliases) {
    const found = lookup.get(normalizarEncabezadoColumna(alias));
    if (found) return found;
  }
  return undefined;
}

export function esColumnaMetadataMasiva(columna: string): boolean {
  const n = normalizarEncabezadoColumna(columna);
  return (
    n === 'FACTURA' ||
    n === 'CONCESION' ||
    CONSUMOS_RESUMEN_ALIASES.concesion.some((a) => normalizarEncabezadoColumna(a) === n)
  );
}

/** Valor de Concesión más frecuente en un grupo de filas. */
export function concesionDominanteDeFilas(
  filas: Record<string, unknown>[],
  columnaConcesion: string
): string {
  const counts = new Map<string, number>();
  for (const fila of filas) {
    const raw = fila[columnaConcesion];
    const v = raw == null ? '' : String(raw).trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function coincidirPorNombreNormalizado<T extends { nombre: string }>(
  nombre: string,
  items: T[]
): T | null {
  const target = normalizarTextoCatalogo(nombre);
  if (!target) return null;
  const exact = items.find((i) => normalizarTextoCatalogo(i.nombre) === target);
  if (exact) return exact;
  const partial = items.find((i) => {
    const n = normalizarTextoCatalogo(i.nombre);
    return n.includes(target) || target.includes(n);
  });
  return partial ?? null;
}

/**
 * Resuelve empresa desde Concesión: match por nombre de empresa o por nombre de peaje
 * (el peaje aporta `empresa_id`).
 */
export function resolverEmpresaDesdeConcesion(
  concesion: string,
  empresas: Empresa[],
  peajes: Peaje[] = []
): { empresaId: string | null; matchedVia: 'empresa' | 'peaje' | null; matchedName: string | null } {
  if (!concesion.trim()) {
    return { empresaId: null, matchedVia: null, matchedName: null };
  }
  const emp = coincidirPorNombreNormalizado(concesion, empresas);
  if (emp) {
    return { empresaId: emp.id, matchedVia: 'empresa', matchedName: emp.nombre };
  }
  const peaje = coincidirPorNombreNormalizado(concesion, peajes);
  if (peaje?.empresa_id) {
    return { empresaId: peaje.empresa_id, matchedVia: 'peaje', matchedName: peaje.nombre };
  }
  return { empresaId: null, matchedVia: null, matchedName: null };
}

/**
 * RN-26: Concesion del Excel representa el PEAJE.
 * Prioriza match por nombre de peaje; si no, peajes de la empresa cuyo nombre coincide.
 */
export function resolverPeajeDesdeConcesion(
  concesion: string,
  peajes: Peaje[],
  empresaId?: string | null
): Peaje | null {
  const r = reconocerPeajeDesdeConcesion(concesion, peajes, empresaId);
  return r.tipo === 'exacta' ? r.peaje : r.sugerencias[0] ?? null;
}

export type ResultadoReconocimientoPeaje = {
  valorConcesion: string;
  tipo: 'exacta' | 'sugerencias' | 'sin_coincidencia';
  peaje: Peaje | null;
  sugerencias: Peaje[];
};

/**
 * Misma lógica que reconocimiento de estaciones (normalize + exacta / includes / rank).
 * Ver docs/06-components/peajes/reconocimiento-estaciones.md.
 */
export function reconocerPeajeDesdeConcesion(
  concesion: string,
  peajes: Peaje[],
  empresaId?: string | null
): ResultadoReconocimientoPeaje {
  const valor = (concesion ?? '').trim();
  const normalizado = normalizarParaReconocimiento(valor);
  const vacio: ResultadoReconocimientoPeaje = {
    valorConcesion: valor,
    tipo: 'sin_coincidencia',
    peaje: null,
    sugerencias: [],
  };
  if (!normalizado) return vacio;

  const scoped = empresaId
    ? peajes.filter((p) => !p.empresa_id || p.empresa_id === empresaId)
    : peajes;
  const pool = scoped.length ? scoped : peajes;

  const candidatas = pool
    .filter((p) => {
      const nombre = normalizarParaReconocimiento(p.nombre);
      return (
        nombre === normalizado ||
        nombre.includes(normalizado) ||
        normalizado.includes(nombre)
      );
    })
    .sort((a, b) => {
      const aN = normalizarParaReconocimiento(a.nombre);
      const bN = normalizarParaReconocimiento(b.nombre);
      const rank = (n: string) =>
        n === normalizado ? 0 : n.startsWith(normalizado) ? 1 : 2;
      return rank(aN) - rank(bN) || a.nombre.localeCompare(b.nombre);
    });

  if (candidatas.length === 1 && normalizarParaReconocimiento(candidatas[0].nombre) === normalizado) {
    return {
      valorConcesion: valor,
      tipo: 'exacta',
      peaje: candidatas[0],
      sugerencias: [],
    };
  }
  if (candidatas.length) {
    return {
      valorConcesion: valor,
      tipo: 'sugerencias',
      peaje: null,
      sugerencias: candidatas.slice(0, 8),
    };
  }
  return vacio;
}

/** Alineado a `normalizarEstacion` del catálogo (NFD, mayúsculas, espacios). */
export function normalizarParaReconocimiento(valor: string): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Concesión dominante por cada valor de estación (código proveedor). */
export function concesionPorValorEstacion(
  filas: Record<string, unknown>[],
  columnaEstacion: string,
  columnaConcesion: string,
  valorEstacionFn?: (fila: Record<string, unknown>) => string | null
): Map<string, string> {
  const out = new Map<string, string>();
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const fila of filas) {
    const raw =
      valorEstacionFn?.(fila) ??
      (fila[columnaEstacion] == null ? null : String(fila[columnaEstacion]).trim());
    if (!raw) continue;
    const list = groups.get(raw) ?? [];
    list.push(fila);
    groups.set(raw, list);
  }
  for (const [valor, groupFilas] of groups) {
    const c = concesionDominanteDeFilas(groupFilas, columnaConcesion);
    if (c) out.set(valor, c);
  }
  return out;
}

const IVA_FACTOR = 1.21;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ImportesIvaAjuste {
  importe_sin_iva: number;
  percepciones: number;
  iva: number;
  importe_total: number;
}

/** Agrega IVA 21% sobre subtotal (cabecera). No toca pasadas. */
export function agregarIvaDocumento(
  valores: Partial<{ [K in keyof ImportesIvaAjuste]: number | null | undefined }>
): ImportesIvaAjuste {
  const sin = Number(valores.importe_sin_iva ?? 0) || 0;
  const perc = Number(valores.percepciones ?? 0) || 0;
  const iva = round2(sin * 0.21);
  return {
    importe_sin_iva: round2(sin),
    percepciones: round2(perc),
    iva,
    importe_total: round2(sin + iva + perc),
  };
}

/**
 * Quita IVA de cabecera: trata `importe_sin_iva` (o total) como con IVA e
 * invierte /1,21. Deja iva en 0.
 */
export function quitarIvaDocumento(
  valores: Partial<{ [K in keyof ImportesIvaAjuste]: number | null | undefined }>
): ImportesIvaAjuste {
  const base =
    valores.importe_sin_iva != null && Number.isFinite(Number(valores.importe_sin_iva))
      ? Number(valores.importe_sin_iva)
      : Number(valores.importe_total ?? 0);
  const perc = Number(valores.percepciones ?? 0) || 0;
  const sin = round2(base / IVA_FACTOR);
  return {
    importe_sin_iva: sin,
    percepciones: round2(perc),
    iva: 0,
    importe_total: round2(sin + perc),
  };
}

/** Aplica /1,21 a un importe de pasada (misma regla que ELIMINAR_IVA del motor). */
export function quitarIvaImporte(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return null;
  return round2(n / IVA_FACTOR);
}

/** Aplica ×1,21 a un importe de pasada (agregar IVA). */
export function agregarIvaImporte(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return null;
  return round2(n * IVA_FACTOR);
}
