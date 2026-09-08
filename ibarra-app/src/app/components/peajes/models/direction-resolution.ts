import type { TarifaSentido } from './tarifario.contracts';

export type LaneDirection = 'IDA' | 'VUELTA';

export interface EstacionViaSentidoRef {
  codigoEstacion: string;
  via: string;
  sentido: LaneDirection;
}

export type SentidoResolution =
  | { sentido: TarifaSentido; confidence: 'EXPLICIT' | 'LANE_MAP' }
  | { sentido: null; confidence: 'UNRESOLVED'; reason: 'MISSING_MAPPING' | 'CONFLICT' };

function normalize(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Resolves direction without ever turning missing evidence into AMBAS.
 * Explicit SENTIDO is authoritative; lane metadata is only a fallback.
 */
export function resolvePasadaSentido(input: {
  explicit: unknown;
  codigoEstacion: unknown;
  via: unknown;
  map: readonly EstacionViaSentidoRef[];
}): SentidoResolution {
  const explicit = normalize(input.explicit);
  if (explicit === 'IDA' || explicit === 'VUELTA' || explicit === 'AMBAS') {
    return { sentido: explicit, confidence: 'EXPLICIT' };
  }

  const codigo = normalize(input.codigoEstacion);
  const via = normalize(input.via);
  const matches = input.map.filter(
    (row) => normalize(row.codigoEstacion) === codigo && normalize(row.via) === via,
  );
  const sentidos = [...new Set(matches.map((row) => row.sentido))];
  if (sentidos.length === 1) {
    return { sentido: sentidos[0], confidence: 'LANE_MAP' };
  }
  return {
    sentido: null,
    confidence: 'UNRESOLVED',
    reason: sentidos.length > 1 ? 'CONFLICT' : 'MISSING_MAPPING',
  };
}
