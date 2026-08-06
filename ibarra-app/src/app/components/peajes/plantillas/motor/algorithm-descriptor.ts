import { ErrorValidacionPasada } from '../../models/peajes.models';
import { ALGORITMO_CODIGOS, AlgoritmoCodigo } from './strategy.types';

export type AlgorithmCategoria =
  | 'texto'
  | 'fecha'
  | 'numero'
  | 'combinacion'
  | 'asignacion'
  | 'mapeo';

export type AlgorithmOutputType = 'string' | 'number' | 'unknown';

export interface AlgorithmInputsSpec {
  /** Aridad esperada de columnas de entrada (número fijo o 'variadic'). */
  arity: number | 'variadic';
  /** Si se requieren columnas de entrada. */
  required: boolean;
  min?: number;
  max?: number;
}

export interface ParametroSchemaField {
  nombre: string;
  tipo: 'string' | 'number' | 'boolean' | 'string[]' | 'enum' | 'unknown';
  requerido?: boolean;
  descripcion?: string;
  /** Valores permitidos cuando tipo === 'enum' (select en UI). */
  opciones?: string[];
}

/**
 * Metadata UI + validación de un código atómico del registry (F03-9).
 */
export interface AlgorithmDescriptor {
  codigo: AlgoritmoCodigo;
  nombre: string;
  descripcion: string;
  categoria: AlgorithmCategoria;
  inputs: AlgorithmInputsSpec;
  parametrosSchema: ParametroSchemaField[];
  outputType: AlgorithmOutputType;
  validar(config: Record<string, unknown> | null | undefined): ErrorValidacionPasada[];
  resumen(config: Record<string, unknown> | null | undefined): string;
}

/** Lee columnas multi-input: `columnas_entrada` (nuevo) o `columnas` (legacy). */
export function resolverColumnasEntrada(
  config: Record<string, unknown> | null | undefined
): string[] {
  if (!config) return [];
  const entrada = config['columnas_entrada'];
  if (Array.isArray(entrada)) {
    return entrada.filter((c): c is string => typeof c === 'string' && c.length > 0);
  }
  const legacy = config['columnas'];
  if (Array.isArray(legacy)) {
    return legacy.filter((c): c is string => typeof c === 'string' && c.length > 0);
  }
  return [];
}

/** Normaliza parametros para estrategias: asegura `columnas` desde `columnas_entrada`. */
export function normalizarParametrosConfig(
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!config) return null;
  const cols = resolverColumnasEntrada(config);
  if (cols.length === 0) return { ...config };
  return { ...config, columnas: cols, columnas_entrada: cols };
}

function err(
  columna: string,
  valor: unknown,
  motivo: string
): ErrorValidacionPasada {
  return { fila: 0, columna, valor, motivo };
}

function validarArity(
  codigo: string,
  cols: string[],
  inputs: AlgorithmInputsSpec
): ErrorValidacionPasada[] {
  if (!inputs.required && cols.length === 0) return [];
  if (inputs.required && cols.length === 0) {
    return [
      err(
        'columnas_entrada',
        cols,
        `${codigo}: se requieren columnas de entrada (columnas_entrada o columnas)`
      ),
    ];
  }
  if (typeof inputs.arity === 'number' && cols.length !== inputs.arity) {
    return [
      err(
        'columnas_entrada',
        cols,
        `${codigo}: se esperan ${inputs.arity} columna(s) de entrada, hay ${cols.length}`
      ),
    ];
  }
  if (inputs.min != null && cols.length < inputs.min) {
    return [
      err(
        'columnas_entrada',
        cols,
        `${codigo}: mínimo ${inputs.min} columna(s) de entrada`
      ),
    ];
  }
  if (inputs.max != null && cols.length > inputs.max) {
    return [
      err(
        'columnas_entrada',
        cols,
        `${codigo}: máximo ${inputs.max} columna(s) de entrada`
      ),
    ];
  }
  return [];
}

function colUnaria(
  config: Record<string, unknown> | null | undefined
): string | undefined {
  if (!config) return undefined;
  const fromArr = resolverColumnasEntrada(config)[0];
  if (fromArr) return fromArr;
  const col = config['columna'];
  return typeof col === 'string' && col ? col : undefined;
}

