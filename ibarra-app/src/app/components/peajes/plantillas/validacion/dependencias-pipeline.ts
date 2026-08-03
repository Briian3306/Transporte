import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
} from '../../models/peajes.models';
import {
  getAlgorithmDescriptor,
  resolverColumnasEntrada,
} from '../motor/algorithm-descriptor';

/** True si la config está habilitada (default true). */
export function estaHabilitada(cfg: ConfiguracionPlantilla): boolean {
  return cfg.configuracion?.['habilitado'] !== false;
}

export function filtrarConfigsHabilitadas(
  configs: ConfiguracionPlantilla[]
): ConfiguracionPlantilla[] {
  return configs.filter(estaHabilitada);
}

export function columnaProducida(cfg: ConfiguracionPlantilla): string | null {
  const dest = (cfg.columna_destino as string | undefined) || cfg.nombre_columna;
  return dest?.trim() ? dest : null;
}

/**
 * Columnas de las que depende un paso (para grafo de deps).
 * Acepta columnas_entrada / columnas legacy, columna, precio/bonif, y defaults.
 */
export function columnasRequeridasPaso(
  cfg: ConfiguracionPlantilla,
  algoritmos?: AlgoritmoCombinado[]
): string[] {
  const config = cfg.configuracion ?? undefined;
  const codigo =
    (config?.['algoritmo_codigo'] as string | undefined) ??
    (cfg.algoritmo_combinado_id ? null : cfg.tipo === 'mapeo' ? 'COPIAR_COLUMNA' : null);

  const fromArr = resolverColumnasEntrada(config);
  if (fromArr.length) return unique(fromArr);

  if (codigo === 'ASIGNAR_VALOR') return [];

  if (codigo === 'CALCULAR_IMPORTE_NETO') {
    return [
      (config?.['precio_columna'] as string) ?? 'PRECIO',
      (config?.['bonificacion_columna'] as string) ?? 'BONIFICACION',
    ];
  }

  if (codigo === 'FORMATEAR_FECHA_HORA') {
    return ['FECHA', 'HORA'];
  }

  if (cfg.algoritmo_combinado_id && algoritmos) {
    const alg = algoritmos.find((a) => a.id === cfg.algoritmo_combinado_id);
    const cols = new Set<string>();
    for (const p of alg?.pasos ?? []) {
      const pCols = resolverColumnasEntrada(p.parametros);
      pCols.forEach((c) => cols.add(c));
      const single = p.parametros?.['columna'];
      if (typeof single === 'string' && single) cols.add(single);
      if (p.algoritmo_codigo === 'FORMATEAR_FECHA_HORA' && pCols.length === 0) {
        cols.add('FECHA');
        cols.add('HORA');
      }
    }
    if (cols.size === 0 && cfg.nombre_columna) cols.add(cfg.nombre_columna);
    return [...cols];
  }

  const single = config?.['columna'];
  if (typeof single === 'string' && single) return [single];

  if (cfg.nombre_columna) return [cfg.nombre_columna];
  return [];
}

/**
 * Valida fuentes, use-before-create, ciclos entre productores y outputs vacíos.
 */
