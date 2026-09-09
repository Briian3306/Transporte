import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { TarifaSentido, TarifaStatusPico } from '../../models/tarifario.contracts';

export type SentidoFamily = 'AMBAS' | 'DIRECCIONAL' | 'SIN_TARIFARIO';

export interface EstacionCatalogoRefresco {
  estacionId: string;
  estacionNombre: string;
  peajeId: string;
  peajeNombre: string;
  sentidosExistentes: TarifaSentido[];
}

export interface EstacionOpcionRefresco {
  estacionId: string;
  estacionNombre: string;
  pendiente: boolean;
  sentidosExistentes: TarifaSentido[];
}

export interface IdentidadTarifaExistente {
  estacionId: string;
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
}

export interface GrupoPendienteRefresco {
  key: string;
  peajeId: string;
  peajeNombre: string;
  family: SentidoFamily;
  opciones: EstacionOpcionRefresco[];
  itemsPorEstacion: Map<string, ResultadoDetectarRefresco[]>;
}

const SENTIDO_ORDER: TarifaSentido[] = ['IDA', 'VUELTA', 'AMBAS'];

export function sentidoFamilyOf(sentidosExistentes: readonly TarifaSentido[]): SentidoFamily {
  if (sentidosExistentes.includes('AMBAS')) return 'AMBAS';
  if (sentidosExistentes.includes('IDA') || sentidosExistentes.includes('VUELTA')) return 'DIRECCIONAL';
  return 'SIN_TARIFARIO';
}

export function familySentidos(
  family: SentidoFamily,
  sentidosExistentesInterseccion: readonly TarifaSentido[],
): TarifaSentido[] {
  if (family === 'AMBAS') return ['AMBAS'];
  if (family === 'DIRECCIONAL') {
    return (['IDA', 'VUELTA'] as const).filter((sentido) =>
      sentidosExistentesInterseccion.includes(sentido),
    );
  }
  return [];
}

export function interseccionSentidos(listas: readonly TarifaSentido[][]): TarifaSentido[] {
  if (!listas.length) return [];
  return SENTIDO_ORDER.filter((sentido) => listas.every((lista) => lista.includes(sentido)));
}

export function agruparPendientesPorPeajeYFamilia(
  unresolved: readonly ResultadoDetectarRefresco[],
  catalogo: readonly EstacionCatalogoRefresco[],
): GrupoPendienteRefresco[] {
  const byId = new Map(catalogo.map((row) => [row.estacionId, row]));
  const groups = new Map<string, GrupoPendienteRefresco>();

  for (const item of unresolved) {
    const row = byId.get(item.estacionId);
    const peajeId = item.peajeId || row?.peajeId || '';
    const family = sentidoFamilyOf(row?.sentidosExistentes ?? []);
    const key = `${peajeId}|${family}`;
    let grupo = groups.get(key);
    if (!grupo) {
      const sameFamily = catalogo.filter(
        (estacion) =>
          estacion.peajeId === peajeId &&
          sentidoFamilyOf(estacion.sentidosExistentes) === family,
      );
      grupo = {
        key,
        peajeId,
        peajeNombre: row?.peajeNombre || '',
        family,
        opciones: sameFamily.map((estacion) => ({
          estacionId: estacion.estacionId,
          estacionNombre: estacion.estacionNombre,
          pendiente: unresolved.some((r) => r.estacionId === estacion.estacionId),
          sentidosExistentes: [...estacion.sentidosExistentes],
        })),
        itemsPorEstacion: new Map(),
      };
      groups.set(key, grupo);
    }
    const list = grupo.itemsPorEstacion.get(item.estacionId) ?? [];
    list.push(item);
    grupo.itemsPorEstacion.set(item.estacionId, list);
  }

  return [...groups.values()];
}

export function heuristicaSeleccionInicial(
  grupo: GrupoPendienteRefresco,
  candidatos: readonly CandidatoRefrescoTarifa[],
): string[] {
  const anchorId = [...grupo.itemsPorEstacion.keys()][0];
  if (!anchorId) return [];

  const selected = new Set<string>([anchorId]);
  const anchors = grupo.itemsPorEstacion.get(anchorId) ?? [];
  const signatures = new Set(
    anchors.flatMap((item) =>
      signaturesDe(
        item.categoria,
        item.status,
        item.candidatePrice ?? precioDeCandidato(candidatos, item),
      ),
    ),
  );

  for (const opcion of grupo.opciones) {
    if (opcion.estacionId === anchorId) continue;
    const related = candidatos.filter((c) => c.estacionId === opcion.estacionId);
    const matches = related.some((c) =>
      signaturesDe(c.categoria, c.statusSolicitado, c.precioDirecto).some((sig) =>
        signatures.has(sig),
      ),
    );
    if (matches) selected.add(opcion.estacionId);
  }

  return grupo.opciones
    .map((opcion) => opcion.estacionId)
    .filter((id) => selected.has(id));
}

export function resolverRequiereNormalizacionIva(
  estacionId: string,
  categoria: number,
  status: TarifaStatusPico,
  sentido: TarifaSentido,
  catalogoExistentes: readonly IdentidadTarifaExistente[],
): boolean | null {
  const exists = catalogoExistentes.some(
    (row) =>
      row.estacionId === estacionId &&
      row.categoria === categoria &&
      row.status === status &&
      row.sentido === sentido,
  );
  return exists ? null : false;
}

function precioDeCandidato(
  candidatos: readonly CandidatoRefrescoTarifa[],
  item: ResultadoDetectarRefresco,
): number | null {
  const related = candidatos.find((c) =>
    c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
  );
  return related?.precioDirecto ?? null;
}

function signaturesDe(
  categoria: number | null | undefined,
  status: TarifaStatusPico | null | undefined,
  precio: number | null | undefined,
): string[] {
  if (categoria == null || precio == null) return [];
  const priceKey = String(precio);
  if (status) return [`${categoria}|${status}|${priceKey}`];
  return [`${categoria}|NO_PICO|${priceKey}`, `${categoria}|PICO|${priceKey}`];
}
