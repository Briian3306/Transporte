import { Estacion, Peaje, ResultadoReconocimientoEstacion } from './peajes.models';

/** NFD, mayúsculas, espacios — alineado a `normalizarEstacion` del catálogo. */
export function normalizarCodigoEstacion(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** `0001` y `1` son el mismo código Telepase. */
export function variantesCodigoEstacion(valor: unknown): string[] {
  const n = normalizarCodigoEstacion(valor);
  if (!n) return [];
  const out = new Set<string>([n]);
  if (/^\d+$/.test(n)) {
    out.add(String(Number(n)));
  }
  return [...out];
}

export function codigoEstacionEquivalente(a: unknown, b: unknown): boolean {
  const sa = normalizarCodigoEstacion(a);
  const sb = normalizarCodigoEstacion(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    return Number(sa) === Number(sb);
  }
  return false;
}

export function estacionCoincideCodigoProveedor(
  estacion: Pick<Estacion, 'nombre' | 'codigos_proveedor'>,
  valor: unknown
): boolean {
  if (codigoEstacionEquivalente(estacion.nombre, valor)) return true;
  return (estacion.codigos_proveedor ?? []).some((c) => codigoEstacionEquivalente(c, valor));
}

export function empresaIdDeEstacion(
  estacion: Estacion,
  peajes: readonly Peaje[] = []
): string | null {
  return (
    estacion.peaje?.empresa_id ??
    peajes.find((p) => p.id === estacion.peaje_id)?.empresa_id ??
    null
  );
}

export function estacionPerteneceAEmpresa(
  estacion: Estacion,
  empresaId: string | null | undefined,
  peajes: readonly Peaje[] = []
): boolean {
  if (!empresaId) return true;
  const emp = empresaIdDeEstacion(estacion, peajes);
  return !emp || emp === empresaId || emp === '__global__';
}

export function filtrarEstacionesPorEmpresa(
  estaciones: readonly Estacion[],
  empresaId: string | null | undefined,
  peajes: readonly Peaje[] = []
): Estacion[] {
  if (!empresaId) return [...estaciones];
  return estaciones.filter((e) => estacionPerteneceAEmpresa(e, empresaId, peajes));
}

/**
 * Reconocimiento puro (sin aliases persistidos).
 * Código `0001` en Zarate y DOCK SUD: con empresa → una exacta; sin empresa → sugerencias.
 */
export function reconocerEstacionEnCatalogo(
  estaciones: readonly Estacion[],
  valorProveedor: string,
  empresaId?: string | null,
  peajes: readonly Peaje[] = []
): ResultadoReconocimientoEstacion {
  const valor = String(valorProveedor ?? '').trim();
  const vacio: ResultadoReconocimientoEstacion = {
    valorProveedor: valor,
    tipo: 'sin_coincidencia',
    estacion: null,
    sugerencias: [],
  };
  if (!normalizarCodigoEstacion(valor)) return vacio;

  const scoped = filtrarEstacionesPorEmpresa(estaciones, empresaId, peajes);
  const exactas = scoped.filter((e) => estacionCoincideCodigoProveedor(e, valor));
  if (exactas.length === 1) {
    return {
      valorProveedor: valor,
      tipo: 'exacta',
      estacion: exactas[0],
      sugerencias: [],
    };
  }
  if (exactas.length > 1) {
    return {
      valorProveedor: valor,
      tipo: 'sugerencias',
      estacion: null,
      sugerencias: exactas,
    };
  }

  const n = normalizarCodigoEstacion(valor);
  const parciales = scoped
    .filter((e) => {
      const nombre = normalizarCodigoEstacion(e.nombre);
      return nombre.includes(n) || n.includes(nombre);
    })
    .sort((a, b) => {
      const aN = normalizarCodigoEstacion(a.nombre);
      const bN = normalizarCodigoEstacion(b.nombre);
      const rank = (nombre: string) => (nombre === n ? 0 : nombre.startsWith(n) ? 1 : 2);
      return rank(aN) - rank(bN) || a.nombre.localeCompare(b.nombre);
    });
  if (parciales.length === 1 && normalizarCodigoEstacion(parciales[0].nombre) === n) {
    return {
      valorProveedor: valor,
      tipo: 'exacta',
      estacion: parciales[0],
      sugerencias: [],
    };
  }
  return {
    valorProveedor: valor,
    tipo: parciales.length ? 'sugerencias' : 'sin_coincidencia',
    estacion: null,
    sugerencias: parciales,
  };
}