export function validarDependenciasConfigs(
  configs: ConfiguracionPlantilla[],
  columnasOrigen: string[],
  algoritmos?: AlgoritmoCombinado[]
): ErrorValidacionPasada[] {
  const errores: ErrorValidacionPasada[] = [];
  const habilitadas = filtrarConfigsHabilitadas(configs).sort(
    (a, b) => a.orden - b.orden
  );

  const origenNorm = new Map<string, string>();
  for (const c of columnasOrigen) {
    origenNorm.set(c.toUpperCase(), c);
  }

  /** productor key (destino) → config que lo produce */
  const productores = new Map<string, ConfiguracionPlantilla>();
  for (const cfg of habilitadas) {
    const prod = columnaProducida(cfg);
    if (!prod) {
      if (cfg.obligatoria) {
        errores.push({
          fila: 0,
          columna: 'columna_destino',
          valor: null,
          motivo: `Salida vacía en paso obligatoria (orden=${cfg.orden})`,
        });
      }
      continue;
    }
    const key = prod.toUpperCase();
    if (productores.has(key)) {
      // No es error de deps per se; se permite overwrite. Seguimos con el último.
    }
    productores.set(key, cfg);
  }

  // Grafo: nodo = destino producido; arista A→B si A requiere B y B es producido por pipeline
  const adj = new Map<string, string[]>();
  for (const cfg of habilitadas) {
    const prod = columnaProducida(cfg);
    if (!prod) continue;
    const prodKey = prod.toUpperCase();
    const reqs = columnasRequeridasPaso(cfg, algoritmos)
      .map((c) => c.toUpperCase())
      .filter((c) => productores.has(c) && c !== prodKey);
    adj.set(prodKey, reqs);
  }

  const ciclo = detectarCiclo(adj);
  if (ciclo) {
    errores.push({
      fila: 0,
      columna: ciclo,
      valor: null,
      motivo: `Dependencia circular en columnas del pipeline (involucra ${ciclo})`,
    });
  }

  // Walk in orden: available = origen ∪ producidas previas
  const disponibles = new Set<string>([...origenNorm.keys()]);

  for (const cfg of habilitadas) {
    const reqs = columnasRequeridasPaso(cfg, algoritmos);
    for (const col of reqs) {
      const key = col.toUpperCase();
      if (disponibles.has(key)) continue;

      const productor = productores.get(key);
      if (productor && productor.orden > cfg.orden) {
        errores.push({
          fila: 0,
          columna: col,
          valor: cfg.orden,
          motivo: `Uso antes de crear: "${col}" se produce en orden ${productor.orden} pero se usa en orden ${cfg.orden}`,
        });
      } else if (!productor && !origenNorm.has(key)) {
        errores.push({
          fila: 0,
          columna: col,
          valor: null,
          motivo: `Columna fuente ausente en origen y no producida por el pipeline: ${col}`,
        });
      } else if (productor && productor.orden === cfg.orden) {
        // mismo orden — raro; tratar como use-before-create
        errores.push({
          fila: 0,
          columna: col,
          valor: cfg.orden,
          motivo: `Uso antes de crear: "${col}" depende de un paso del mismo orden (${cfg.orden})`,
        });
      }
    }

    const prod = columnaProducida(cfg);
    if (prod) disponibles.add(prod.toUpperCase());

    // Descriptor-level param checks when codigo atómico presente
    const codigo = cfg.configuracion?.['algoritmo_codigo'] as string | undefined;
    if (codigo) {
      const desc = getAlgorithmDescriptor(codigo);
      if (desc) {
        // Enriquecer config con nombre_columna como columna si falta
        const enriched = {
          ...(cfg.configuracion ?? {}),
          columna:
            (cfg.configuracion?.['columna'] as string | undefined) ??
            cfg.nombre_columna,
        };
        // ASIGNAR_VALOR no necesita columna
        const toValidate =
          codigo === 'ASIGNAR_VALOR'
            ? cfg.configuracion
            : codigo === 'FORMATEAR_FECHA_HORA' ||
                codigo === 'COMBINAR_COLUMNAS' ||
                codigo === 'CALCULAR_IMPORTE_NETO'
              ? cfg.configuracion
              : enriched;
        errores.push(...desc.validar(toValidate));
      }
    }
  }

  return errores;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

function detectarCiclo(adj: Map<string, string[]>): string | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const k of adj.keys()) color.set(k, WHITE);

  const stack: string[] = [];

  const dfs = (u: string): string | null => {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) return v;
      if (c === WHITE) {
        const hit = dfs(v);
        if (hit) return hit;
      }
    }
    stack.pop();
    color.set(u, BLACK);
    return null;
  };

  for (const u of adj.keys()) {
    if ((color.get(u) ?? WHITE) === WHITE) {
      const hit = dfs(u);
      if (hit) return hit;
    }
  }
  return null;
}
