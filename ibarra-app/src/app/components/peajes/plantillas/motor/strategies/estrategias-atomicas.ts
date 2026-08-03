import { resolverColumnasEntrada } from '../algorithm-descriptor';
import { StrategyContext, TransformStrategy } from '../strategy.types';

/** Formatos de entrada admitidos para FORMATEAR_FECHA_HORA (UI select). */
export const FORMATOS_FECHA_HORA = [
  'HHMMSS',
  'HH:MM:SS',
  'YYYY-MM-DD HH:MM:SS',
  'MM/DD/YY HHMMSS',
  'DD/MM/YY HHMMSS',
  'DD/MM/YYYY HH:MM:SS',
] as const;

export type FormatoFechaHora = (typeof FORMATOS_FECHA_HORA)[number];

function asString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return String(value);
}

export const borrarEspaciosStrategy: TransformStrategy = {
  codigo: 'BORRAR_ESPACIOS',
  nombre: 'Borrar espacios',
  descripcion: 'Elimina espacios al inicio y al final del valor.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen = ctx.columnaOrigen ?? ctx.columnaDestino;
    const raw =
      origen && origen in ctx.resultado
        ? ctx.resultado[origen]
        : origen
          ? ctx.fila[origen]
          : ctx.parametros?.['valor'];
    return asString(raw).trim();
  },
};

export const eliminarGuionesStrategy: TransformStrategy = {
  codigo: 'ELIMINAR_GUIONES',
  nombre: 'Eliminar guiones',
  descripcion: 'Quita guiones del valor.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen = ctx.columnaOrigen ?? ctx.columnaDestino;
    const raw =
      origen && origen in ctx.resultado
        ? ctx.resultado[origen]
        : origen
          ? ctx.fila[origen]
          : '';
    return asString(raw).replace(/-/g, '');
  },
};

export const convertirMayusculasStrategy: TransformStrategy = {
  codigo: 'CONVERTIR_MAYUSCULAS',
  nombre: 'Convertir a mayúsculas',
  descripcion: 'Convierte el texto a mayúsculas.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen = ctx.columnaOrigen ?? ctx.columnaDestino;
    const raw =
      origen && origen in ctx.resultado
        ? ctx.resultado[origen]
        : origen
          ? ctx.fila[origen]
          : '';
    return asString(raw).toUpperCase();
  },
};

interface ReglaReemplazoTexto {
  buscar: string;
  reemplazar: string;
  /** `exacto` evita sustituir abreviaturas dentro de nombres no relacionados. */
  modo?: 'exacto' | 'contiene';
}

function reglasReemplazo(value: unknown): ReglaReemplazoTexto[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (regla): regla is ReglaReemplazoTexto =>
      !!regla &&
      typeof regla === 'object' &&
      typeof (regla as Record<string, unknown>)['buscar'] === 'string' &&
      typeof (regla as Record<string, unknown>)['reemplazar'] === 'string'
  );
}

/**
 * Normaliza aliases de proveedor mediante reglas declarativas y ordenadas.
 * No evalúa expresiones ni JSON como código. Por seguridad una regla es exacta
 * salvo que se configure explícitamente `modo: 'contiene'`.
 */
export const reemplazarTextoStrategy: TransformStrategy = {
  codigo: 'REEMPLAZAR_TEXTO',
  nombre: 'Reemplazar texto',
  descripcion: 'Aplica aliases o abreviaturas mediante reglas ordenadas.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen =
      (ctx.parametros?.['columna'] as string | undefined) ??
      ctx.columnaOrigen ??
      ctx.columnaDestino ??
      '';
    let value = asString(origen in ctx.resultado ? ctx.resultado[origen] : ctx.fila[origen]);

    for (const regla of reglasReemplazo(ctx.parametros?.['reglas'])) {
      const buscar = regla.buscar;
      if (!buscar) continue;
      if (regla.modo === 'contiene') {
        value = value.replaceAll(buscar, regla.reemplazar);
      } else if (value.trim().toLocaleUpperCase() === buscar.trim().toLocaleUpperCase()) {
        value = regla.reemplazar;
      }
    }
    return value;
  },
};

export const convertirTextoStrategy: TransformStrategy = {
  codigo: 'CONVERTIR_TEXTO',
  nombre: 'Convertir a texto',
  descripcion: 'Convierte el valor a string y elimina espacios.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen =
      (ctx.parametros?.['columna'] as string | undefined) ??
      ctx.columnaOrigen ??
      '';
    const raw = origen in ctx.resultado ? ctx.resultado[origen] : ctx.fila[origen];
    return asString(raw).trim();
  },
};