const DESCRIPTORES: AlgorithmDescriptor[] = [
  {
    codigo: 'BORRAR_ESPACIOS',
    nombre: 'Borrar espacios',
    descripcion: 'Elimina espacios al inicio y al final del valor.',
    categoria: 'texto',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false, descripcion: 'Columna origen' },
    ],
    outputType: 'string',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'BORRAR_ESPACIOS: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `Trim(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'ELIMINAR_GUIONES',
    nombre: 'Eliminar guiones',
    descripcion: 'Quita guiones del valor.',
    categoria: 'texto',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'string',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'ELIMINAR_GUIONES: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `Sin guiones(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'CONVERTIR_MAYUSCULAS',
    nombre: 'Convertir a mayúsculas',
    descripcion: 'Convierte el texto a mayúsculas.',
    categoria: 'texto',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'string',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'CONVERTIR_MAYUSCULAS: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `UPPER(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'REEMPLAZAR_TEXTO',
    nombre: 'Reemplazar texto',
    descripcion: 'Normaliza aliases con reglas ordenadas buscar → reemplazar.',
    categoria: 'texto',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false, descripcion: 'Columna origen' },
      {
        nombre: 'reglas',
        tipo: 'unknown',
        requerido: true,
        descripcion: 'Lista ordenada: [{ buscar, reemplazar, modo?: exacto|contiene }]',
      },
    ],
    outputType: 'string',
    validar(config) {
      const col = colUnaria(config);
      const reglas = config?.['reglas'];
      if (!col) return [err('columna', null, 'REEMPLAZAR_TEXTO: falta columna de entrada')];
      if (!Array.isArray(reglas) || reglas.length === 0) {
        return [err('reglas', reglas ?? null, 'REEMPLAZAR_TEXTO: se requiere al menos una regla')];
      }
      const invalid = reglas.some((regla) => {
        if (!regla || typeof regla !== 'object') return true;
        const item = regla as Record<string, unknown>;
        return typeof item['buscar'] !== 'string' || !item['buscar'].trim() ||
          typeof item['reemplazar'] !== 'string' ||
          (item['modo'] != null && item['modo'] !== 'exacto' && item['modo'] !== 'contiene');
      });
      return invalid
        ? [err('reglas', reglas, 'REEMPLAZAR_TEXTO: cada regla requiere buscar, reemplazar y modo válido')]
        : [];
    },
    resumen(config) {
      const reglas = Array.isArray(config?.['reglas']) ? config!['reglas'] as Array<Record<string, unknown>> : [];
      return `Reemplazar(${reglas.map((r) => `${String(r['buscar'] ?? '?')} → ${String(r['reemplazar'] ?? '?')}`).join(', ') || '?'})`;
    },
  },
  {
    codigo: 'COMBINAR_COLUMNAS',
    nombre: 'Combinar columnas',
    descripcion: 'Concatena columnas con un separador opcional.',
    categoria: 'combinacion',
    inputs: { arity: 'variadic', required: true, min: 2 },
    parametrosSchema: [
      {
        nombre: 'columnas_entrada',
        tipo: 'string[]',
        requerido: true,
        descripcion: 'Columnas a concatenar (alias: columnas)',
      },
      { nombre: 'separador', tipo: 'string', requerido: false },
      { nombre: 'formato_hora', tipo: 'string', requerido: false },
    ],
    outputType: 'string',
    validar(config) {
      if (config?.['formato_hora'] === 'HHMMSS') {
        return validarArity('COMBINAR_COLUMNAS', resolverColumnasEntrada(config), {
          arity: 2,
          required: true,
        });
      }
      return validarArity('COMBINAR_COLUMNAS', resolverColumnasEntrada(config), {
        arity: 'variadic',
        required: true,
        min: 2,
      });
    },
    resumen(config) {
      const cols = resolverColumnasEntrada(config);
      const sep = (config?.['separador'] as string | undefined) ?? ' ';
      return `Combinar(${cols.join(` '${sep}' `) || '?'})`;
    },
  },
  {
    codigo: 'FORMATEAR_FECHA_HORA',
    nombre: 'Formatear fecha y hora',
    descripcion: 'Combina columnas de fecha y hora en FECHA_HORA.',
    categoria: 'fecha',
    inputs: { arity: 2, required: true },
    parametrosSchema: [
      {
        nombre: 'columnas_entrada',
        tipo: 'string[]',
        requerido: true,
        descripcion: '[fecha, hora] (alias: columnas)',
      },
      {
        nombre: 'formato_hora',
        tipo: 'enum',
        requerido: true,
        descripcion: 'Formato de entrada de la hora/fecha',
        opciones: [
          'HHMMSS',
          'HH:MM:SS',
          'YYYY-MM-DD HH:MM:SS',
          'MM/DD/YY HHMMSS',
          'DD/MM/YY HHMMSS',
          'DD/MM/YYYY HH:MM:SS',
        ],
      },
    ],
    outputType: 'string',
    validar(config) {
      const cols = resolverColumnasEntrada(config);
      if (cols.length === 0) {
        // Defaults FECHA/HORA son válidos en runtime
        return [];
      }
      return validarArity('FORMATEAR_FECHA_HORA', cols, { arity: 2, required: true });
    },
    resumen(config) {
      const cols = resolverColumnasEntrada(config);
      const f = cols[0] ?? 'FECHA';
      const h = cols[1] ?? 'HORA';
      const fmt = (config?.['formato_hora'] as string | undefined) ?? 'HHMMSS';
      return `FechaHora(${f}, ${h} · ${fmt})`;
    },
  },
  {
    codigo: 'CALCULAR_IMPORTE_NETO',
    nombre: 'Calcular importe neto',
    descripcion: 'Calcula PRECIO − BONIFICACION.',
    categoria: 'numero',
    inputs: { arity: 2, required: false },
    parametrosSchema: [
      { nombre: 'precio_columna', tipo: 'string', requerido: false },
      { nombre: 'bonificacion_columna', tipo: 'string', requerido: false },
      {
        nombre: 'columnas_entrada',
        tipo: 'string[]',
        requerido: false,
        descripcion: 'Opcional [precio, bonificacion]',
      },
    ],
    outputType: 'number',
    validar(config) {
      const cols = resolverColumnasEntrada(config);
      if (cols.length > 0 && cols.length !== 2) {
        return validarArity('CALCULAR_IMPORTE_NETO', cols, { arity: 2, required: true });
      }
      return [];
    },
    resumen(config) {
      const cols = resolverColumnasEntrada(config);
      const p =
        cols[0] ??
        (config?.['precio_columna'] as string | undefined) ??
        'PRECIO';
      const b =
        cols[1] ??
        (config?.['bonificacion_columna'] as string | undefined) ??
        'BONIFICACION';
      return `Neto(${p} - ${b})`;
    },
  },
  {
    codigo: 'ELIMINAR_IVA',
    nombre: 'Eliminar IVA',
    descripcion: 'Divide el importe de entrada por 1,21 y redondea a dos decimales.',
    categoria: 'numero',
    inputs: { arity: 1, required: true },
    parametrosSchema: [{ nombre: 'columna', tipo: 'string', requerido: false }],
    outputType: 'number',
    validar(config) {
      const col = colUnaria(config);
      return col ? [] : [err('columna', null, 'ELIMINAR_IVA: falta columna de entrada')];
    },
    resumen(config) {
      return `Sin IVA(${colUnaria(config) ?? 'IMPORTE_NETO'} / 1,21)`;
    },
  },
  {
    codigo: 'OPERAR_NUMERO',
    nombre: 'Operar número',
    descripcion: 'Opera una columna numérica contra un valor fijo.',
    categoria: 'numero',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'operacion', tipo: 'enum', requerido: true, opciones: ['sumar', 'restar', 'multiplicar', 'dividir'] },
      { nombre: 'valor', tipo: 'number', requerido: true, descripcion: 'Valor fijo de la operación' },
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'number',
    validar(config) {
      const errores = colUnaria(config)
        ? []
        : [err('columna', null, 'OPERAR_NUMERO: falta columna de entrada')];
      const op = config?.['operacion'];
      if (!['sumar', 'restar', 'multiplicar', 'dividir'].includes(String(op))) {
        errores.push(err('operacion', op ?? null, 'OPERAR_NUMERO: operación inválida'));
      }
      const valor = Number(config?.['valor']);
      if (!Number.isFinite(valor)) errores.push(err('valor', config?.['valor'] ?? null, 'OPERAR_NUMERO: valor numérico inválido'));
      if (op === 'dividir' && valor === 0) errores.push(err('valor', valor, 'OPERAR_NUMERO: no se puede dividir por cero'));
      return errores;
    },
    resumen(config) {
      return `${String(config?.['operacion'] ?? 'operar')}(${colUnaria(config) ?? '?'}, ${String(config?.['valor'] ?? '?')})`;
    },
  },
  {
    codigo: 'CONVERTIR_NUMERO',
    nombre: 'Convertir a número',
    descripcion: 'Convierte el valor a número decimal (punto decimal, sin miles).',
    categoria: 'numero',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'number',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'CONVERTIR_NUMERO: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `Número(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'CONVERTIR_NUMERO_ARS',
    nombre: 'Convertir a número (ARS)',
    descripcion: 'Convierte número argentino: miles con punto y decimal con coma (19.985,09).',
    categoria: 'numero',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'number',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'CONVERTIR_NUMERO_ARS: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `NúmeroARS(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'CONVERTIR_TEXTO',
    nombre: 'Convertir a texto',
    descripcion: 'Convierte el valor a string y elimina espacios.',
    categoria: 'texto',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'string',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'CONVERTIR_TEXTO: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `Texto(${colUnaria(config) ?? '?'})`;
    },
  },
  {
    codigo: 'ASIGNAR_VALOR',
    nombre: 'Asignar valor constante',
    descripcion: 'Asigna un valor fijo (p. ej. QUANTITY = 1).',
    categoria: 'asignacion',
    inputs: { arity: 0, required: false },
    parametrosSchema: [
      { nombre: 'valor', tipo: 'unknown', requerido: true },
    ],
    outputType: 'unknown',
    validar(config) {
      if (config == null || !('valor' in config)) {
        return [err('valor', null, 'ASIGNAR_VALOR: falta parametro valor')];
      }
      return [];
    },
    resumen(config) {
      return `Constante(${JSON.stringify(config?.['valor'] ?? null)})`;
    },
  },
  {
    codigo: 'COPIAR_COLUMNA',
    nombre: 'Copiar columna',
    descripcion: 'Copia el valor de una columna de origen al destino.',
    categoria: 'mapeo',
    inputs: { arity: 1, required: true },
    parametrosSchema: [
      { nombre: 'columna', tipo: 'string', requerido: false },
    ],
    outputType: 'unknown',
    validar(config) {
      const col = colUnaria(config);
      if (!col) {
        return [err('columna', null, 'COPIAR_COLUMNA: falta columna de entrada')];
      }
      return [];
    },
    resumen(config) {
      return `Copiar(${colUnaria(config) ?? '?'})`;
    },
  },
];

const BY_CODIGO = new Map<AlgoritmoCodigo, AlgorithmDescriptor>(
  DESCRIPTORES.map((d) => [d.codigo, d])
);

export function getAlgorithmDescriptors(): AlgorithmDescriptor[] {
  return DESCRIPTORES.slice();
}

export function getAlgorithmDescriptor(
  codigo: string
): AlgorithmDescriptor | undefined {
  return BY_CODIGO.get(codigo as AlgoritmoCodigo);
}

/** Garantiza cobertura 1:1 con ALGORITMO_CODIGOS. */
export function assertDescriptorsCompletos(): void {
  for (const codigo of ALGORITMO_CODIGOS) {
    if (!BY_CODIGO.has(codigo)) {
      throw new Error(`Falta AlgorithmDescriptor para ${codigo}`);
    }
  }
  if (DESCRIPTORES.length !== ALGORITMO_CODIGOS.length) {
    throw new Error(
      `Descriptors (${DESCRIPTORES.length}) != ALGORITMO_CODIGOS (${ALGORITMO_CODIGOS.length})`
    );
  }
}
