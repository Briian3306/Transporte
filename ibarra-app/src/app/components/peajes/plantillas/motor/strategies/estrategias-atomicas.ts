import { StrategyContext, TransformStrategy } from '../strategy.types';

function asString(value: unknown): string {
  if (value == null) return '';
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
 * Parámetros: columnas: [fecha, hora], formato_hora: 'HHMMSS'
 */
export const formatearFechaHoraStrategy: TransformStrategy = {
  codigo: 'FORMATEAR_FECHA_HORA',
  nombre: 'Formatear fecha y hora',
  descripcion: 'Combina columnas de fecha y hora en FECHA_HORA ISO-like.',
  ejecutar(ctx: StrategyContext): unknown {
    const columnas = (ctx.parametros?.['columnas'] as string[] | undefined) ?? [
      'FECHA',
      'HORA',
    ];
    const colFecha = columnas[0] ?? 'FECHA';
    const colHora = columnas[1] ?? 'HORA';
    const fechaRaw = asString(ctx.fila[colFecha] ?? ctx.resultado[colFecha]).trim();
    let horaRaw = asString(ctx.fila[colHora] ?? ctx.resultado[colHora]).trim();

    if (!fechaRaw) return null;

    // Pad HHMMSS
    if (horaRaw.length > 0 && horaRaw.length < 6) {
      horaRaw = horaRaw.padStart(6, '0');
    }
    if (!horaRaw) horaRaw = '000000';

    const fechaIso = parseFechaDdMmYyyy(fechaRaw);
    if (!fechaIso) return null;

    const hh = horaRaw.slice(0, 2);
    const mm = horaRaw.slice(2, 4);
    const ss = horaRaw.slice(4, 6);
    return `${fechaIso} ${hh}:${mm}:${ss}`;
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
    const columnas = (ctx.parametros?.['columnas'] as string[] | undefined) ?? [];
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
    const colPrecio = (ctx.parametros?.['precio_columna'] as string) ?? 'PRECIO';
    const colBonif =
      (ctx.parametros?.['bonificacion_columna'] as string) ?? 'BONIFICACION';

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

function parseFechaDdMmYyyy(fecha: string): string | null {
  // dd/mm/yyyy o dd-mm-yyyy
  const m = fecha.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return fecha.slice(0, 10);
  }
  return null;
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
  convertirTextoStrategy,
  convertirNumeroStrategy,
  asignarValorStrategy,
  copiarColumnaStrategy,
  formatearFechaHoraStrategy,
  combinarColumnasStrategy,
  calcularImporteNetoStrategy,
];