export const convertirNumeroStrategy: TransformStrategy = {
  codigo: 'CONVERTIR_NUMERO',
  nombre: 'Convertir a número',
  descripcion: 'Convierte el valor a número decimal.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen =
      (ctx.parametros?.['columna'] as string | undefined) ??
      ctx.columnaOrigen ??
      '';
    const raw = origen in ctx.resultado ? ctx.resultado[origen] : ctx.fila[origen];
    if (raw == null || raw === '') return null;
    const normalized = asString(raw).replace(',', '.').replace(/\s/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  },
};

export const asignarValorStrategy: TransformStrategy = {
  codigo: 'ASIGNAR_VALOR',
  nombre: 'Asignar valor constante',
  descripcion: 'Asigna un valor fijo (p. ej. QUANTITY = 1).',
  ejecutar(ctx: StrategyContext): unknown {
    return ctx.parametros?.['valor'] ?? null;
  },
};

export const copiarColumnaStrategy: TransformStrategy = {
  codigo: 'COPIAR_COLUMNA',
  nombre: 'Copiar columna',
  descripcion: 'Copia el valor de una columna de origen al destino.',
  ejecutar(ctx: StrategyContext): unknown {
    const origen =
      (ctx.parametros?.['columna'] as string | undefined) ??
      ctx.columnaOrigen ??
      '';
    if (origen in ctx.resultado) return ctx.resultado[origen];
    return ctx.fila[origen] ?? null;
  },
};

/**
 * Combina FECHA + HORA → FECHA_HORA (PRD §21 / RN-06).
 * Parámetros: columnas/columnas_entrada: [fecha, hora], formato_hora (select).
 */
export const formatearFechaHoraStrategy: TransformStrategy = {
  codigo: 'FORMATEAR_FECHA_HORA',
  nombre: 'Formatear fecha y hora',
  descripcion: 'Combina columnas de fecha y hora en FECHA_HORA ISO-like.',
  ejecutar(ctx: StrategyContext): unknown {
    const columnas = resolverColumnasEntrada(ctx.parametros);
    const colFecha = columnas[0] ?? 'FECHA';
    const colHora = columnas[1] ?? 'HORA';
    const fechaVal = ctx.fila[colFecha] ?? ctx.resultado[colFecha];
    const horaVal = ctx.fila[colHora] ?? ctx.resultado[colHora];

    // Si FECHA ya es Date con hora, usarla como ancla
    const fechaRaw = normalizarFechaEntrada(fechaVal);
    const horaRaw = normalizarHoraEntrada(horaVal, fechaVal);
    const formato = String(ctx.parametros?.['formato_hora'] ?? 'HHMMSS').trim();

    if (!fechaRaw && !horaRaw) return null;

    const parsed = parseFechaHoraSegunFormato(fechaRaw, horaRaw, formato);
    return parsed;
  },
};

/** Alias semántico del PRD: COMBINAR_COLUMNAS con columnas fecha/hora. */
export const combinarColumnasStrategy: TransformStrategy = {
  codigo: 'COMBINAR_COLUMNAS',
  nombre: 'Combinar columnas',
  descripcion: 'Concatena columnas; si formato_hora=HHMMSS delega a fecha/hora.',
  ejecutar(ctx: StrategyContext): unknown {
    if (ctx.parametros?.['formato_hora'] === 'HHMMSS') {
      return formatearFechaHoraStrategy.ejecutar(ctx);
    }
    const columnas = resolverColumnasEntrada(ctx.parametros);
    const sep = (ctx.parametros?.['separador'] as string | undefined) ?? ' ';
    return columnas
      .map((c) => asString(ctx.fila[c] ?? ctx.resultado[c]).trim())
      .filter(Boolean)
      .join(sep);
  },
};

/**
 * IMPORTE_NETO = PRECIO - BONIFICACION (RN-10).
 * Parámetros opcionales: precio_columna, bonificacion_columna.
 */
export const calcularImporteNetoStrategy: TransformStrategy = {
  codigo: 'CALCULAR_IMPORTE_NETO',
  nombre: 'Calcular importe neto',
  descripcion: 'Calcula PRECIO - BONIFICACION.',
  ejecutar(ctx: StrategyContext): unknown {
    const colsEntrada = resolverColumnasEntrada(ctx.parametros);
    const colPrecio =
      colsEntrada[0] ??
      (ctx.parametros?.['precio_columna'] as string) ??
      'PRECIO';
    const colBonif =
      colsEntrada[1] ??
      (ctx.parametros?.['bonificacion_columna'] as string) ??
      'BONIFICACION';

    const precio = toNumber(
      ctx.resultado[colPrecio] ??
        ctx.fila[colPrecio] ??
        ctx.fila['TARIFA']
    );
    const bonif = toNumber(
      ctx.resultado[colBonif] ?? ctx.fila[colBonif] ?? ctx.fila['BONIFICACION']
    );
    if (precio == null || bonif == null) return null;
    return precio - bonif;
  },
};

