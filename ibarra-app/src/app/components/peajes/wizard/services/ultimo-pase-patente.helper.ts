import { Pase } from '../../models';

function createdAtMs(pase: Pase): number {
  const t = pase.created_at ? Date.parse(pase.created_at) : Number.NEGATIVE_INFINITY;
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Latest catalog pase id per patente (`created_at` desc). Empty if none. */
export function ultimoPaseIdPorPatente(pases: Pase[]): Map<string, string> {
  const latest = new Map<string, Pase>();
  for (const pase of pases) {
    if (!pase.patente_id || !pase.id) continue;
    const prev = latest.get(pase.patente_id);
    if (!prev || createdAtMs(pase) >= createdAtMs(prev)) {
      latest.set(pase.patente_id, pase);
    }
  }
  return new Map([...latest.entries()].map(([patenteId, pase]) => [patenteId, pase.id]));
}

export function paseIdVacio(valor: unknown): boolean {
  return valor == null || String(valor).trim() === '';
}
