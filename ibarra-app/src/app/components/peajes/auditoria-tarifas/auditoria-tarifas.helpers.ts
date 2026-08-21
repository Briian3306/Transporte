import {
  TarifaAsignacion,
  TarifaDiagnostico,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
} from './contracts.local';

export const DIAGNOSTICO_LABELS: Record<TarifaDiagnostico, string> = {
  MUESTRA_INSUFICIENTE: 'Muestra insuficiente',
  TARIFA_UNICA: 'Tarifa única',
  CATEGORIA: 'Categoría',
  POSIBLE_HORARIO: 'Posible horario',
  REVISAR: 'Revisar',
  CONFIRMADO: 'Confirmado',
};

export const DIAGNOSTICO_BADGE_CLASS: Record<TarifaDiagnostico, string> = {
  MUESTRA_INSUFICIENTE: 'at__badge--pending',
  TARIFA_UNICA: 'at__badge--neutral',
  CATEGORIA: 'at__badge--info',
  POSIBLE_HORARIO: 'at__badge--info',
  REVISAR: 'at__badge--danger',
  CONFIRMADO: 'at__badge--ok',
};

export const DIAGNOSTICO_OPTIONS: { id: TarifaDiagnostico; label: string }[] = (
  Object.keys(DIAGNOSTICO_LABELS) as TarifaDiagnostico[]
).map((id) => ({ id, label: DIAGNOSTICO_LABELS[id] }));

export function patronFromRow(row: Pick<TarifaNormalizadaRow, 'categoria'>): 'A' | 'B' {
  return row.categoria == null ? 'A' : 'B';
}

export function buildStatusCatalogoButtons(catalogo: TarifaStatusCatalogo[]): TarifaStatusCatalogo[] {
  const sorted = [...catalogo]
    .filter((status) => status.codigo !== 'PENDIENTE' && status.codigo !== 'CONFIRMADO')
    .sort((a, b) => a.orden - b.orden);
  if (sorted.some((c) => c.codigo === 'POSIBLE_HORARIO')) {
    return sorted;
  }
  return [
    ...sorted,
    {
      peaje_id: catalogo[0]?.peaje_id ?? '',
      codigo: 'POSIBLE_HORARIO',
      etiqueta: 'Posible horario',
      color: '#2563eb',
      tipo_meta: 'NEUTRO',
      orden: 999,
    },
  ];
}

export function statusCodesForPeaje(catalogo: TarifaStatusCatalogo[]): string[] {
  return buildStatusCatalogoButtons(catalogo).map((c) => c.codigo);
}

export interface PicoNoPicoPair {
  low: TarifaNormalizadaRow;
  high: TarifaNormalizadaRow;
  noPicoCode: string;
  picoCode: string;
  noPicoLabel: string;
  picoLabel: string;
}

function catalogByTipoMeta(
  catalogo: TarifaStatusCatalogo[],
  tipo: 'PICO' | 'NO_PICO'
): TarifaStatusCatalogo | undefined {
  return (
    catalogo.find(
      (c) => c.tipo_meta === tipo && c.codigo !== 'CONFIRMADO' && c.codigo !== 'PENDIENTE'
    ) ?? catalogo.find((c) => c.codigo === tipo)
  );
}

/** Two distinct prices: cheaper → No Pico, more expensive → Pico. */
export function detectPicoNoPicoPair(
  niveles: TarifaNormalizadaRow[],
  catalogo: TarifaStatusCatalogo[]
): PicoNoPicoPair | null {
  if (niveles.length !== 2) return null;
  const [first, second] = niveles;
  if (first.importe === second.importe) return null;
  const noPico = catalogByTipoMeta(catalogo, 'NO_PICO');
  const pico = catalogByTipoMeta(catalogo, 'PICO');
  if (!noPico || !pico) return null;
  const [low, high] = first.importe < second.importe ? [first, second] : [second, first];
  return {
    low,
    high,
    noPicoCode: noPico.codigo,
    picoCode: pico.codigo,
    noPicoLabel: noPico.etiqueta,
    picoLabel: pico.etiqueta,
  };
}

export function isPicoNoPicoSelection(
  pair: PicoNoPicoPair,
  selections: Map<string, string>
): boolean {
  return (
    selections.get(pair.low.id) === pair.noPicoCode &&
    selections.get(pair.high.id) === pair.picoCode
  );
}

export function pairAlreadyConfirmed(pair: PicoNoPicoPair): boolean {
  return (
    pair.low.diagnostico === 'CONFIRMADO' &&
    pair.high.diagnostico === 'CONFIRMADO' &&
    pair.low.status === pair.noPicoCode &&
    pair.high.status === pair.picoCode
  );
}

export function buildPicoNoPicoAsignaciones(pair: PicoNoPicoPair): TarifaAsignacion[] {
  return [
    { tarifa_normalizada_id: pair.low.id, status_codigo: pair.noPicoCode },
    { tarifa_normalizada_id: pair.high.id, status_codigo: pair.picoCode },
  ];
}

/** Preselect status by ascending price (Apéndice C §7.2). */
export function suggestStatusByPrice(
  niveles: TarifaNormalizadaRow[],
  catalogo: TarifaStatusCatalogo[]
): Map<string, string> {
  const result = new Map<string, string>();
  const sortedLevels = [...niveles].sort((a, b) => a.importe - b.importe);
  const codes = buildStatusCatalogoButtons(catalogo)
    .filter((c) => c.codigo !== 'POSIBLE_HORARIO')
    .map((c) => c.codigo);
  if (!codes.length) {
    return result;
  }
  const lastCode = codes[codes.length - 1];

  sortedLevels.forEach((nivel, index) => {
    if (nivel.diagnostico === 'MUESTRA_INSUFICIENTE') {
      return;
    }
    const code = index < codes.length ? codes[index] : lastCode;
    result.set(nivel.id, code);
  });

  return result;
}

export function parseSort(sort: string | undefined): { key: string; direction: 'asc' | 'desc' } {
  if (!sort || !sort.includes(':')) {
    return { key: 'cases', direction: 'desc' };
  }
  const [key, direction] = sort.split(':');
  return { key, direction: direction === 'asc' ? 'asc' : 'desc' };
}

export function compareRows(
  a: TarifaNormalizadaRow,
  b: TarifaNormalizadaRow,
  key: string,
  direction: 'asc' | 'desc'
): number {
  const mul = direction === 'asc' ? 1 : -1;
  const av = (a as unknown as Record<string, unknown>)[key];
  const bv = (b as unknown as Record<string, unknown>)[key];

  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;

  if (typeof av === 'number' && typeof bv === 'number') {
    return (av - bv) * mul;
  }
  return String(av).localeCompare(String(bv), 'es') * mul;
}

export function familiaFromNiveles(niveles: TarifaNormalizadaRow[]): {
  estacion_nombre: string;
  estacion_id: string;
  peaje_id: string;
  categoria: string | null;
  patron: 'A' | 'B';
  totalCases: number;
} | null {
  if (!niveles.length) return null;
  const first = niveles[0];
  return {
    estacion_id: first.estacion_id,
    estacion_nombre: first.estacion_nombre,
    peaje_id: first.peaje_id,
    categoria: first.categoria,
    patron: patronFromRow(first),
    totalCases: niveles.reduce((sum, n) => sum + n.cases, 0),
  };
}

/** Clase 0–10 o null. Vacío / no numérico → null. Fuera de rango se recorta. */
export function parseCategoriaCalculated(raw: unknown): number | null {
  if (raw === '' || raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n)));
}
