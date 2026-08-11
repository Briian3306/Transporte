import { DocumentoTipo } from './peajes.types';

/** Columna Excel obligatoria para importación masiva. */
export const COLUMNA_FACTURA_MASIVA = 'FACTURA';

export interface ImportesDocumentoNormalizados {
  importe_sin_iva: number;
  bonificacion: number;
  percepciones: number;
  iva: number;
  importe_total: number;
}

export interface ImportesPasadaNormalizados {
  precio: number;
  bonificacion: number;
  importe_neto: number;
}

export interface GrupoFacturaFilas<T extends Record<string, unknown> = Record<string, unknown>> {
  numeroFactura: string;
  filas: T[];
  /** Índices 0-based en el arreglo original. */
  rowIndexes: number[];
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza importes de cabecera según tipo (FC positivo, NC negativo). */
export function normalizarImportesDocumento(
  tipo: DocumentoTipo,
  valores: Partial<ImportesDocumentoNormalizados>
): ImportesDocumentoNormalizados {
  const sign = tipo === 'NC' ? -1 : 1;
  const bonifAbs = Math.abs(toFiniteNumber(valores.bonificacion));
  return {
    importe_sin_iva: sign * Math.abs(toFiniteNumber(valores.importe_sin_iva)),
    bonificacion: bonifAbs === 0 ? 0 : sign * bonifAbs,
    percepciones: sign * Math.abs(toFiniteNumber(valores.percepciones)),
    iva: sign * Math.abs(toFiniteNumber(valores.iva)),
    importe_total: sign * Math.abs(toFiniteNumber(valores.importe_total)),
  };
}

/** Normaliza PRECIO / BONIFICACION / IMPORTE_NETO según tipo de documento. */
export function normalizarImportesPasada(
  tipo: DocumentoTipo,
  valores: Partial<ImportesPasadaNormalizados>
): ImportesPasadaNormalizados {
  const precioAbs = Math.abs(toFiniteNumber(valores.precio));
  const bonifAbs = Math.abs(toFiniteNumber(valores.bonificacion));
  const netoRaw =
    valores.importe_neto != null && valores.importe_neto !== undefined
      ? Math.abs(toFiniteNumber(valores.importe_neto))
      : Math.abs(precioAbs - bonifAbs);

  if (tipo === 'NC') {
    return {
      precio: -precioAbs,
      bonificacion: bonifAbs === 0 ? 0 : -bonifAbs,
      importe_neto: -netoRaw,
    };
  }
  return {
    precio: precioAbs,
    bonificacion: bonifAbs,
    importe_neto: netoRaw,
  };
}

/**
 * Agrupa filas de Excel por valor de columna FACTURA.
 * Filas con FACTURA vacía se omiten del resultado (el caller puede validarlas).
 */
export function agruparFilasPorFactura<T extends Record<string, unknown>>(
  filas: T[],
  columna: string = COLUMNA_FACTURA_MASIVA
): GrupoFacturaFilas<T>[] {
  const order: string[] = [];
  const map = new Map<string, GrupoFacturaFilas<T>>();

  filas.forEach((fila, index) => {
    const raw = fila[columna];
    const numero = raw == null ? '' : String(raw).trim();
    if (!numero) {
      return;
    }
    let grupo = map.get(numero);
    if (!grupo) {
      grupo = { numeroFactura: numero, filas: [], rowIndexes: [] };
      map.set(numero, grupo);
      order.push(numero);
    }
    grupo.filas.push(fila);
    grupo.rowIndexes.push(index);
  });

  return order.map((n) => map.get(n)!);
}

export function excelTieneColumnaFactura(columnas: string[]): boolean {
  return columnas.some((c) => c === COLUMNA_FACTURA_MASIVA);
}
