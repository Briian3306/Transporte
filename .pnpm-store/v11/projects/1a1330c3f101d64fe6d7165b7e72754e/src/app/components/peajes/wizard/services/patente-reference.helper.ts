export interface PatenteReferenceRow {
  PATENTE_ID: unknown;
  [key: string]: unknown;
}

export interface PatenteReferenceCatalogItem {
  id: string;
  patente: string;
}

export interface PatenteReferenceResult<T extends PatenteReferenceRow> {
  rows: T[];
  unresolved: string[];
}

export function normalizarPatenteReferencia(value: unknown): string {
  return String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function esPatenteUuid(value: unknown): boolean {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolvePatenteReferences<T extends PatenteReferenceRow>(
  rows: readonly T[],
  catalog: readonly PatenteReferenceCatalogItem[]
): PatenteReferenceResult<T> {
  const idsByCode = new Map(
    catalog.flatMap((patente) => [
      [normalizarPatenteReferencia(patente.patente), patente.id] as const,
      [normalizarPatenteReferencia(patente.id), patente.id] as const,
    ])
  );
  const unresolved = new Set<string>();
  const resolvedRows = rows.map((row) => {
    if (esPatenteUuid(row.PATENTE_ID)) {
      return { ...row } as T;
    }
    const code = normalizarPatenteReferencia(row.PATENTE_ID);
    const id = idsByCode.get(code);
    if (!id) {
      if (code) unresolved.add(code);
      return { ...row, PATENTE_ID: null } as T;
    }
    return { ...row, PATENTE_ID: id } as T;
  });
  return { rows: resolvedRows, unresolved: [...unresolved].sort() };
}