function normalizarFechaEntrada(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return asString(value);
  }
  // Excel serial number (days since 1899-12-30)
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) {
      return asString(d);
    }
  }
  return asString(value).trim();
}

function normalizarHoraEntrada(horaVal: unknown, fechaVal: unknown): string {
  if (horaVal != null && horaVal !== '') {
    if (typeof horaVal === 'number' && Number.isFinite(horaVal) && horaVal >= 0 && horaVal < 1) {
      // Excel fraction-of-day
      const totalSec = Math.round(horaVal * 86400);
      const hh = Math.floor(totalSec / 3600);
      const mm = Math.floor((totalSec % 3600) / 60);
      const ss = totalSec % 60;
      return `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`;
    }
    return asString(horaVal).trim();
  }
  // Si FECHA es Date, extraer hora
  if (fechaVal instanceof Date && !Number.isNaN(fechaVal.getTime())) {
    const hh = String(fechaVal.getHours()).padStart(2, '0');
    const mm = String(fechaVal.getMinutes()).padStart(2, '0');
    const ss = String(fechaVal.getSeconds()).padStart(2, '0');
    return `${hh}${mm}${ss}`;
  }
  return '';
}

function parseFechaDdMmYyyy(fecha: string, formato?: string): string | null {
  const t = fecha.trim();
  // El ejemplo Demo usa mes/día/año corto. Debe ser explícito para no
  // interpretar 6/25/26 como día 6, mes 25.
  if (formato?.startsWith('MM/DD/YY')) {
    const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+.*)?$/);
    if (!mdy) return null;
    const mm = mdy[1].padStart(2, '0');
    const dd = mdy[2].padStart(2, '0');
    const yy = Number(mdy[3]);
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${mm}-${dd}`;
  }
  // dd/mm/yyyy o dd-mm-yyyy
  let m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+.*)?$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // dd/mm/yy
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?:\s+.*)?$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yy = Number(m[3]);
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${mm}-${dd}`;
  }
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  // Locale Date string fallback: try Date parse
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(t)) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function parseHoraToHms(
  horaRaw: string,
  formato: string
): { hh: string; mm: string; ss: string } | null {
  const t = horaRaw.trim();
  if (!t) {
    return { hh: '00', mm: '00', ss: '00' };
  }

  // Explicit HH:MM:SS or H:MM:SS
  const colon = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon || formato.includes('HH:MM:SS') || formato.includes('HH:MM')) {
    if (colon) {
      return {
        hh: colon[1].padStart(2, '0'),
        mm: colon[2].padStart(2, '0'),
        ss: (colon[3] ?? '00').padStart(2, '0'),
      };
    }
  }

  // Digits HHMMSS / HMMSS
  const digits = t.replace(/\D/g, '');
  if (digits.length > 0) {
    const padded = digits.padStart(6, '0').slice(-6);
    return {
      hh: padded.slice(0, 2),
      mm: padded.slice(2, 4),
      ss: padded.slice(4, 6),
    };
  }

  return null;
}

function parseFechaHoraSegunFormato(
  fechaRaw: string,
  horaRaw: string,
  formato: string
): string | null {
  // Combined patterns where date+time might be in FECHA alone
  if (
    (formato === 'DD/MM/YY HHMMSS' || formato === 'DD/MM/YYYY HH:MM:SS') &&
    !horaRaw &&
    /\s/.test(fechaRaw)
  ) {
    const parts = fechaRaw.trim().split(/\s+/);
    const fechaPart = parts[0] ?? '';
    const horaPart = parts.slice(1).join(' ');
    const fechaIso = parseFechaDdMmYyyy(fechaPart, formato);
    const hms = parseHoraToHms(horaPart, formato);
    if (!fechaIso || !hms) return null;
    return `${fechaIso} ${hms.hh}:${hms.mm}:${hms.ss}`;
  }

  const fechaIso = parseFechaDdMmYyyy(fechaRaw, formato);
  if (!fechaIso) return null;
  const hms = parseHoraToHms(horaRaw, formato);
  if (!hms) return null;
  return `${fechaIso} ${hms.hh}:${hms.mm}:${hms.ss}`;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(asString(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const ESTRATEGIAS_ATOMICAS: TransformStrategy[] = [
  borrarEspaciosStrategy,
  eliminarGuionesStrategy,
  convertirMayusculasStrategy,
  reemplazarTextoStrategy,
  convertirTextoStrategy,
  convertirNumeroStrategy,
  asignarValorStrategy,
  copiarColumnaStrategy,
  formatearFechaHoraStrategy,
  combinarColumnasStrategy,
  calcularImporteNetoStrategy,
];
